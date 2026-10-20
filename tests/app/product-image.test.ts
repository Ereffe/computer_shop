import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Product } from "@/lib/products/product";
import ProductImagePage, {
  generateMetadata,
} from "@/app/product-list/[id]/image/page";
import ProductImageModal from "@/app/product-list/@modal/(.)[id]/image/page";
import ModalOnCatalog from "@/app/product-list/@modal/page";
import ModalOnOtherPages from "@/app/product-list/@modal/[...rest]/page";
import ModalDefault from "@/app/product-list/@modal/default";

const { NotFoundSignal, getProductById } = vi.hoisted(() => ({
  NotFoundSignal: class NotFoundSignal extends Error {},
  getProductById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ back: vi.fn() }),
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

describe("ProductImagePage (full page)", () => {
  it("renders the image with a link back to the product", async () => {
    getProductById.mockResolvedValue(product);

    const html = renderToStaticMarkup(await ProductImagePage(paramsFor("7")));

    expect(html).toContain('src="/images/products/cpu.webp"');
    expect(html).toContain('href="/product-list/7"');
    expect(html).not.toContain("<dialog");
  });

  it("builds metadata from the repository product", async () => {
    getProductById.mockResolvedValue(product);

    expect(await generateMetadata(paramsFor("7"))).toEqual({
      title: "Zdjęcie: AMD Ryzen 5 | Katalog produktów",
    });
  });

  it("returns not-found for malformed ids and for a missing product", async () => {
    getProductById.mockResolvedValue(null);

    expect(await outcome(ProductImagePage(paramsFor("01")))).toBeInstanceOf(
      NotFoundSignal,
    );
    expect(getProductById).not.toHaveBeenCalled();

    expect(await outcome(ProductImagePage(paramsFor("101")))).toBeInstanceOf(
      NotFoundSignal,
    );
  });

  it("propagates a repository failure", async () => {
    getProductById.mockRejectedValue(new Error("repo down"));

    const error = await outcome(ProductImagePage(paramsFor("7")));

    expect(error).not.toBeInstanceOf(NotFoundSignal);
    expect((error as Error).message).toBe("repo down");
  });
});

describe("@modal slot", () => {
  it("renders the intercepted image inside a labelled dialog", async () => {
    getProductById.mockResolvedValue(product);

    const html = renderToStaticMarkup(await ProductImageModal(paramsFor("7")));

    expect(html).toContain("<dialog");
    expect(html).toContain('aria-labelledby="image-modal-title"');
    expect(html).toContain("AMD Ryzen 5");
    expect(html).toContain("Zamknij");
    expect(html).toContain('src="/images/products/cpu.webp"');
  });

  it("propagates a repository failure instead of hiding the modal", async () => {
    getProductById.mockRejectedValue(new Error("repo down"));

    const error = await outcome(ProductImageModal(paramsFor("7")));

    expect(error).not.toBeInstanceOf(NotFoundSignal);
  });

  it("is empty on the catalog, on other pages and as a default", () => {
    expect(ModalOnCatalog()).toBeNull();
    expect(ModalOnOtherPages()).toBeNull();
    expect(ModalDefault()).toBeNull();
  });
});
