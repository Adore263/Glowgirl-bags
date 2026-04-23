import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { recordSale } from "@/lib/sales/record-sale";
import { saleCreateInputSchema } from "@/lib/validation";

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (token) {
      await getAdminAuth().verifyIdToken(token);
    }

    const body = await request.json();
    const input = saleCreateInputSchema.parse(body);
    const result = await recordSale(input);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
