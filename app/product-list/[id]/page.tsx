import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { loadProduct } from "@/lib/products/load-product";
import { connection } from "next/server";
import AddToCartButton from "@/components/Basket/AddToCartButton";

// import { getFeaturedProducts } from "@/lib/products/product-repository";

// export async function generateStaticParams() {
//   const featured = await getFeaturedProducts();
//   return featured.map((product) => ({ id: String(product.id) }));
// }

// export const dynamicParams = true;
export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};


const specRow =
  "flex items-baseline justify-between gap-4 border-t border-stone py-3.5";
const specTerm = "text-sm text-stone";
const specValue =
  "text-right text-[15px] font-semibold text-chalk [overflow-wrap:anywhere]";

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  await connection();
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
    <div className="mx-auto max-w-[1100px] px-4 py-9 sm:px-6 sm:py-[50px]">
      <Link
        href="/product-list"
        className="mb-6 inline-block text-[15px] font-semibold text-paper hover:underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-paper"
      >
        Wróć do katalogu
      </Link>

      <article className="grid grid-cols-1 overflow-hidden rounded border border-stone bg-ink shadow-[0_0_20px_rgba(24,24,23,0.35)] md:grid-cols-2">
        <Link
          href={`/product-list/${product.id}/image`}
          className="flex min-h-60 cursor-zoom-in items-center justify-center bg-stone p-6 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-paper md:min-h-80 md:p-8"
          aria-label={`Powiększ zdjęcie: ${product.name}`}
          scroll={false}
        >
          <Image
            src={product.image}
            alt={product.name}
            width={600}
            height={400}
            priority
            className="h-auto w-full max-w-[600px] object-contain"
          />
        </Link>

        <div className="flex flex-col p-6 md:p-10">
          <span className="mb-2 self-start rounded bg-stone px-2.5 py-1 text-xs font-bold uppercase text-ink">
            {product.type}
          </span>

          <h1 className="mb-3.5 text-2xl leading-snug font-bold text-paper md:text-3xl">
            {product.name}
          </h1>

          <p className="mb-7 text-base leading-[1.7] text-stone">
            {product.description}
          </p>

          <dl>
            <div className={specRow}>
              <dt className={specTerm}>Kod produktu</dt>
              <dd className={specValue}>{product.code}</dd>
            </div>

            <div className={specRow}>
              <dt className={specTerm}>Kategoria</dt>
              <dd className={specValue}>{product.type}</dd>
            </div>

            <div className={specRow}>
              <dt className={specTerm}>Cena</dt>
              <dd className="text-right text-[26px] font-bold text-paper">
                {price}
              </dd>
            </div>

            <div className={specRow}>
              <dt className={specTerm}>Stan magazynowy</dt>
              <dd
                className={`text-right text-[15px] font-semibold ${
                  product.amount === 0 ? "text-brand" : "text-chalk"
                }`}
              >
                {product.amount === 0
                  ? "Brak w magazynie"
                  : `${product.amount} szt.`}
              </dd>
            </div>

            <div className={specRow}>
              <dt className={specTerm}>Data</dt>
              <dd className={specValue}>
                <time dateTime={product.date}>{date}</time>
              </dd>
            </div>
          </dl>

          {product.amount > 0 && (
            <div className="mt-6">
              <AddToCartButton productId={product.id} />
            </div>
          )}
        </div>
      </article>
    </div>
  );
};

export default ProductDetailsPage;
