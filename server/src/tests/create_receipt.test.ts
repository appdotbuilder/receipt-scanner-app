import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type CreateReceiptInput } from '../schema';
import { createReceipt } from '../handlers/create_receipt';
import { eq } from 'drizzle-orm';

// Complete test input with all required fields
const testInput: CreateReceiptInput = {
  store_name: 'Test Store',
  total_amount: 25.99,
  receipt_date: new Date('2024-01-15'),
  image_url: 'https://example.com/receipt.jpg',
  items: [
    {
      name: 'Test Item 1',
      quantity: 2,
      unit_price: 10.00,
      total_price: 20.00
    },
    {
      name: 'Test Item 2',
      quantity: 1,
      unit_price: 5.99,
      total_price: 5.99
    }
  ]
};

describe('createReceipt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a receipt with items', async () => {
    const result = await createReceipt(testInput);

    // Verify receipt fields
    expect(result.store_name).toEqual('Test Store');
    expect(result.total_amount).toEqual(25.99);
    expect(typeof result.total_amount).toBe('number');
    expect(result.receipt_date).toEqual(testInput.receipt_date);
    expect(result.image_url).toEqual('https://example.com/receipt.jpg');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify items
    expect(result.items).toHaveLength(2);
    
    const item1 = result.items[0];
    expect(item1.name).toEqual('Test Item 1');
    expect(item1.quantity).toEqual(2);
    expect(item1.unit_price).toEqual(10.00);
    expect(typeof item1.unit_price).toBe('number');
    expect(item1.total_price).toEqual(20.00);
    expect(typeof item1.total_price).toBe('number');
    expect(item1.receipt_id).toEqual(result.id);
    expect(item1.id).toBeDefined();
    expect(item1.created_at).toBeInstanceOf(Date);

    const item2 = result.items[1];
    expect(item2.name).toEqual('Test Item 2');
    expect(item2.quantity).toEqual(1);
    expect(item2.unit_price).toEqual(5.99);
    expect(item2.total_price).toEqual(5.99);
    expect(item2.receipt_id).toEqual(result.id);
  });

  it('should save receipt and items to database', async () => {
    const result = await createReceipt(testInput);

    // Verify receipt was saved
    const receipts = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, result.id))
      .execute();

    expect(receipts).toHaveLength(1);
    expect(receipts[0].store_name).toEqual('Test Store');
    expect(parseFloat(receipts[0].total_amount)).toEqual(25.99);
    expect(receipts[0].receipt_date).toEqual(testInput.receipt_date);
    expect(receipts[0].image_url).toEqual('https://example.com/receipt.jpg');

    // Verify items were saved
    const items = await db.select()
      .from(receiptItemsTable)
      .where(eq(receiptItemsTable.receipt_id, result.id))
      .execute();

    expect(items).toHaveLength(2);
    
    const savedItem1 = items.find(item => item.name === 'Test Item 1');
    expect(savedItem1).toBeDefined();
    expect(savedItem1!.quantity).toEqual(2);
    expect(parseFloat(savedItem1!.unit_price)).toEqual(10.00);
    expect(parseFloat(savedItem1!.total_price)).toEqual(20.00);

    const savedItem2 = items.find(item => item.name === 'Test Item 2');
    expect(savedItem2).toBeDefined();
    expect(savedItem2!.quantity).toEqual(1);
    expect(parseFloat(savedItem2!.unit_price)).toEqual(5.99);
    expect(parseFloat(savedItem2!.total_price)).toEqual(5.99);
  });

  it('should handle receipt without image_url', async () => {
    const inputWithoutImage: CreateReceiptInput = {
      store_name: 'Store Without Image',
      total_amount: 15.50,
      receipt_date: new Date('2024-01-20'),
      items: [
        {
          name: 'Single Item',
          quantity: 1,
          unit_price: 15.50,
          total_price: 15.50
        }
      ]
    };

    const result = await createReceipt(inputWithoutImage);

    expect(result.store_name).toEqual('Store Without Image');
    expect(result.image_url).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toEqual('Single Item');
  });

  it('should handle single item receipt', async () => {
    const singleItemInput: CreateReceiptInput = {
      store_name: 'Single Item Store',
      total_amount: 7.99,
      receipt_date: new Date('2024-01-25'),
      image_url: 'https://example.com/single.jpg',
      items: [
        {
          name: 'Only Item',
          quantity: 3,
          unit_price: 2.66,
          total_price: 7.99
        }
      ]
    };

    const result = await createReceipt(singleItemInput);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toEqual('Only Item');
    expect(result.items[0].quantity).toEqual(3);
    expect(result.items[0].unit_price).toEqual(2.66);
    expect(result.items[0].total_price).toEqual(7.99);
  });

  it('should maintain transaction integrity', async () => {
    // Test that both receipt and items are created together
    const result = await createReceipt(testInput);

    // Count total receipts and items
    const allReceipts = await db.select().from(receiptsTable).execute();
    const allItems = await db.select().from(receiptItemsTable).execute();

    expect(allReceipts).toHaveLength(1);
    expect(allItems).toHaveLength(2);

    // Verify all items belong to the created receipt
    allItems.forEach(item => {
      expect(item.receipt_id).toEqual(result.id);
    });
  });

  it('should handle decimal precision correctly', async () => {
    const precisionInput: CreateReceiptInput = {
      store_name: 'Precision Test Store',
      total_amount: 12.34,
      receipt_date: new Date('2024-02-01'),
      items: [
        {
          name: 'Precision Item',
          quantity: 1,
          unit_price: 12.34,
          total_price: 12.34
        }
      ]
    };

    const result = await createReceipt(precisionInput);

    expect(result.total_amount).toEqual(12.34);
    expect(result.items[0].unit_price).toEqual(12.34);
    expect(result.items[0].total_price).toEqual(12.34);

    // Verify precision is maintained in database
    const savedReceipt = await db.select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, result.id))
      .execute();

    expect(parseFloat(savedReceipt[0].total_amount)).toEqual(12.34);
  });
});