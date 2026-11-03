import { expect, test, type BrowserContext } from "@playwright/test";
import { serializeSignedCookie } from "better-call";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_AUTH_SECRET, E2E_DB_URL, E2E_ORIGIN } from "./env";

const PRODUCT_ID = 1; // Intel Core i5, stan 11 szt.
const PRODUCT_NAME = "Intel Core i5";
const COOKIE_NAME = "better-auth.session_token"; // http => bez prefiksu __Secure-

async function db<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: E2E_DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Zakłada użytkownika i sesję w bazie testowej oraz zwraca cookie, jakie wysłałaby przeglądarka. */
async function loginAs(context: BrowserContext, userId: string) {
  const token = randomUUID().replaceAll("-", "");
  await db(async (c) => {
    await c.query(
      `insert into "user" (id, name, email, "emailVerified", "updatedAt")
       values ($1, $1, $1 || '@example.test', true, now()) on conflict (id) do nothing`,
      [userId],
    );
    await c.query(
      `insert into session (id, token, "expiresAt", "updatedAt", "userId")
       values ($1, $2, now() + interval '1 hour', now(), $3)`,
      [randomUUID(), token, userId],
    );
  });
  const signed = await serializeSignedCookie(COOKIE_NAME, token, E2E_AUTH_SECRET);
  const value = signed.split(";")[0].slice(COOKIE_NAME.length + 1);
  await context.addCookies([{ name: COOKIE_NAME, value, url: E2E_ORIGIN }]);
}

const cartRows = (userId: string) =>
  db(async (c) =>
    (
      await c.query<{ productId: number; quantity: number }>(
        `select ci."productId", ci.quantity from cart_items ci
         join carts k on k.id = ci."cartId" where k."userId" = $1 order by ci.id`,
        [userId],
      )
    ).rows,
  );

test("bez sesji: koszyk i zapis są odrzucone", async ({ page, request }) => {
  await page.goto("/basket");
  await expect(page.getByText("Zaloguj się, aby zobaczyć swój koszyk.")).toBeVisible();

  const post = await request.post("/api/cart/items", { data: { productId: PRODUCT_ID, quantity: 1 } });
  expect(post.status()).toBe(401);
  expect((await request.get("/api/cart")).status()).toBe(401);
  expect((await request.patch("/api/cart/items/1", { data: { quantity: 2 } })).status()).toBe(401);
  expect((await request.delete("/api/cart/items/1")).status()).toBe(401);
});

test("dodanie, zmiana ilości i usunięcie pozycji", async ({ page, context }) => {
  const user = "e2e-alice";
  await loginAs(context, user);

  await page.goto(`/product-list/${PRODUCT_ID}`);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(page.getByText("Dodano do koszyka.")).toBeVisible();
  await expect.poll(() => cartRows(user)).toEqual([{ productId: PRODUCT_ID, quantity: 1 }]);

  await page.goto("/basket");
  await expect(page.getByText(PRODUCT_NAME)).toBeVisible();

  await page.getByRole("spinbutton").fill("3");
  await expect.poll(() => cartRows(user)).toEqual([{ productId: PRODUCT_ID, quantity: 3 }]);

  await page.getByRole("button", { name: "Usuń" }).click();
  await expect(page.getByText("Koszyk jest pusty.")).toBeVisible();
  await expect.poll(() => cartRows(user)).toEqual([]);
});

test("ilość poza zakresem jest odrzucona, a koszyk drugiego użytkownika jest pusty", async ({
  page,
  context,
  browser,
}) => {
  const alice = "e2e-alice-2";
  await loginAs(context, alice);
  await page.goto(`/product-list/${PRODUCT_ID}`);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await expect(page.getByText("Dodano do koszyka.")).toBeVisible();

  await page.goto("/basket");
  await page.getByRole("spinbutton").fill("100");
  await expect(page.getByText("Ilość musi wynosić od 1 do 99.")).toBeVisible();
  expect(await cartRows(alice)).toEqual([{ productId: PRODUCT_ID, quantity: 1 }]);

  const bobContext = await browser.newContext();
  await loginAs(bobContext, "e2e-bob");
  const bob = await bobContext.newPage();
  await bob.goto("/basket");
  await expect(bob.getByText("Koszyk jest pusty.")).toBeVisible();
  await bobContext.close();
});
