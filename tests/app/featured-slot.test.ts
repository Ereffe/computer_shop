import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Product } from "@/lib/products/product";
import FeaturedPanel from "@/app/product-list/@featured/page";
import FeaturedOnProductPage from "@/app/product-list/@featured/[id]/page";
import FeaturedDefault from "@/app/product-list/@featured/default";

const { getFeaturedProducts } = vi.hoisted(() => ({
  getFeaturedProducts: vi.fn(),
}));

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: { href: string; children?: ReactNode } & Record<string, unknown>) =>
      createElement("a", { href, ...rest }, children),
  };
});

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) =>
      createElement("img", { src, alt }),
  };
});

vi.mock("@/lib/products/product-repository", () => ({ getFeaturedProducts }));

const make = (id: number, name: string): Product => ({
  id,
  code: `CODE${String(id).padStart(6, "0")}`,
  name,
  type: "gpu",
  price: 249900,
  amount: 3,
  description: "Opis",
  date: "2026-05-01T00:00:00Z",
  image: "/images/products/gpu.webp",
});

beforeEach(() => {
  getFeaturedProducts.mockReset();
});

describe("@featured slot", () => {
  it("renders featured products as links to their details", async () => {
    getFeaturedProducts.mockResolvedValue([
      make(12, "RTX 1"),
      make(4, "RTX 2"),
      make(9, "RTX 3"),
    ]);

    const html = renderToStaticMarkup(await FeaturedPanel());

    expect(html).toContain("Polecane");
    expect(html.match(/href="\/product-list\/\d+"/g)).toEqual([
      'href="/product-list/12"',
      'href="/product-list/4"',
      'href="/product-list/9"',
    ]);
  });

  it("renders nothing when there are no featured products", async () => {
    getFeaturedProducts.mockResolvedValue([]);

    expect(await FeaturedPanel()).toBeNull();
  });

  it("propagates a repository failure", async () => {
    getFeaturedProducts.mockRejectedValue(new Error("repo down"));

    await expect(FeaturedPanel()).rejects.toThrow("repo down");
  });

  it("is empty on the product page and as a default", () => {
    expect(FeaturedOnProductPage()).toBeNull();
    expect(FeaturedDefault()).toBeNull();
  });
});
