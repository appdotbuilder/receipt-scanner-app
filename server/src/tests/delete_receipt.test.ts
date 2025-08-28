import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type DeleteReceiptInput } from '../schema';
import { deleteReceipt } from '../handlers/delete_receipt';
import { eq } from 'drizzle-orm';

const testReceiptInput = {
  store_name: 'Test Store',
  total_amount: '25.99',
  receipt_date: new Date('2024-01-15'),
  image_url: 'https://example.com/receipt.jpg'
};

const testItemInputs = [
  {
    name: 'Test Item 1',
    quantity: 2,
    unit_price: '10.00',
    total_price: '20.00'
  },
  {
    name: 'Test Item 2',
    quantity: 1,
    unit_price: '5.99',
    total_price: '5.99'
  }
];

describe('deleteReceipt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an existing receipt', async () => {
    // Create test receipt
    const receiptResult = await db.insert(receiptsTable)
      .values(testReceiptInput)
      .returning()
      .execute();

    const receiptId = receiptResult[0].id;

    const deleteInput: DeleteReceiptInput = { id: receiptId };

    const result = await deleteReceipt(deleteInput);

    expect(result.success).toBe(true);

    // Verify receipt was deleted from database
    const receipts = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, receiptId))
      .execute();

    expect(receipts).toHaveLength(0);
  });

  it('should cascade delete receipt items when receipt is deleted', async () => {
    // Create test receipt
    const receiptResult = await db.insert(receiptsTable)
      .values(testReceiptInput)
      .returning()
      .execute();

    const receiptId = receiptResult[0].id;

    // Create test items for the receipt
    const itemsWithReceiptId = testItemInputs.map(item => ({
      ...item,
      receipt_id: receiptId
    }));

    await db.insert(receiptItemsTable)
      .values(itemsWithReceiptId)
      .execute();

    // Verify items exist before deletion
    const itemsBefore = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, receiptId))
      .execute();

    expect(itemsBefore).toHaveLength(2);

    const deleteInput: DeleteReceiptInput = { id: receiptId };

    const result = await deleteReceipt(deleteInput);

    expect(result.success).toBe(true);

    // Verify receipt items were cascade deleted
    const itemsAfter = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, receiptId))
      .execute();

    expect(itemsAfter).toHaveLength(0);
  });

  it('should throw error when receipt does not exist', async () => {
    const nonExistentId = 999999;
    const deleteInput: DeleteReceiptInput = { id: nonExistentId };

    await expect(deleteReceipt(deleteInput))
      .rejects.toThrow(/receipt with id 999999 not found/i);
  });

  it('should not affect other receipts when deleting one receipt', async () => {
    // Create two test receipts
    const receipt1Result = await db.insert(receiptsTable)
      .values(testReceiptInput)
      .returning()
      .execute();

    const receipt2Result = await db.insert(receiptsTable)
      .values({
        ...testReceiptInput,
        store_name: 'Another Store'
      })
      .returning()
      .execute();

    const receiptId1 = receipt1Result[0].id;
    const receiptId2 = receipt2Result[0].id;

    // Delete first receipt
    const deleteInput: DeleteReceiptInput = { id: receiptId1 };
    const result = await deleteReceipt(deleteInput);

    expect(result.success).toBe(true);

    // Verify first receipt was deleted
    const receipt1After = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, receiptId1))
      .execute();

    expect(receipt1After).toHaveLength(0);

    // Verify second receipt still exists
    const receipt2After = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, receiptId2))
      .execute();

    expect(receipt2After).toHaveLength(1);
    expect(receipt2After[0].store_name).toEqual('Another Store');
  });

  it('should only delete items belonging to the deleted receipt', async () => {
    // Create two test receipts
    const receipt1Result = await db.insert(receiptsTable)
      .values(testReceiptInput)
      .returning()
      .execute();

    const receipt2Result = await db.insert(receiptsTable)
      .values({
        ...testReceiptInput,
        store_name: 'Another Store'
      })
      .returning()
      .execute();

    const receiptId1 = receipt1Result[0].id;
    const receiptId2 = receipt2Result[0].id;

    // Create items for both receipts
    await db.insert(receiptItemsTable)
      .values([
        {
          ...testItemInputs[0],
          receipt_id: receiptId1
        },
        {
          ...testItemInputs[1],
          receipt_id: receiptId2
        }
      ])
      .execute();

    // Delete first receipt
    const deleteInput: DeleteReceiptInput = { id: receiptId1 };
    const result = await deleteReceipt(deleteInput);

    expect(result.success).toBe(true);

    // Verify items for first receipt were deleted
    const items1After = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, receiptId1))
      .execute();

    expect(items1After).toHaveLength(0);

    // Verify items for second receipt still exist
    const items2After = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, receiptId2))
      .execute();

    expect(items2After).toHaveLength(1);
    expect(items2After[0].name).toEqual('Test Item 2');
  });
});