import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type GetReceiptByIdInput, type CreateReceiptInput } from '../schema';
import { getReceiptById } from '../handlers/get_receipt_by_id';

describe('getReceiptById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return a receipt with items when found', async () => {
    // Create test receipt
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Test Store',
        total_amount: '25.99',
        receipt_date: new Date('2024-01-15'),
        image_url: 'https://example.com/receipt.jpg'
      })
      .returning()
      .execute();

    const receipt = receiptResult[0];

    // Create test items for this receipt
    await db.insert(receiptItemsTable)
      .values([
        {
          receipt_id: receipt.id,
          name: 'Coffee',
          quantity: 2,
          unit_price: '4.50',
          total_price: '9.00'
        },
        {
          receipt_id: receipt.id,
          name: 'Sandwich',
          quantity: 1,
          unit_price: '16.99',
          total_price: '16.99'
        }
      ])
      .execute();

    const input: GetReceiptByIdInput = { id: receipt.id };
    const result = await getReceiptById(input);

    // Verify receipt data
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(receipt.id);
    expect(result!.store_name).toEqual('Test Store');
    expect(result!.total_amount).toEqual(25.99);
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.receipt_date).toEqual(new Date('2024-01-15'));
    expect(result!.image_url).toEqual('https://example.com/receipt.jpg');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);

    // Verify items
    expect(result!.items).toHaveLength(2);
    
    const coffeeItem = result!.items.find(item => item.name === 'Coffee');
    expect(coffeeItem).toBeDefined();
    expect(coffeeItem!.quantity).toEqual(2);
    expect(coffeeItem!.unit_price).toEqual(4.5);
    expect(typeof coffeeItem!.unit_price).toBe('number');
    expect(coffeeItem!.total_price).toEqual(9);
    expect(typeof coffeeItem!.total_price).toBe('number');

    const sandwichItem = result!.items.find(item => item.name === 'Sandwich');
    expect(sandwichItem).toBeDefined();
    expect(sandwichItem!.quantity).toEqual(1);
    expect(sandwichItem!.unit_price).toEqual(16.99);
    expect(sandwichItem!.total_price).toEqual(16.99);
  });

  it('should return receipt with empty items array when receipt has no items', async () => {
    // Create receipt without items
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Empty Store',
        total_amount: '0.00',
        receipt_date: new Date('2024-01-16'),
        image_url: null
      })
      .returning()
      .execute();

    const receipt = receiptResult[0];
    const input: GetReceiptByIdInput = { id: receipt.id };
    const result = await getReceiptById(input);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(receipt.id);
    expect(result!.store_name).toEqual('Empty Store');
    expect(result!.total_amount).toEqual(0);
    expect(result!.image_url).toBeNull();
    expect(result!.items).toHaveLength(0);
  });

  it('should return null when receipt does not exist', async () => {
    const input: GetReceiptByIdInput = { id: 999 };
    const result = await getReceiptById(input);

    expect(result).toBeNull();
  });

  it('should handle receipts with null image_url correctly', async () => {
    // Create receipt with null image_url
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'No Image Store',
        total_amount: '15.50',
        receipt_date: new Date('2024-01-17')
        // image_url is omitted (null by default)
      })
      .returning()
      .execute();

    const receipt = receiptResult[0];
    const input: GetReceiptByIdInput = { id: receipt.id };
    const result = await getReceiptById(input);

    expect(result).not.toBeNull();
    expect(result!.image_url).toBeNull();
    expect(result!.store_name).toEqual('No Image Store');
    expect(result!.total_amount).toEqual(15.5);
  });

  it('should correctly convert all numeric fields to numbers', async () => {
    // Create receipt with specific decimal values
    const receiptResult = await db.insert(receiptsTable)
      .values({
        store_name: 'Decimal Test Store',
        total_amount: '123.45', // String in database
        receipt_date: new Date('2024-01-18')
      })
      .returning()
      .execute();

    const receipt = receiptResult[0];

    // Add item with decimal values
    await db.insert(receiptItemsTable)
      .values({
        receipt_id: receipt.id,
        name: 'Expensive Item',
        quantity: 3,
        unit_price: '33.33', // String in database
        total_price: '99.99' // String in database
      })
      .execute();

    const input: GetReceiptByIdInput = { id: receipt.id };
    const result = await getReceiptById(input);

    expect(result).not.toBeNull();
    
    // Verify receipt numeric conversion
    expect(typeof result!.total_amount).toBe('number');
    expect(result!.total_amount).toEqual(123.45);
    
    // Verify item numeric conversions
    expect(result!.items).toHaveLength(1);
    expect(typeof result!.items[0].unit_price).toBe('number');
    expect(typeof result!.items[0].total_price).toBe('number');
    expect(result!.items[0].unit_price).toEqual(33.33);
    expect(result!.items[0].total_price).toEqual(99.99);
  });
});