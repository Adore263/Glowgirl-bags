# Barcode WebApp Scaffold (Next.js + Firebase)

This repository is scaffolded as a full-stack barcode sales app with:

- Next.js App Router frontend with camera + manual barcode flow
- Sale recording API path backed by Firestore
- Firebase Admin wiring for server routes
- Firestore rules and indexes files
- Cloud Functions skeleton for post-sale aggregation and product upsert

## Included Architecture

### Frontend scan flow

- Screen: `src/app/page.tsx`
- UI component: `src/components/sale-scanner.tsx`
- Uses browser `BarcodeDetector` when available
- Falls back to manual barcode entry
- Resolves products through API and builds a cart
- Sends sale payload to `/api/sales`

### API + sale recording path

- Product lookup endpoint: `src/app/api/products/[barcode]/route.ts`
- Sale create endpoint: `src/app/api/sales/route.ts`
- Server sale logic: `src/lib/sales/record-sale.ts`
- Input validation: `src/lib/validation.ts`

### Firebase wiring

- Web SDK client helpers: `src/lib/firebase/client.ts`
- Admin SDK server helpers: `src/lib/firebase/admin.ts`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Firebase project config: `firebase.json`, `.firebaserc`

### Cloud Functions scaffold

- Functions source: `functions/src/index.ts`
- Trigger: aggregate daily sales on sale document create
- Callable: upsert product with role check

## Firestore schema used

- `stores/{storeId}/products/{barcode}`
- `stores/{storeId}/sales/{saleId}`
- `stores/{storeId}/metrics/{metricId}`
- `users/{uid}/stores/{storeId}` for role membership

## Environment setup

Copy `.env.example` to `.env.local` and fill values.

Required for frontend:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Required for Next.js server routes:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional:

- `NEXT_PUBLIC_DEFAULT_STORE_ID` (default: `default`)

## Local development

Install and run app:

```bash
npm install
npm run dev
```

Cloud Functions local setup:

```bash
npm run functions:install
npm run functions:build
```

If using Firebase emulators, install Firebase CLI and run from `functions` folder or root with matching commands.

## Notes

- Sale endpoint verifies Firebase ID token when present.
- Frontend signs in anonymously before checkout.
- This is a scaffold: adapt role rules, auth model, and stock management behavior for production.
