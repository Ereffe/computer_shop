import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products/product-repository";
import { parseProductId } from "@/lib/products/product-id";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

const loadProduct = cache(async (rawId: string) => {
  const id = parseProductId(rawId);

  if (id === null) {
    notFound();
  }
  const product = await getProductById(id);

  if (product === null) {
    notFound();
  }

  return product;
});

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);

  return {
    title: `${product.name} | Katalog produktów`,
    description: product.description,
  };
}

const ProductDetailsPage = async ({ params }: ProductPageProps) => {
  const { id } = await params;
  const product = await loadProduct(id);

  const price = (product.price / 100).toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
  });

  const date = new Date(product.date).toLocaleDateString("pl-PL", {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <div className="product-details">
      <Link href="/product-list" className="product-details-back">
        Wróć do katalogu
      </Link>

      <article className="product-details-card">
        <div className="product-image">
          <Image
            src={product.image}
            alt={product.name}
            width={600}
            height={400}
            priority
          />
        </div>

        <div className="product-info">
          <span className="product-type">{product.type}</span>

          <h1>{product.name}</h1>

          <p className="product-description">{product.description}</p>

          <dl className="product-details-specs">
            <div>
              <dt>Kod produktu</dt>
              <dd>{product.code}</dd>
            </div>

            <div>
              <dt>Kategoria</dt>
              <dd>{product.type}</dd>
            </div>

            <div>
              <dt>Cena</dt>
              <dd className="product-price">{price}</dd>
            </div>

            <div>
              <dt>Stan magazynowy</dt>
              <dd
                className={`product-stock ${
                  product.amount === 0 ? "out-of-stock" : ""
                }`}
              >
                {product.amount === 0
                  ? "Brak w magazynie"
                  : `${product.amount} szt.`}
              </dd>
            </div>

            <div>
              <dt>Data</dt>
              <dd>
                <time dateTime={product.date}>{date}</time>
              </dd>
            </div>
          </dl>
        </div>
      </article>
    </div>
  );
};

export default ProductDetailsPage;
