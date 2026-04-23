import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();

function saleDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const aggregateDailySales = onDocumentCreated(
  "stores/{storeId}/sales/{saleId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const sale = snapshot.data();
    const storeId = event.params.storeId;
    const createdAt = sale.createdAt?.toDate?.() ?? new Date();
    const day = saleDateKey(createdAt);

    const metricRef = db.collection("stores").doc(storeId).collection("metrics").doc(`daily_${day}`);

    await metricRef.set(
      {
        day,
        storeId,
        saleCount: FieldValue.increment(1),
        revenue: FieldValue.increment(Number(sale.grandTotal ?? 0)),
        taxTotal: FieldValue.increment(Number(sale.taxTotal ?? 0)),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);

export const upsertProduct = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid;
  const { storeId, barcode, name, price, taxRate, currency, active = true } = request.data ?? {};

  if (!storeId || !barcode || !name) {
    throw new HttpsError("invalid-argument", "storeId, barcode and name are required.");
  }

  const membershipRef = db.collection("users").doc(uid).collection("stores").doc(storeId);
  const membership = await membershipRef.get();
  const role = membership.data()?.role;

  if (!membership.exists || (role !== "admin" && role !== "manager")) {
    throw new HttpsError("permission-denied", "Insufficient role to update products.");
  }

  const productRef = db.collection("stores").doc(storeId).collection("products").doc(String(barcode));

  await productRef.set(
    {
      barcode: String(barcode),
      name: String(name),
      price: Number(price ?? 0),
      taxRate: Number(taxRate ?? 0),
      currency: String(currency ?? "USD").toUpperCase(),
      active: Boolean(active),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, barcode: String(barcode), storeId: String(storeId) };
});
