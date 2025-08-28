import { z } from 'zod';

// Item schema for individual items on a receipt
export const receiptItemSchema = z.object({
  id: z.number(),
  receipt_id: z.number(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
  created_at: z.coerce.date()
});

export type ReceiptItem = z.infer<typeof receiptItemSchema>;

// Receipt schema
export const receiptSchema = z.object({
  id: z.number(),
  store_name: z.string(),
  total_amount: z.number().positive(),
  receipt_date: z.coerce.date(),
  image_url: z.string().nullable(), // URL to scanned receipt image
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Receipt = z.infer<typeof receiptSchema>;

// Receipt with items relation
export const receiptWithItemsSchema = receiptSchema.extend({
  items: z.array(receiptItemSchema)
});

export type ReceiptWithItems = z.infer<typeof receiptWithItemsSchema>;

// Input schema for creating receipts
export const createReceiptInputSchema = z.object({
  store_name: z.string().min(1, "Store name is required"),
  total_amount: z.number().positive("Total amount must be positive"),
  receipt_date: z.coerce.date(),
  image_url: z.string().nullable().optional(), // Optional when creating
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unit_price: z.number().positive("Unit price must be positive"),
    total_price: z.number().positive("Total price must be positive")
  })).min(1, "At least one item is required")
});

export type CreateReceiptInput = z.infer<typeof createReceiptInputSchema>;

// Input schema for updating receipts
export const updateReceiptInputSchema = z.object({
  id: z.number(),
  store_name: z.string().min(1, "Store name is required").optional(),
  total_amount: z.number().positive("Total amount must be positive").optional(),
  receipt_date: z.coerce.date().optional(),
  image_url: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.number().optional(), // For existing items
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unit_price: z.number().positive("Unit price must be positive"),
    total_price: z.number().positive("Total price must be positive")
  })).optional()
});

export type UpdateReceiptInput = z.infer<typeof updateReceiptInputSchema>;

// Input schema for creating individual items
export const createReceiptItemInputSchema = z.object({
  receipt_id: z.number(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit_price: z.number().positive("Unit price must be positive"),
  total_price: z.number().positive("Total price must be positive")
});

export type CreateReceiptItemInput = z.infer<typeof createReceiptItemInputSchema>;

// Search schema
export const searchReceiptsInputSchema = z.object({
  query: z.string().optional(),
  store_name: z.string().optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional()
});

export type SearchReceiptsInput = z.infer<typeof searchReceiptsInputSchema>;

// Get receipt by ID schema
export const getReceiptByIdInputSchema = z.object({
  id: z.number()
});

export type GetReceiptByIdInput = z.infer<typeof getReceiptByIdInputSchema>;

// Delete receipt schema
export const deleteReceiptInputSchema = z.object({
  id: z.number()
});

export type DeleteReceiptInput = z.infer<typeof deleteReceiptInputSchema>;