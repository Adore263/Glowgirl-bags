import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ barcode: string }> },
) {
  try {
    const { barcode } = await context.params;
    const storeId = request.nextUrl.searchParams.get("storeId") ?? "default";

    if (!barcode) {
      return NextResponse.json({ error: "Missing barcode." }, { status: 400 });
    }

    const productRef = getAdminDb()
      .collection("stores")
      .doc(storeId)
      .collection("products")
      .doc(barcode);

    const product = await productRef.get();

    if (!product.exists) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...product.data(),
      barcode: String(barcode),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
