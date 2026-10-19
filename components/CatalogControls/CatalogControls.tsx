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

const field = "flex w-full flex-col gap-1.5 sm:w-auto";
const label = "text-[13px] font-semibold text-paper";
const select =
  "min-w-[180px] rounded border border-stone bg-ink px-3 py-2.5 text-sm text-paper focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-paper";

const CatalogControls = ({ settings }: { settings: CatalogSettings }) => {
  return (
    <form
      key={`${settings.type}|${settings.stock}|${settings.sort}`}
      className="mx-auto mb-6 flex max-w-[1200px] flex-wrap items-end gap-4"
      method="get"
      action={CATALOG_PATH}
    >
      <div className={field}>
        <label className={label} htmlFor="catalog-type">
          Kategoria
        </label>
        <select
          className={select}
          id="catalog-type"
          name="type"
          defaultValue={settings.type}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={label} htmlFor="catalog-stock">
          Dostępność
        </label>
        <select
          className={select}
          id="catalog-stock"
          name="stock"
          defaultValue={settings.stock}
        >
          {stockOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={field}>
        <label className={label} htmlFor="catalog-sort">
          Kolejność
        </label>
        <select
          className={select}
          id="catalog-sort"
          name="sort"
          defaultValue={settings.sort}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="cursor-pointer rounded bg-stone px-5 py-[11px] text-sm font-bold text-ink hover:bg-paper focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-paper"
        >
          Zastosuj
        </button>

        <Link
          href={CATALOG_PATH}
          className="text-sm font-semibold text-paper underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-paper"
        >
          Wyczyść filtry
        </Link>
      </div>
    </form>
  );
};

export default CatalogControls;
