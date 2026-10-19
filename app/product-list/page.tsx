import Image from "next/image";
import Link from "next/link";
import CatalogControls from "@/components/CatalogControls/CatalogControls";
import { getProducts } from "@/lib/products/product-repository";
import type { Product } from "@/lib/products/product";
import {
  CATALOG_PATH,
  defaultCatalogSettings,
  parseCatalogSearchParams,
  toCatalogCriteria,
  type CatalogParam,
  type CatalogSettings,
  type RawSearchParams,
} from "@/lib/products/catalog-params";

const paramLabels: Record<CatalogParam, string> = {
  type: "kategoria",
  stock: "dostępność",
  sort: "kolejność",
};

const isDefault = (settings: CatalogSettings) =>
  settings.type === defaultCatalogSettings.type &&
  settings.stock === defaultCatalogSettings.stock &&
  settings.sort === defaultCatalogSettings.sort;

const Products = async ({ settings }: { settings: CatalogSettings }) => {
  const productsList: Product[] = await getProducts(
    toCatalogCriteria(settings),
  );

  if (productsList.length === 0) {
    return (
      <output className="mx-auto my-10 block max-w-[600px] rounded bg-ink p-8 text-center">
        <p className="mb-4 text-stone">
          {isDefault(settings)
            ? "Katalog produktów jest obecnie pusty."
            : "Żaden produkt nie spełnia wybranych kryteriów."}
        </p>

        {!isDefault(settings) && (
          <Link
            href={CATALOG_PATH}
            className="text-sm font-semibold text-paper underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-paper"
          >
            Wyczyść filtry
          </Link>
        )}
      </output>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {productsList.map((product) => (
        <article
          className="overflow-hidden rounded border border-stone bg-ink shadow-[0_0_10px_rgba(24,24,23,0.3)] transition hover:-translate-y-1 hover:shadow-[0_0_18px_rgba(24,24,23,0.5)]"
          key={product.id}
        >
          <Link
            href={`/product-list/${product.id}/image`}
            className="flex h-[220px] cursor-zoom-in items-center justify-center bg-stone p-5 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-paper sm:h-[200px]"
            aria-label={`Powiększ zdjęcie: ${product.name}`}
            scroll={false}
          >
            <Image
              src={product.image}
              alt={product.name}
              width={300}
              height={200}
              className="h-auto max-w-full object-contain"
            />
          </Link>

          <Link
            href={`/product-list/${product.id}`}
            className="block focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-paper"
          >
            <div className="p-5">
              <span className="mb-2 inline-block rounded bg-stone px-2.5 py-1 text-xs font-bold uppercase text-ink">
                {product.type}
              </span>

              <h2 className="mb-2.5 text-[19px] font-semibold text-paper">
                {product.name}
              </h2>

              <p className="mb-5 min-h-12 text-sm leading-relaxed text-stone">
                {product.description}
              </p>

              <div className="flex items-center justify-between border-t border-stone pt-4">
                <span className="text-xl font-bold text-paper">
                  {(product.price / 100).toLocaleString("pl-PL", {
                    style: "currency",
                    currency: "PLN",
                  })}
                </span>

                <span
                  className={`text-[13px] font-semibold ${
                    product.amount === 0 ? "text-brand" : "text-chalk"
                  }`}
                >
                  {product.amount === 0
                    ? "Brak w magazynie"
                    : `${product.amount} szt.`}
                </span>
              </div>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
};

const ProductListPage = async ({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) => {
  const { settings, invalid } = parseCatalogSearchParams(await searchParams);

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-9 sm:px-6 sm:py-[50px]">
      <div className="mx-auto mb-10 max-w-[1200px] text-center">
        <h1 className="mb-2.5 text-3xl font-bold text-paper sm:text-4xl">
          Katalog produktów
        </h1>
        <p className="text-[17px] text-stone">
          Znajdź odpowiednie podzespoły do swojego komputera.
        </p>
      </div>

      <CatalogControls settings={settings} />

      {invalid.length > 0 && (
        <output className="mx-auto mb-6 block max-w-[1200px] rounded border border-stone bg-ink px-4 py-3 text-sm text-paper">
          Pominięto błędne ustawienia (
          {invalid.map((p) => paramLabels[p]).join(", ")}). Użyto wartości
          domyślnych.
        </output>
      )}

      <Products settings={settings} />
    </div>
  );
};

export default ProductListPage;
