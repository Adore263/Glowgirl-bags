import { SaleLineResolved } from "@/lib/types";

export type Totals = {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
};

export function calculateTotals(lines: SaleLineResolved[], taxRate: number): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const taxTotal = Number((subtotal * taxRate).toFixed(2));
  const grandTotal = Number((subtotal + taxTotal).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxTotal,
    grandTotal,
  };
}
