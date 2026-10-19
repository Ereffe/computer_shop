import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { productTypes, type Product } from "@/lib/products/product";
import { parseCatalogSlug } from "@/lib/products/catalog-slug";
import {
  getProductById,
  getProducts,
} from "@/lib/products/product-repository";

const formatPrice = (price: number) =>
  (price / 100).toLocaleString("pl-PL", { style: "currency", currency: "PLN" });

const Stock = ({ amount }: { amount: number }) => (
  <span className={`product-stock ${amount === 0 ? "out-of-stock" : ""}`}>
    {amount === 0 ? "Brak w magazynie" : `${amount} szt.`}
  </span>
);

type CatalogViewProps = {
  basePath: string;
  slug?: string[];
};

const CatalogView = async ({ basePath, slug }: CatalogViewProps) => {
  const parsed = parseCatalogSlug(slug);

  if (parsed === null) {
    notFound();
  }

  if (parsed.kind === "root") {
    const all = await getProducts();
    const inType = (type: Product["type"]) =>
      all.filter((product) => product.type === type);

    return (
      <div className="product-list">
        <div className="product-list-header">
          <h1>Kategorie</h1>
          <p>Wybierz kategorię, aby zobaczyć jej produkty.</p>
        </div>

        <div className="products">
          {productTypes.map((type) => {
            const products = inType(type);

            return (
              <article className="product-card" key={type}>
                <Link href={`${basePath}/${type}`} className="product-card-link">
                  {products[0] && (
                    <div className="product-image">
                      <Image
                        src={products[0].image}
                        alt=""
                        width={300}
                        height={200}
                      />
                    </div>
                  )}

                  <div className="product-info">
                    <span className="product-type">{type}</span>
                    <h2>Produkty: {products.length}</h2>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  if (parsed.kind === "category") {
    const products = await getProducts({ type: parsed.type, sort: "name" });

    return (
      <div className="product-list">
        <div className="product-list-header">
          <Link href="/catalog" className="product-details-back">
            Wszystkie kategorie
          </Link>

          <h1>Kategoria: {parsed.type}</h1>
          <p>Produkty: {products.length}</p>
        </div>

        <div className="products">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <Link
                href={`${basePath}/${parsed.type}/${product.id}`}
                className="product-card-link"
              >
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

                  <div className="product-bottom">
                    <span className="product-price">
                      {formatPrice(product.price)}
                    </span>
                    <Stock amount={product.amount} />
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const product = await getProductById(parsed.id);

  if (product === null || product.type !== parsed.type) {
    notFound();
  }

  return (
    <div className="product-details">
      <Link href={`${basePath}/${parsed.type}`} className="product-details-back">
        Wróć do kategorii {parsed.type}
      </Link>

      <article className="product-details-card">
        <div className="product-image">
          <Image
            src={product.image}
            alt={product.name}
            width={600}
            height={400}
          />
        </div>

        <div className="product-info">
          <span className="product-type">{product.type}</span>
          <h1>{product.name}</h1>

          <p className="product-description">{product.description}</p>

          <div className="product-bottom">
            <span className="product-price">{formatPrice(product.price)}</span>
            <Stock amount={product.amount} />
          </div>

          <Link
            href={`/product-list/${product.id}`}
            className="catalog-button catalog-details-link"
          >
            Pełne szczegóły produktu
          </Link>
        </div>
      </article>
    </div>
  );
};

export default CatalogView;
