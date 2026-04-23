#!/usr/bin/env node

/**
 * Bulk add products to Firestore using service account credentials.
 * Usage: node scripts/add-products.js <path-to-service-account-json> [storeId] [productsJsonFile]
 * 
 * Example:
 *   node scripts/add-products.js ../glowgirl-bags-firebase-adminsdk-fbsvc-05eb851694.json default products.json
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: node add-products.js <service-account-json> [storeId] [productsJsonFile]"
    );
    console.error("Example:");
    console.error(
      "  node add-products.js ../glowgirl-bags-firebase-adminsdk-fbsvc-05eb851694.json default products.json"
    );
    process.exit(1);
  }

  const serviceAccountPath = args[0];
  const storeId = args[1] || "default";
  const productsPath = args[2] || "./sample-products.json";

  // Validate files exist
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Error: Service account file not found: ${serviceAccountPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(productsPath)) {
    console.error(`Error: Products file not found: ${productsPath}`);
    process.exit(1);
  }

  try {
    // Load service account
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();

    // Load products
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

    if (!Array.isArray(products)) {
      console.error("Error: products.json must contain an array of products");
      process.exit(1);
    }

    console.log(
      `Adding ${products.length} products to store "${storeId}"...`
    );

    let added = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Validate required fields
        if (!product.barcode || !product.name) {
          console.error(
            `Skipping product: missing barcode or name:`,
            product
          );
          errors++;
          continue;
        }

        const docRef = db
          .collection("stores")
          .doc(storeId)
          .collection("products")
          .doc(String(product.barcode));

        await docRef.set({
          barcode: String(product.barcode),
          name: String(product.name),
          price: Number(product.price || 0),
          taxRate: Number(product.taxRate || 0),
          currency: String(product.currency || "USD"),
          active: Boolean(product.active !== false),
          ...(product.stockQty !== undefined && { stockQty: Number(product.stockQty) }),
        });

        console.log(`✓ Added: ${product.barcode} - ${product.name}`);
        added++;
      } catch (err) {
        console.error(`✗ Error adding product ${product.barcode}:`, err.message);
        errors++;
      }
    }

    console.log(
      `\nComplete: ${added} added, ${errors} errors`
    );

    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error("Fatal error:", err.message);
    process.exit(1);
  }
}

main();
