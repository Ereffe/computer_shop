import Image from "next/image";
import { getProducts } from "@/lib/products/product-repository";
import { Product } from "@/lib/products/product";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Products = async () => {
  await delay(2000);

  const productsList: Product[] = await getProducts({ sort: "name" });

  if (productsList.length === 0) {
    return <p>Katalog produktów jest obecnie pusty.</p>;
  }

  return (
    <div className="products">
      {productsList.map((product) => (
        <article className="product-card" key={product.id}>
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

            <p className="product-description">
              {product.description}
            </p>

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
        </article>
      ))}
    </div>
  );
};

const ProductListPage = () => {
  return (
    <div className="product-list">
      <div className="product-list-header">
        <h1>Katalog produktów</h1>
        <p>Znajdź odpowiednie podzespoły do swojego komputera.</p>
      </div>

      <Products />
    </div>
  );
};

export default ProductListPage;
