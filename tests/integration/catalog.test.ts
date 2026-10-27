import { beforeAll, describe, expect, it } from "vitest";
import { getFeaturedProducts, getProductById, getProducts } from "@/lib/products/product-repository";
import { productTypes } from "@/lib/products/product";
import { fixture, lab06Order, resetAndSeed } from "./helpers";

const ids = (s: { id: number }[]) => s.map((p) => p.id);
const src = fixture();

describe("katalog i szczegóły", () => {
  beforeAll(resetAndSeed);

  it("zwraca cały katalog w kolejności nazwy zgodnej z Lab 06", async () => {
    expect(ids(await getProducts({ sort: "name" }))).toEqual(ids(lab06Order.name(src)));
    expect(ids(await getProducts())).toEqual(ids(lab06Order.name(src)));
  });

  it("sortuje po dacie malejąco z remisem po id, zgodnie z Lab 06", async () => {
    expect(ids(await getProducts({ sort: "date" }))).toEqual(ids(lab06Order.date(src)));
  });

  it("łączy filtry kategorii, dostępności i sortowania", async () => {
    for (const type of productTypes) {
      for (const available of [true, false, undefined]) {
        for (const sort of ["name", "date"] as const) {
          const expected = lab06Order[sort](
            src.filter(
              (p) => p.type === type && (available === undefined || (available ? p.amount > 0 : p.amount === 0)),
            ),
          );
          expect(ids(await getProducts({ type, available, sort }))).toEqual(ids(expected));
        }
      }
    }
  });

  it("obsługuje stan zero: available=false zwraca tylko produkty z amount 0", async () => {
    const out = await getProducts({ available: false });
    expect(out.length).toBe(src.filter((p) => p.amount === 0).length);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.amount === 0)).toBe(true);
    expect((await getProducts({ available: true })).every((p) => p.amount > 0)).toBe(true);
  });

  it("zwraca puste tablice tylko gdy filtr naprawdę nic nie pasuje", async () => {
    const noStock = new Set(src.filter((p) => p.amount === 0).map((p) => p.type));
    const type = productTypes.find((t) => !noStock.has(t));
    if (type) expect(await getProducts({ type, available: false })).toEqual([]);
  });

  it("featured: 3 najnowsze dostępne", async () => {
    const expected = lab06Order.date(src.filter((p) => p.amount > 0)).slice(0, 3);
    expect(ids(await getFeaturedProducts())).toEqual(ids(expected));
  });

  it("szczegóły: zwraca dokładnie dane z zestawu", async () => {
    for (const p of [src[0], src[49], src[99]]) expect(await getProductById(p.id)).toEqual(p);
  });

  it("szczegóły: brak ID i nieprawidłowe ID dają null", async () => {
    for (const id of [101, 999999, 2147483647, 0, -1, 1.5, NaN, 2147483648]) {
      expect(await getProductById(id)).toBeNull();
    }
  });

  it("data zachowuje milisekundy", async () => {
    expect(src.some((p) => !p.date.endsWith(".000Z"))).toBe(true);
    const all = await getProducts();
    for (const p of all) expect(p.date).toBe(src.find((s) => s.id === p.id)!.date);
  });
});
