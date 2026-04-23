export type ProductRecord = {
  barcode: string;
  name: string;
  price: number;
  taxRate: number;
  currency: string;
  stockQty?: number;
  active: boolean;
};

export type SaleLineInput = {
  barcode: string;
  qty: number;
};

export type SaleLineResolved = {
  barcode: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type SaleCreateInput = {
  storeId: string;
  cashierLabel: string;
  items: SaleLineInput[];
};

export type SaleCreateResult = {
  saleId: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
};
