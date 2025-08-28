import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type ReceiptWithItems } from '../schema';
import { desc, eq } from 'drizzle-orm';

export const getReceipts = async (): Promise<ReceiptWithItems[]> => {
  try {
    // First get all receipts ordered by newest first
    const receipts = await db.select()
      .from(receiptsTable)
      .orderBy(desc(receiptsTable.receipt_date))
      .execute();

    // Then get all receipt items for these receipts
    const receiptIds = receipts.map(receipt => receipt.id);
    
    let receiptItems: any[] = [];
    if (receiptIds.length > 0) {
      receiptItems = await db.select()
        .from(receiptItemsTable)
        .where(eq(receiptItemsTable.receipt_id, receiptIds[0])) // We'll build this properly below
        .execute();

      // For multiple receipt IDs, we need to get all items at once
      receiptItems = await db.select()
        .from(receiptItemsTable)
        .execute();
    }

    // Group items by receipt_id for efficient lookup
    const itemsByReceiptId = receiptItems.reduce((acc, item) => {
      const receiptId = item.receipt_id;
      if (!acc[receiptId]) {
        acc[receiptId] = [];
      }
      acc[receiptId].push({
        ...item,
        unit_price: parseFloat(item.unit_price),
        total_price: parseFloat(item.total_price)
      });
      return acc;
    }, {} as Record<number, any[]>);

    // Combine receipts with their items
    return receipts.map(receipt => ({
      ...receipt,
      total_amount: parseFloat(receipt.total_amount),
      items: itemsByReceiptId[receipt.id] || []
    }));
  } catch (error) {
    console.error('Failed to get receipts:', error);
    throw error;
  }
};