import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Product } from "@/lib/products/product";
import ProductDetailsPage, {
  generateMetadata,
  dynamic,
} from "@/app/product-list/[id]/page";

const { NotFoundSignal, getProductById } = vi.hoisted(() => ({
  NotFoundSignal: class NotFoundSignal extends Error {},
  getProductById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
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

vi.mock("@/lib/products/product-repository", () => ({ getProductById }));

const product: Product = {
  id: 7,
  code: "00007JU9ND",
  name: "AMD Ryzen 5",
  type: "cpu",
  price: 165693,
  amount: 10,
  description: "Wydajny procesor.",
  date: "2026-09-26T22:33:46.850Z",
  image: "/images/products/cpu.webp",
};

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  );

beforeEach(() => {
  getProductById.mockReset();
});

describe("generateMetadata", () => {
  it("builds metadata from the repository product", async () => {
    getProductById.mockResolvedValue(product);

    expect(await generateMetadata(paramsFor("7"))).toEqual({
      title: "AMD Ryzen 5 | Katalog produktów",
      description: "Wydajny procesor.",
    });
    expect(getProductById).toHaveBeenCalledWith(7);
  });

  it("returns not-found for a malformed id without querying the repository", async () => {
    expect(await outcome(generateMetadata(paramsFor("abc")))).toBeInstanceOf(
      NotFoundSignal,
    );
    expect(getProductById).not.toHaveBeenCalled();
  });

  it("returns not-found for a missing product", async () => {
    getProductById.mockResolvedValue(null);

    expect(await outcome(generateMetadata(paramsFor("101")))).toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("propagates a repository failure and does not pretend the product is missing", async () => {
    getProductById.mockRejectedValue(new Error("repo down"));

    const error = await outcome(generateMetadata(paramsFor("7")));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFoundSignal);
    expect((error as Error).message).toBe("repo down");
  });
});

describe("ProductDetailsPage", () => {
  it("renders the product with a link back to the catalog", async () => {
    getProductById.mockResolvedValue(product);

    const html = renderToStaticMarkup(await ProductDetailsPage(paramsFor("7")));

    expect(html).toContain("AMD Ryzen 5");
    expect(html).toContain('href="/product-list"');
    expect(html).toContain("Wróć do katalogu");
    expect(html).toContain('href="/product-list/7/image"');
    expect(html).toContain('aria-label="Powiększ zdjęcie: AMD Ryzen 5"');
  });

  it("returns not-found for malformed ids and for a missing product", async () => {
    getProductById.mockResolvedValue(null);

    expect(await outcome(ProductDetailsPage(paramsFor("0")))).toBeInstanceOf(
      NotFoundSignal,
    );
    expect(getProductById).not.toHaveBeenCalled();

    expect(await outcome(ProductDetailsPage(paramsFor("101")))).toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("propagates a repository failure and does not pretend the product is missing", async () => {
    getProductById.mockRejectedValue(new Error("repo down"));

    const error = await outcome(ProductDetailsPage(paramsFor("7")));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFoundSignal);
    expect((error as Error).message).toBe("repo down");
  });
});

describe("route config", () => {
  it("renders on every request instead of prerendering", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
