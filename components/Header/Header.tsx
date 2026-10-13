import Link from "next/link";
import Image from "next/image";
import "./Header.css";
import NavLink from "./NavLink";

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <Link href="/" className="logo">
          <Image
            src="/politechnika-krakowska-logo.svg"
            alt="Logo"
            width={50}
            height={50}
          />
        </Link>

        <nav>
          <ul className="nav-list">
            <li>
              <NavLink href="/">Strona główna</NavLink>
            </li>

            <li>
              <NavLink href="/product-list">Lista produktów</NavLink>
            </li>

            <li>
              <NavLink href="/order-history">Historia zamówień</NavLink>
            </li>

            <li>
              <NavLink href="/basket">Koszyk</NavLink>
            </li>

            <li>
              <NavLink href="/about">O nas</NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
