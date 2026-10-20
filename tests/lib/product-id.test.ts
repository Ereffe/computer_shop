import { describe, expect, it } from "vitest";
import { parseProductId } from "@/lib/products/product-id";

describe("parseProductId", () => {
  it.each([
    ["1", 1],
    ["100", 100],
    ["2147483647", 2147483647],
  ])("accepts %s", (raw, expected) => {
    expect(parseProductId(raw)).toBe(expected);
  });

  it.each([
    "",
    "0",
    "01",
    "-1",
    "+1",
    "1.5",
    "1e3",
    "abc",
    " 1",
    "1 ",
    "1\n",
    "１",
    "2147483648",
    "9007199254740993",
  ])("rejects %j", (raw) => {
    expect(parseProductId(raw)).toBeNull();
  });
});
