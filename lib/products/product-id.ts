export const MAX_PRODUCT_ID = 2147483647;

export function parseProductId(raw: string): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_PRODUCT_ID) {
    return null;
  }

  return id;
}
