import { serial, text, pgTable, timestamp, numeric, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const receiptsTable = pgTable('receipts', {
  id: serial('id').primaryKey(),
  store_name: text('store_name').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  receipt_date: timestamp('receipt_date').notNull(),
  image_url: text('image_url'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const receiptItemsTable = pgTable('receipt_items', {
  id: serial('id').primaryKey(),
  receipt_id: integer('receipt_id').references(() => receiptsTable.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const receiptsRelations = relations(receiptsTable, ({ many }) => ({
  items: many(receiptItemsTable),
}));

export const receiptItemsRelations = relations(receiptItemsTable, ({ one }) => ({
  receipt: one(receiptsTable, {
    fields: [receiptItemsTable.receipt_id],
    references: [receiptsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Receipt = typeof receiptsTable.$inferSelect; // For SELECT operations
export type NewReceipt = typeof receiptsTable.$inferInsert; // For INSERT operations

export type ReceiptItem = typeof receiptItemsTable.$inferSelect; // For SELECT operations
export type NewReceiptItem = typeof receiptItemsTable.$inferInsert; // For INSERT operations

// Important: Export all tables for proper query building
export const tables = { 
  receipts: receiptsTable, 
  receiptItems: receiptItemsTable 
};