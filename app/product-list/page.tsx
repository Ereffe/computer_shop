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
      <output className="catalog-empty">
        <p>
          {isDefault(settings)
            ? "Katalog produktów jest obecnie pusty."
            : "Żaden produkt nie spełnia wybranych kryteriów."}
        </p>

        {!isDefault(settings) && (
          <Link href={CATALOG_PATH} className="catalog-clear">
            Wyczyść filtry
          </Link>
        )}
      </output>
    );
  }

  return (
    <div className="products">
      {productsList.map((product) => (
        <article className="product-card" key={product.id}>
          <Link href={`/product-list/${product.id}`}>
            <div className="product-image">
              <Image
                src={product.image}
                alt={product.name}
                width={300}
                height={200}
              />
            </div>

            <div className="product-info">
              <span className="product-type">{product.type}</span>

              <h2>{product.name}</h2>

              <p className="product-description">{product.description}</p>

              <div className="product-bottom">
                <span className="product-price">
                  {(product.price / 100).toLocaleString("pl-PL", {
                    style: "currency",
                    currency: "PLN",
                  })}
                </span>

                <span
                  className={`product-stock ${
                    product.amount === 0 ? "out-of-stock" : ""
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
    <div className="product-list">
      <div className="product-list-header">
        <h1>Katalog produktów</h1>
        <p>Znajdź odpowiednie podzespoły do swojego komputera.</p>
      </div>

      <CatalogControls settings={settings} />

      {invalid.length > 0 && (
        <output className="catalog-notice">
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
