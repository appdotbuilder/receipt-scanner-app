import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type UpdateReceiptInput } from '../schema';
import { updateReceipt } from '../handlers/update_receipt';
import { eq } from 'drizzle-orm';

describe('updateReceipt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test receipt with items
  async function createTestReceipt() {
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Original Store',
        total_amount: '25.50',
        receipt_date: new Date('2024-01-01'),
        image_url: 'original-image.jpg',
      })
      .returning()
      .execute();

    const receipt = receiptResult[0];

    await db.insert(receiptItemsTable)
      .values([
        {
          receipt_id: receipt.id,
          name: 'Original Item 1',
          quantity: 1,
          unit_price: '10.00',
          total_price: '10.00',
        },
        {
          receipt_id: receipt.id,
          name: 'Original Item 2',
          quantity: 2,
          unit_price: '7.75',
          total_price: '15.50',
        }
      ])
      .execute();

    return receipt;
  }

  it('should update only specified receipt fields', async () => {
    const testReceipt = await createTestReceipt();

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      store_name: 'Updated Store Name',
      total_amount: 30.99,
    };

    const result = await updateReceipt(updateInput);

    // Check updated fields
    expect(result.store_name).toEqual('Updated Store Name');
    expect(result.total_amount).toEqual(30.99);
    expect(typeof result.total_amount).toBe('number');

    // Check unchanged fields
    expect(result.receipt_date).toEqual(new Date('2024-01-01'));
    expect(result.image_url).toEqual('original-image.jpg');
    expect(result.id).toEqual(testReceipt.id);
    expect(result.created_at).toEqual(testReceipt.created_at);

    // Check updated_at was modified
    expect(result.updated_at).not.toEqual(testReceipt.updated_at);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Items should remain unchanged when not specified
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toEqual('Original Item 1');
    expect(result.items[1].name).toEqual('Original Item 2');
  });

  it('should update receipt and replace all items', async () => {
    const testReceipt = await createTestReceipt();

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      store_name: 'New Store',
      items: [
        {
          name: 'New Item 1',
          quantity: 3,
          unit_price: 5.00,
          total_price: 15.00,
        },
        {
          name: 'New Item 2',
          quantity: 1,
          unit_price: 12.99,
          total_price: 12.99,
        }
      ]
    };

    const result = await updateReceipt(updateInput);

    expect(result.store_name).toEqual('New Store');
    expect(result.items).toHaveLength(2);

    // Check new items
    const item1 = result.items.find(item => item.name === 'New Item 1');
    const item2 = result.items.find(item => item.name === 'New Item 2');

    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(3);
    expect(item1!.unit_price).toEqual(5.00);
    expect(item1!.total_price).toEqual(15.00);
    expect(typeof item1!.unit_price).toBe('number');
    expect(typeof item1!.total_price).toBe('number');

    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(1);
    expect(item2!.unit_price).toEqual(12.99);
    expect(item2!.total_price).toEqual(12.99);

    // Verify old items are gone from database
    const dbItems = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, testReceipt.id))
      .execute();

    expect(dbItems).toHaveLength(2);
    expect(dbItems.every(item => item.name.startsWith('New'))).toBe(true);
  });

  it('should update receipt and remove all items when empty array provided', async () => {
    const testReceipt = await createTestReceipt();

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      store_name: 'Store With No Items',
      items: []
    };

    const result = await updateReceipt(updateInput);

    expect(result.store_name).toEqual('Store With No Items');
    expect(result.items).toHaveLength(0);

    // Verify items are deleted from database
    const dbItems = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, testReceipt.id))
      .execute();

    expect(dbItems).toHaveLength(0);
  });

  it('should handle null image_url update', async () => {
    const testReceipt = await createTestReceipt();

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      image_url: null,
    };

    const result = await updateReceipt(updateInput);

    expect(result.image_url).toBeNull();
  });

  it('should update all fields when provided', async () => {
    const testReceipt = await createTestReceipt();
    const newDate = new Date('2024-12-31');

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      store_name: 'Completely New Store',
      total_amount: 99.99,
      receipt_date: newDate,
      image_url: 'new-image.jpg',
      items: [
        {
          name: 'Single New Item',
          quantity: 5,
          unit_price: 19.99,
          total_price: 99.95,
        }
      ]
    };

    const result = await updateReceipt(updateInput);

    expect(result.store_name).toEqual('Completely New Store');
    expect(result.total_amount).toEqual(99.99);
    expect(result.receipt_date).toEqual(newDate);
    expect(result.image_url).toEqual('new-image.jpg');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toEqual('Single New Item');
    expect(result.items[0].quantity).toEqual(5);
    expect(result.items[0].unit_price).toEqual(19.99);
    expect(result.items[0].total_price).toEqual(99.95);
  });

  it('should save updated receipt to database', async () => {
    const testReceipt = await createTestReceipt();

    const updateInput: UpdateReceiptInput = {
      id: testReceipt.id,
      store_name: 'Database Test Store',
      total_amount: 45.67,
    };

    await updateReceipt(updateInput);

    // Verify in database
    const dbReceipts = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, testReceipt.id))
      .execute();

    expect(dbReceipts).toHaveLength(1);
    expect(dbReceipts[0].store_name).toEqual('Database Test Store');
    expect(parseFloat(dbReceipts[0].total_amount)).toEqual(45.67);
    expect(dbReceipts[0].updated_at).not.toEqual(testReceipt.updated_at);
  });

  it('should throw error when receipt does not exist', async () => {
    const updateInput: UpdateReceiptInput = {
      id: 99999, // Non-existent ID
      store_name: 'Should Not Work',
    };

    await expect(updateReceipt(updateInput)).rejects.toThrow(/Receipt with id 99999 not found/i);
  });
});