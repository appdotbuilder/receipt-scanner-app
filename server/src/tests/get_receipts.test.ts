import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { getReceipts } from '../handlers/get_receipts';

describe('getReceipts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no receipts exist', async () => {
    const result = await getReceipts();
    
    expect(result).toEqual([]);
  });

  it('should return receipt without items when no items exist', async () => {
    // Create a receipt without items
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Test Store',
        total_amount: '25.99',
        receipt_date: new Date('2024-01-15'),
        image_url: null
      })
      .returning()
      .execute();

    const result = await getReceipts();
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(receiptResult[0].id);
    expect(result[0].store_name).toEqual('Test Store');
    expect(result[0].total_amount).toEqual(25.99);
    expect(result[0].receipt_date).toBeInstanceOf(Date);
    expect(result[0].image_url).toBeNull();
    expect(result[0].items).toEqual([]);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return receipt with items', async () => {
    // Create a receipt
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Grocery Store',
        total_amount: '42.50',
        receipt_date: new Date('2024-01-20'),
        image_url: 'https://example.com/receipt.jpg'
      })
      .returning()
      .execute();

    const receiptId = receiptResult[0].id;

    // Create receipt items
    await db.insert(receiptItemsTable)
      .values([
        {
          receipt_id: receiptId,
          name: 'Bread',
          quantity: 2,
          unit_price: '3.99',
          total_price: '7.98'
        },
        {
          receipt_id: receiptId,
          name: 'Milk',
          quantity: 1,
          unit_price: '4.50',
          total_price: '4.50'
        }
      ])
      .execute();

    const result = await getReceipts();
    
    expect(result).toHaveLength(1);
    
    const receipt = result[0];
    expect(receipt.store_name).toEqual('Grocery Store');
    expect(receipt.total_amount).toEqual(42.50);
    expect(receipt.image_url).toEqual('https://example.com/receipt.jpg');
    expect(receipt.items).toHaveLength(2);

    // Check first item
    const breadItem = receipt.items.find(item => item.name === 'Bread');
    expect(breadItem).toBeDefined();
    expect(breadItem!.quantity).toEqual(2);
    expect(breadItem!.unit_price).toEqual(3.99);
    expect(breadItem!.total_price).toEqual(7.98);
    expect(breadItem!.created_at).toBeInstanceOf(Date);

    // Check second item
    const milkItem = receipt.items.find(item => item.name === 'Milk');
    expect(milkItem).toBeDefined();
    expect(milkItem!.quantity).toEqual(1);
    expect(milkItem!.unit_price).toEqual(4.50);
    expect(milkItem!.total_price).toEqual(4.50);
  });

  it('should return multiple receipts ordered by date DESC', async () => {
    // Create receipts in chronological order
    const oldReceiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Old Store',
        total_amount: '10.00',
        receipt_date: new Date('2024-01-01')
      })
      .returning()
      .execute();

    const newReceiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'New Store',
        total_amount: '20.00',
        receipt_date: new Date('2024-01-31')
      })
      .returning()
      .execute();

    const middleReceiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Middle Store',
        total_amount: '15.00',
        receipt_date: new Date('2024-01-15')
      })
      .returning()
      .execute();

    // Add items to middle receipt to test items are properly associated
    await db.insert(receiptItemsTable)
      .values({
        receipt_id: middleReceiptResult[0].id,
        name: 'Test Item',
        quantity: 1,
        unit_price: '15.00',
        total_price: '15.00'
      })
      .execute();

    const result = await getReceipts();
    
    expect(result).toHaveLength(3);
    
    // Should be ordered by date DESC (newest first)
    expect(result[0].store_name).toEqual('New Store');
    expect(result[0].items).toEqual([]);
    
    expect(result[1].store_name).toEqual('Middle Store');
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].name).toEqual('Test Item');
    
    expect(result[2].store_name).toEqual('Old Store');
    expect(result[2].items).toEqual([]);
  });

  it('should handle receipts with different numbers of items', async () => {
    // Create receipt with no items
    const receipt1 = await db.insert(receiptsTable)
      .values({
        store_name: 'Store 1',
        total_amount: '5.00',
        receipt_date: new Date('2024-01-01')
      })
      .returning()
      .execute();

    // Create receipt with multiple items
    const receipt2 = await db.insert(receiptsTable)
      .values({
        store_name: 'Store 2',
        total_amount: '25.00',
        receipt_date: new Date('2024-01-02')
      })
      .returning()
      .execute();

    await db.insert(receiptItemsTable)
      .values([
        {
          receipt_id: receipt2[0].id,
          name: 'Item A',
          quantity: 1,
          unit_price: '10.00',
          total_price: '10.00'
        },
        {
          receipt_id: receipt2[0].id,
          name: 'Item B',
          quantity: 3,
          unit_price: '5.00',
          total_price: '15.00'
        }
      ])
      .execute();

    const result = await getReceipts();
    
    expect(result).toHaveLength(2);
    
    // Newest first
    expect(result[0].store_name).toEqual('Store 2');
    expect(result[0].items).toHaveLength(2);
    
    expect(result[1].store_name).toEqual('Store 1');
    expect(result[1].items).toHaveLength(0);
  });

  it('should properly convert numeric fields to numbers', async () => {
    // Create receipt with items to test numeric conversion
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Test Store',
        total_amount: '123.45',
        receipt_date: new Date('2024-01-01')
      })
      .returning()
      .execute();

    await db.insert(receiptItemsTable)
      .values({
        receipt_id: receiptResult[0].id,
        name: 'Test Item',
        quantity: 2,
        unit_price: '12.34',
        total_price: '24.68'
      })
      .execute();

    const result = await getReceipts();
    
    expect(result).toHaveLength(1);
    
    // Check receipt numeric conversion
    expect(typeof result[0].total_amount).toEqual('number');
    expect(result[0].total_amount).toEqual(123.45);
    
    // Check item numeric conversion
    expect(typeof result[0].items[0].unit_price).toEqual('number');
    expect(result[0].items[0].unit_price).toEqual(12.34);
    expect(typeof result[0].items[0].total_price).toEqual('number');
    expect(result[0].items[0].total_price).toEqual(24.68);
  });
});