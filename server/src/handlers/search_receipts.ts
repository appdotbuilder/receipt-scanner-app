import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type SearchReceiptsInput, type ReceiptWithItems } from '../schema';
import { eq, and, gte, lte, ilike, or, desc, SQL } from 'drizzle-orm';

export async function searchReceipts(input: SearchReceiptsInput): Promise<ReceiptWithItems[]> {
  try {
    // Start with base query joining receipts and items
    const baseQuery = db.select({
      // Receipt fields
      id: receiptsTable.id,
      store_name: receiptsTable.store_name,
      total_amount: receiptsTable.total_amount,
      receipt_date: receiptsTable.receipt_date,
      image_url: receiptsTable.image_url,
      created_at: receiptsTable.created_at,
      updated_at: receiptsTable.updated_at,
      // Item fields (nullable due to LEFT JOIN)
      item_id: receiptItemsTable.id,
      item_name: receiptItemsTable.name,
      item_quantity: receiptItemsTable.quantity,
      item_unit_price: receiptItemsTable.unit_price,
      item_total_price: receiptItemsTable.total_price,
      item_created_at: receiptItemsTable.created_at
    })
    .from(receiptsTable)
    .leftJoin(receiptItemsTable, eq(receiptsTable.id, receiptItemsTable.receipt_id));

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // General query search (store name or item names)
    if (input.query) {
      conditions.push(
        or(
          ilike(receiptsTable.store_name, `%${input.query}%`),
          ilike(receiptItemsTable.name, `%${input.query}%`)
        )!
      );
    }

    // Store name filter
    if (input.store_name) {
      conditions.push(ilike(receiptsTable.store_name, `%${input.store_name}%`));
    }

    // Date range filters
    if (input.date_from) {
      conditions.push(gte(receiptsTable.receipt_date, input.date_from));
    }

    if (input.date_to) {
      conditions.push(lte(receiptsTable.receipt_date, input.date_to));
    }

    // Amount range filters
    if (input.min_amount !== undefined) {
      conditions.push(gte(receiptsTable.total_amount, input.min_amount.toString()));
    }

    if (input.max_amount !== undefined) {
      conditions.push(lte(receiptsTable.total_amount, input.max_amount.toString()));
    }

    // Build final query with conditions and ordering
    let results;
    
    if (conditions.length > 0) {
      results = await baseQuery
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(receiptsTable.receipt_date))
        .execute();
    } else {
      results = await baseQuery
        .orderBy(desc(receiptsTable.receipt_date))
        .execute();
    }

    // Group results by receipt ID and build ReceiptWithItems structure
    const receiptMap = new Map<number, ReceiptWithItems>();

    for (const row of results) {
      const receiptId = row.id;

      if (!receiptMap.has(receiptId)) {
        // Create new receipt entry
        receiptMap.set(receiptId, {
          id: row.id,
          store_name: row.store_name,
          total_amount: parseFloat(row.total_amount), // Convert numeric to number
          receipt_date: row.receipt_date,
          image_url: row.image_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: []
        });
      }

      // Add item to receipt if it exists (leftJoin might return null items)
      if (row.item_id !== null && 
          row.item_name !== null && 
          row.item_quantity !== null && 
          row.item_unit_price !== null && 
          row.item_total_price !== null && 
          row.item_created_at !== null) {
        const receipt = receiptMap.get(receiptId)!;
        receipt.items.push({
          id: row.item_id,
          receipt_id: receiptId,
          name: row.item_name,
          quantity: row.item_quantity,
          unit_price: parseFloat(row.item_unit_price), // Convert numeric to number
          total_price: parseFloat(row.item_total_price), // Convert numeric to number
          created_at: row.item_created_at
        });
      }
    }

    return Array.from(receiptMap.values());
  } catch (error) {
    console.error('Receipt search failed:', error);
    throw error;
  }
}