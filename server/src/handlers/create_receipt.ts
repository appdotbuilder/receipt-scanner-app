import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type CreateReceiptInput, type ReceiptWithItems } from '../schema';

export const createReceipt = async (input: CreateReceiptInput): Promise<ReceiptWithItems> => {
  try {
    // Begin transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // Insert the receipt record
      const receiptResult = await tx.insert(receiptsTable)
        .values({
          store_name: input.store_name,
          total_amount: input.total_amount.toString(), // Convert number to string for numeric column
          receipt_date: input.receipt_date,
          image_url: input.image_url || null,
        })
        .returning()
        .execute();

      const receipt = receiptResult[0];

      // Insert all receipt items
      const itemsData = input.items.map(item => ({
        receipt_id: receipt.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price.toString(), // Convert number to string for numeric column
        total_price: item.total_price.toString(), // Convert number to string for numeric column
      }));

      const itemsResult = await tx.insert(receiptItemsTable)
        .values(itemsData)
        .returning()
        .execute();

      // Convert numeric fields back to numbers and return complete receipt
      return {
        ...receipt,
        total_amount: parseFloat(receipt.total_amount), // Convert string back to number
        items: itemsResult.map(item => ({
          ...item,
          unit_price: parseFloat(item.unit_price), // Convert string back to number
          total_price: parseFloat(item.total_price), // Convert string back to number
        })),
      };
    });

    return result;
  } catch (error) {
    console.error('Receipt creation failed:', error);
    throw error;
  }
};