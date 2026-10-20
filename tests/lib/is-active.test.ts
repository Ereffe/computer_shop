import { describe, expect, it } from "vitest";
import { isActive } from "@/lib/navigation/is-active";

describe("getActiveState", () => {
  it("rozpoznaje stronę główną tylko dokładnie", () => {
    expect(isActive("/", "/", "exact")).toBe("page");
    expect(isActive("/product-list", "/", "exact")).toBeNull();
    expect(isActive("/about", "/")).toBeNull();
  });

  it("oznacza katalog jako stronę na /product-list", () => {
    expect(isActive("/product-list", "/product-list")).toBe("page");
    expect(isActive("/product-list/", "/product-list")).toBe("page");
  });

  it("oznacza katalog jako sekcję na stronie produktu", () => {
    expect(isActive("/product-list/12", "/product-list")).toBe("section");
  });

  it("nie dopasowuje ścieżek o podobnym prefiksie", () => {
    expect(isActive("/product-list-old", "/product-list")).toBeNull();
    expect(isActive("/product-listing/1", "/product-list")).toBeNull();
    expect(isActive("/product-listx", "/product-list")).toBeNull();
  });

  it("nie dopasowuje innych sekcji", () => {
    expect(isActive("/basket", "/product-list")).toBeNull();
    expect(isActive(null, "/product-list")).toBeNull();
  });
});
