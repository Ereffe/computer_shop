import Link from "next/link";

const NotFound = () => {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <span className="not-found-code">404</span>

        <h1>Strona nie została znaleziona</h1>

        <p>
          Nie znaleziono strony, której szukasz.
        </p>

        <Link href="/" className="not-found-link">
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
