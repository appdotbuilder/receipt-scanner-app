import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type UpdateReceiptInput, type ReceiptWithItems } from '../schema';
import { eq } from 'drizzle-orm';

export const updateReceipt = async (input: UpdateReceiptInput): Promise<ReceiptWithItems> => {
  try {
    return await db.transaction(async (tx) => {
      // Check if receipt exists
      const existingReceipts = await tx.select()
        .from(receiptsTable)
        .where(eq(receiptsTable.id, input.id))
        .execute();

      if (existingReceipts.length === 0) {
        throw new Error(`Receipt with id ${input.id} not found`);
      }

      const existingReceipt = existingReceipts[0];

      // Build update object only with provided fields
      const updateData: any = {
        updated_at: new Date(),
      };

      if (input.store_name !== undefined) {
        updateData.store_name = input.store_name;
      }
      if (input.total_amount !== undefined) {
        updateData.total_amount = input.total_amount.toString();
      }
      if (input.receipt_date !== undefined) {
        updateData.receipt_date = input.receipt_date;
      }
      if (input.image_url !== undefined) {
        updateData.image_url = input.image_url;
      }

      // Update receipt
      const updatedReceipts = await tx.update(receiptsTable)
        .set(updateData)
        .where(eq(receiptsTable.id, input.id))
        .returning()
        .execute();

      const updatedReceipt = updatedReceipts[0];

      // Handle items if provided
      if (input.items !== undefined) {
        // Delete existing items for this receipt
        await tx.delete(receiptItemsTable)
          .where(eq(receiptItemsTable.receipt_id, input.id))
          .execute();

        // Insert new items if any provided
        if (input.items.length > 0) {
          const itemsToInsert = input.items.map(item => ({
            receipt_id: input.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(),
            total_price: item.total_price.toString(),
          }));

          await tx.insert(receiptItemsTable)
            .values(itemsToInsert)
            .execute();
        }
      }

      // Fetch and return the updated receipt with items
      const finalItems = await tx.select()
        .from(receiptItemsTable)
        .where(eq(receiptItemsTable.receipt_id, input.id))
        .execute();

      return {
        ...updatedReceipt,
        total_amount: parseFloat(updatedReceipt.total_amount),
        items: finalItems.map(item => ({
          ...item,
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.total_price),
        }))
      };
    });
  } catch (error) {
    console.error('Receipt update failed:', error);
    throw error;
  }
};