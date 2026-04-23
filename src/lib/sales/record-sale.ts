import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { SaleCreateInput, SaleCreateResult, SaleLineResolved } from "@/lib/types";
import { saleCreateInputSchema } from "@/lib/validation";

export async function recordSale(payload: SaleCreateInput): Promise<SaleCreateResult> {
  const input = saleCreateInputSchema.parse(payload);
  const db = getAdminDb();

  const productsRef = db.collection("stores").doc(input.storeId).collection("products");

  const uniqueBarcodes = [...new Set(input.items.map((item) => item.barcode))];
  const productRefs = uniqueBarcodes.map((barcode) => productsRef.doc(barcode));
  const productSnapshots = await db.getAll(...productRefs);

  const productMap = new Map<string, FirebaseFirestore.DocumentData>();

  for (const snapshot of productSnapshots) {
    if (snapshot.exists) {
      productMap.set(snapshot.id, snapshot.data()!);
    }
  }

  const lines: SaleLineResolved[] = [];
  let subtotal = 0;
  let weightedTax = 0;

  for (const item of input.items) {
    const product = productMap.get(item.barcode);

    if (!product || !product.active) {
      throw new Error(`Product ${item.barcode} is missing or inactive.`);
    }

    const unitPrice = Number(product.price ?? 0);
    const taxRate = Number(product.taxRate ?? 0);
    const lineTotal = Number((unitPrice * item.qty).toFixed(2));

    subtotal += lineTotal;
    weightedTax += lineTotal * taxRate;

    lines.push({
      barcode: item.barcode,
      name: String(product.name ?? "Unknown"),
      qty: item.qty,
      unitPrice,
      lineTotal,
    });
  }

  const roundedSubtotal = Number(subtotal.toFixed(2));
  const taxTotal = Number(weightedTax.toFixed(2));
  const grandTotal = Number((roundedSubtotal + taxTotal).toFixed(2));
  const currency = String(productMap.values().next().value?.currency ?? "USD");

  const saleRef = db.collection("stores").doc(input.storeId).collection("sales").doc();

  await db.runTransaction(async (tx) => {
    tx.create(saleRef, {
      saleId: saleRef.id,
      storeId: input.storeId,
      cashierLabel: input.cashierLabel,
      items: lines,
      subtotal: roundedSubtotal,
      taxTotal,
      grandTotal,
      currency,
      createdAt: FieldValue.serverTimestamp(),
      source: "web-scan",
    });

    for (const line of lines) {
      const productRef = productsRef.doc(line.barcode);
      tx.update(productRef, {
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return {
    saleId: saleRef.id,
    subtotal: roundedSubtotal,
    taxTotal,
    grandTotal,
    currency,
  };
}
