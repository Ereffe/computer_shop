import Link from "next/link";

const ProductNotFound = () => {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <span className="not-found-code">404</span>

        <h1>Nie znaleziono produktu</h1>

        <p>Produkt o podanym identyfikatorze nie istnieje.</p>

        <Link href="/product-list" className="not-found-link">
          Wróć do katalogu produktów
        </Link>
      </div>
    </div>
  );
};

export default ProductNotFound;
