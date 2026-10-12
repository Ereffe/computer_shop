import Link from "next/link";
import Image from "next/image";
import "./Header.css";

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <Link href="/" className="logo">
          <Image src="/politechnika-krakowska-logo.svg" alt="Logo" width={50} height={50} />
        </Link>

        <nav>
          <ul className="nav-list">
            <li>
              <Link href="/" className="nav-link">
                Strona główna
              </Link>
            </li>

            <li>
              <Link href="/product-list" className="nav-link">
                Lista produktów
              </Link>
            </li>

            <li>
              <Link href="/order-history" className="nav-link">
                Historia zamówień
              </Link>
            </li>

            <li>
              <Link href="/basket" className="nav-link">
                Koszyk
              </Link>
            </li>

            <li>
              <Link href="/about" className="nav-link">
                O nas
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
