import { db } from '../db';
import { receiptsTable } from '../db/schema';
import { type DeleteReceiptInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function deleteReceipt(input: DeleteReceiptInput): Promise<{ success: boolean }> {
  try {
    // Check if receipt exists first
    const existingReceipt = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, input.id))
      .execute();

    if (existingReceipt.length === 0) {
      throw new Error(`Receipt with ID ${input.id} not found`);
    }

    // Delete the receipt (items will be cascade deleted due to foreign key constraint)
    const result = await db.delete(receiptsTable)
      .where(eq(receiptsTable.id, input.id))
      .returning()
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('Receipt deletion failed:', error);
    throw error;
  }
}