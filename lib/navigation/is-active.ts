export type NavMatch = "exact" | "section";
export type ActiveState = "page" | "section" | "null";

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isActive(
  pathname: string | null,
  href: string,
  match: NavMatch = "section",
) {
  if (pathname === null) return null;

  const current = normalize(pathname);
  const target = normalize(href);

  if (current === target) return "page";
  if (match === "exact" || target === "/") return null;

  return current.startsWith(`${target}/`) ? "section" : null;
}
