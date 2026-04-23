import { z } from "zod";

export const saleLineInputSchema = z.object({
  barcode: z.string().min(3).max(64),
  qty: z.number().int().positive().max(999),
});

export const saleCreateInputSchema = z.object({
  storeId: z.string().min(2).max(64),
  cashierLabel: z.string().min(1).max(64),
  items: z.array(saleLineInputSchema).min(1).max(100),
});

export const productRecordSchema = z.object({
  barcode: z.string().min(3).max(64),
  name: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1),
  currency: z.string().length(3),
  stockQty: z.number().int().optional(),
  active: z.boolean(),
});
