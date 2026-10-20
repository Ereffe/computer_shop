import Image from "next/image";
import Link from "next/link";
import { getFeaturedProducts } from "@/lib/products/product-repository";
import type { Product } from "@/lib/products/product";

const FeaturedPanel = async () => {
  const featuredList: Product[] = await getFeaturedProducts();

  if (featuredList.length === 0) {
    return null;
  }

  return (
    <aside className="featured" aria-labelledby="featured-heading">
      <h2 id="featured-heading">Polecane</h2>

      <ul className="featured-list">
        {featuredList.map((product) => (
          <li key={product.id}>
            <Link
              href={`/product-list/${product.id}`}
              className="featured-card"
            >
              <div className="featured-image">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={120}
                  height={80}
                />
              </div>

              <div className="featured-info">
                <span className="product-type">{product.type}</span>

                <h3>{product.name}</h3>

                <span className="product-price">
                  {(product.price / 100).toLocaleString("pl-PL", {
                    style: "currency",
                    currency: "PLN",
                  })}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default FeaturedPanel;
