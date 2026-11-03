import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { serializeSignedCookie } from "better-call";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  addProduct,
  getMyCart,
  removeItem,
  setQuantity,
} from "@/lib/cart/cart-repository";
import { resetAndSeed } from "./helpers";

const A = "sess-alice";
const B = "sess-bob";

type AuthLike = typeof auth;

/** Tworzy sesję w bazie i zwraca nagłówek Cookie, jaki wysłałaby przeglądarka tego „urządzenia”. */
async function newDevice(a: AuthLike, userId: string) {
  const ctx = await a.$context;
  const s = await ctx.internalAdapter.createSession(userId);
  const signed = await serializeSignedCookie(
    ctx.authCookies.sessionToken.name,
    s.token,
    ctx.secret,
  );
  return { token: s.token, cookie: signed.split(";")[0] };
}

const hdr = (cookie: string) => new Headers({ cookie });
const whoAmI = async (
  a: AuthLike,
  cookie: string,
  query?: { disableCookieCache?: boolean },
) => (await a.api.getSession({ headers: hdr(cookie), query }))?.user.id ?? null;
const dbSessions = (userId: string) =>
  prisma.session.count({ where: { userId } });

beforeAll(async () => {
  await resetAndSeed();
  for (const id of [A, B]) {
    await prisma.user.create({
      data: {
        id,
        name: id,
        email: `${id}@example.test`,
        emailVerified: true,
        accounts: {
          create: { id: `acc-${id}`, accountId: id, providerId: "github" },
        },
      },
    });
  }
});

beforeEach(async () => {
  await prisma.session.deleteMany({ where: { userId: { in: [A, B] } } });
});

describe("wylogowanie bieżącej sesji vs unieważnienie wszystkich", () => {
  it("signOut na urządzeniu 1 kończy tylko tę sesję – urządzenie 2 nadal działa", async () => {
    const d1 = await newDevice(auth, A);
    const d2 = await newDevice(auth, A);
    expect(await dbSessions(A)).toBe(2);

    await auth.api.signOut({ headers: hdr(d1.cookie) });

    expect(await whoAmI(auth, d1.cookie)).toBeNull();
    expect(await whoAmI(auth, d2.cookie)).toBe(A);
    expect(await dbSessions(A)).toBe(1);
    expect(
      await prisma.session.findUnique({ where: { token: d2.token } }),
    ).not.toBeNull();
  });

  it("revokeSessions na urządzeniu 1 kończy WSZYSTKIE sesje – urządzenie 2 też traci dostęp", async () => {
    const d1 = await newDevice(auth, A);
    const d2 = await newDevice(auth, A);
    const d3 = await newDevice(auth, A);

    await auth.api.revokeSessions({ headers: hdr(d1.cookie) });

    expect(await dbSessions(A)).toBe(0);
    for (const d of [d1, d2, d3])
      expect(await whoAmI(auth, d.cookie)).toBeNull();
  });

  it("revokeOtherSessions zostawia bieżącą, kończy pozostałe", async () => {
    const d1 = await newDevice(auth, A);
    const d2 = await newDevice(auth, A);

    await auth.api.revokeOtherSessions({ headers: hdr(d1.cookie) });

    expect(await whoAmI(auth, d1.cookie)).toBe(A);
    expect(await whoAmI(auth, d2.cookie)).toBeNull();
    expect(await dbSessions(A)).toBe(1);
  });

  it("żadna z operacji nie rusza sesji innego użytkownika", async () => {
    const a1 = await newDevice(auth, A);
    const a2 = await newDevice(auth, A);
    const b1 = await newDevice(auth, B);

    await auth.api.revokeSessions({ headers: hdr(a1.cookie) });
    expect(await whoAmI(auth, a2.cookie)).toBeNull();
    expect(await whoAmI(auth, b1.cookie)).toBe(B);

    await auth.api.signOut({ headers: hdr(b1.cookie) });
    expect(await dbSessions(B)).toBe(0);
  });

  it("revoke/signOut nie kasują danych biznesowych – koszyk przeżywa unieważnienie sesji", async () => {
    const cat = await prisma.category.findUniqueOrThrow({
      where: { code: "cpu" },
    });
    const p = await prisma.product.create({
      data: {
        code: "SESS000001",
        name: "Sesyjny",
        nameSortKey: "sesyjny",
        description: "x",
        image: "/images/products/cpu.webp",
        price: 100,
        amount: 5,
        date: new Date("2026-01-01T00:00:00Z"),
        categoryId: cat.id,
      },
    });
    const d1 = await newDevice(auth, A);
    await addProduct(A, p.id);
    await auth.api.revokeSessions({ headers: hdr(d1.cookie) });
    expect((await getMyCart(A)).items).toHaveLength(1);
    await removeItem(A, (await getMyCart(A)).items[0].itemId);
    await prisma.product.delete({ where: { id: p.id } });
  });
});

