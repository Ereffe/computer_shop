import Image from "next/image";
import ImageModal from "@/components/ImageModal/ImageModal";
import { loadProduct } from "@/lib/products/load-product";

const ProductImageModal = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const product = await loadProduct(id);

  return (
    <ImageModal title={product.name}>
      <Image
        src={product.image}
        alt={product.name}
        width={900}
        height={600}
      />
    </ImageModal>
  );
};

export default ProductImageModal;
