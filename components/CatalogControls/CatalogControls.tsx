import Link from "next/link";
import {
  CATALOG_PATH,
  type CatalogSettings,
} from "@/lib/products/catalog-params";

const typeOptions = [
  { value: "all", label: "Wszystkie" },
  { value: "cpu", label: "Procesory" },
  { value: "gpu", label: "Karty graficzne" },
  { value: "ram", label: "Pamięci RAM" },
  { value: "disk", label: "Dyski" },
] as const;

const stockOptions = [
  { value: "all", label: "Wszystkie" },
  { value: "available", label: "Dostępne" },
  { value: "unavailable", label: "Niedostępne" },
] as const;

const sortOptions = [
  { value: "name", label: "Nazwa (A–Z)" },
  { value: "newest", label: "Najnowsze" },
] as const;

const CatalogControls = ({ settings }: { settings: CatalogSettings }) => {
  return (
    <form
      key={`${settings.type}|${settings.stock}|${settings.sort}`}
      className="catalog-filters"
      method="get"
      action={CATALOG_PATH}
    >
      <div className="catalog-field">
        <label htmlFor="catalog-type">Kategoria</label>
        <select id="catalog-type" name="type" defaultValue={settings.type}>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="catalog-field">
        <label htmlFor="catalog-stock">Dostępność</label>
        <select id="catalog-stock" name="stock" defaultValue={settings.stock}>
          {stockOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="catalog-field">
        <label htmlFor="catalog-sort">Kolejność</label>
        <select id="catalog-sort" name="sort" defaultValue={settings.sort}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="catalog-actions">
        <button type="submit" className="catalog-button">
          Zastosuj
        </button>

        <Link href={CATALOG_PATH} className="catalog-clear">
          Wyczyść filtry
        </Link>
      </div>
    </form>
  );
};

export default CatalogControls;
