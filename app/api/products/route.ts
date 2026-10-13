import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/products/product-repository";
import { parseProductQuery } from "@/lib/products/product-query";

export async function GET(request: NextRequest) {
  const parsed = parseProductQuery(request.nextUrl.searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.issues.map((issue) => ({
          parameter: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const products = await getProducts(parsed.data);
  return NextResponse.json(products);
}
