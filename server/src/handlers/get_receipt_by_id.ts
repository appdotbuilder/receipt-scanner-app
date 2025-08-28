import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type GetReceiptByIdInput, type ReceiptWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export async function getReceiptById(input: GetReceiptByIdInput): Promise<ReceiptWithItems | null> {
  try {
    // Query the receipt by ID with a left join to get items
    const results = await db.select()
      .from(receiptsTable)
      .leftJoin(receiptItemsTable, eq(receiptItemsTable.receipt_id, receiptsTable.id))
      .where(eq(receiptsTable.id, input.id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Extract receipt data from the first result
    const receiptData = results[0].receipts;
    
    // Process all items, filtering out null results from left join
    const items = results
      .map(result => result.receipt_items)
      .filter(item => item !== null)
      .map(item => ({
        ...item,
        unit_price: parseFloat(item.unit_price), // Convert numeric to number
        total_price: parseFloat(item.total_price) // Convert numeric to number
      }));

    // Return receipt with converted numeric fields and items
    return {
      ...receiptData,
      total_amount: parseFloat(receiptData.total_amount), // Convert numeric to number
      items: items
    };
  } catch (error) {
    console.error('Get receipt by ID failed:', error);
    throw error;
  }
}