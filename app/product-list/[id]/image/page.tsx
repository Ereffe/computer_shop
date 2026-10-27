import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { loadProduct } from "@/lib/products/load-product";
import { connection } from "next/server";

type ProductImagePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ProductImagePageProps): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const product = await loadProduct(id);

  return {
    title: `Zdjęcie: ${product.name} | Katalog produktów`,
  };
}

const ProductImagePage = async ({ params }: ProductImagePageProps) => {
  const { id } = await params;
  const product = await loadProduct(id);

  return (
    <div className="product-details">
      <Link
        href={`/product-list/${product.id}`}
        className="product-details-back"
      >
        Wróć do produktu
      </Link>

      <h1 className="product-image-title">{product.name}</h1>

      <div className="fullscreen-image">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 1100px) 100vw, 1100px"
          priority
        />
      </div>
    </div>
  );
};

export default ProductImagePage;
