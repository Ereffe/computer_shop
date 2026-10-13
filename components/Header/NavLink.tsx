"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, type NavMatch } from "@/lib/navigation/is-active";

type NavLinkProps = {
  href: string;
  match?: NavMatch;
  children: React.ReactNode;
};

const checkState = (state: unknown) => {
  return state === "section" ? "true" : undefined;
};
const NavLink = ({ href, match = "section", children }: NavLinkProps) => {
  const pathname = usePathname();
  const state = isActive(pathname, href, match);

  return (
    <Link
      href={href}
      className={state ? "nav-link nav-link--active" : "nav-link"}
      aria-current={state === "page" ? "page" : checkState(state)}
    >
      {children}
    </Link>
  );
};

export default NavLink;