describe("odmowa dostępu w drugim profilu", () => {
  it("sesja Boba daje tożsamość Boba, nigdy Alice", async () => {
    const a = await newDevice(auth, A);
    const b = await newDevice(auth, B);
    expect(await whoAmI(auth, a.cookie)).toBe(A);
    expect(await whoAmI(auth, b.cookie)).toBe(B);
  });

  it("sfałszowane ciasteczka (cudzy token bez podpisu, zły podpis, token z innej sesji) są odrzucane", async () => {
    const a = await newDevice(auth, A);
    const ctx = await auth.$context;
    const name = ctx.authCookies.sessionToken.name;

    expect(await whoAmI(auth, `${name}=${a.token}`)).toBeNull(); // surowy token, brak podpisu
    expect(
      await whoAmI(
        auth,
        `${name}=${a.token}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%3D`,
      ),
    ).toBeNull(); // zły podpis
    const b = await newDevice(auth, B);
    const [, value] = b.cookie.split("=");
    expect(
      await whoAmI(auth, `${name}=${a.token}.${value.split(".")[1]}`),
    ).toBeNull(); // podpis Boba pod tokenem Alice
  });

  it("Bob (zalogowany) nie może zmienić ani usunąć pozycji koszyka Alice – ITEM_NOT_FOUND", async () => {
    const cat = await prisma.category.findUniqueOrThrow({
      where: { code: "cpu" },
    });
    const p = await prisma.product.create({
      data: {
        code: "SESS000002",
        name: "Cudzy",
        nameSortKey: "cudzy",
        description: "x",
        image: "/images/products/cpu.webp",
        price: 100,
        amount: 5,
        date: new Date("2026-01-01T00:00:00Z"),
        categoryId: cat.id,
      },
    });
    await addProduct(A, p.id);
    const aliceItem = (await getMyCart(A)).items[0];

    const bobCookie = (await newDevice(auth, B)).cookie;
    const bobId = (await whoAmI(auth, bobCookie))!; // tożsamość zawsze z sesji, nie z danych klienta
    await expect(setQuantity(bobId, aliceItem.itemId, 3)).rejects.toMatchObject(
      { code: "ITEM_NOT_FOUND" },
    );
    await expect(removeItem(bobId, aliceItem.itemId)).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
    expect((await getMyCart(A)).items[0].quantity).toBe(1);

    await removeItem(A, aliceItem.itemId);
    await prisma.product.delete({ where: { id: p.id } });
  });

  it("po unieważnieniu sesji Alice jej stare ciasteczko nie daje dostępu, a profil Boba działa", async () => {
    const a = await newDevice(auth, A);
    const b = await newDevice(auth, B);
    await auth.api.revokeSessions({ headers: hdr(a.cookie) });
    expect(await whoAmI(auth, a.cookie)).toBeNull();
    expect(await whoAmI(auth, b.cookie)).toBe(B);
  });
});

describe("wpływ cache sesji (cookieCache)", () => {
  // Druga instancja z włączonym cookieCache na tej samej bazie i z tym samym sekretem.
  const cached = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    session: { cookieCache: { enabled: true, maxAge: 300 } },
  }) as unknown as AuthLike;

  /** Pierwsze getSession wypełnia ciasteczko session_data; zwraca Cookie z oboma ciasteczkami. */
  async function warmCache(cookie: string) {
    const res = await cached.api.getSession({
      headers: hdr(cookie),
      returnHeaders: true,
    });
    expect(res.response?.user.id).toBeTruthy();
    const setCookies = res.headers.getSetCookie();
    const data = setCookies.find((c) => c.includes("session_data="));
    expect(data, "cookieCache powinien ustawić session_data").toBeDefined();
    return `${cookie}; ${data!.split(";")[0]}`;
  }

  it("konfiguracja aplikacji ma cookieCache wyłączony → unieważnienie działa natychmiast", () => {
    expect(auth.options.session?.cookieCache?.enabled).toBe(false);
  });

  it("z włączonym cache zwykły odczyt widzi unieważnioną sesję do wygaśnięcia cache, odczyt autorytatywny już nie", async () => {
    const d = await newDevice(cached, A);
    const warm = await warmCache(d.cookie);

    await prisma.session.deleteMany({ where: { token: d.token } }); // unieważnienie w bazie
    expect(await dbSessions(A)).toBe(0);

    // Stare dane z ciasteczka są nadal przyjmowane (do maxAge = 300 s) – to luka, którą wyłączamy.
    expect(await whoAmI(cached, warm)).toBe(A);
    // Odczyt z pominięciem cache (tak czytają endpointy wrażliwe) widzi prawdę.
    expect(await whoAmI(cached, warm, { disableCookieCache: true })).toBeNull();
  });

  it("endpointy wrażliwe (revokeSessions) odrzucają unieważnioną, ale ‘cache’owaną sesję nawet z włączonym cache", async () => {
    const d1 = await newDevice(cached, A);
    const d2 = await newDevice(cached, A);
    const warm2 = await warmCache(d2.cookie);

    await cached.api.revokeSessions({ headers: hdr(d1.cookie) });

    expect(await whoAmI(cached, warm2)).toBe(A); // zwykły odczyt: nadal „zalogowany” z cache
    await expect(
      cached.api.revokeSessions({ headers: hdr(warm2) }),
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });
});
