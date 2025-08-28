import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { receiptsTable, receiptItemsTable } from '../db/schema';
import { type SearchReceiptsInput } from '../schema';
import { searchReceipts } from '../handlers/search_receipts';

describe('searchReceipts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestReceipts = async () => {
    // Create receipts
    const receipts = await db.insert(receiptsTable)
      .values([
        {
          store_name: 'Target',
          total_amount: '45.99',
          receipt_date: new Date('2024-01-15'),
          image_url: 'https://example.com/receipt1.jpg'
        },
        {
          store_name: 'Walmart',
          total_amount: '125.50',
          receipt_date: new Date('2024-01-20'),
          image_url: null
        },
        {
          store_name: 'Grocery Store',
          total_amount: '89.75',
          receipt_date: new Date('2024-02-01'),
          image_url: 'https://example.com/receipt3.jpg'
        }
      ])
      .returning()
      .execute();

    // Create items for receipts
    await db.insert(receiptItemsTable)
      .values([
        // Items for Target receipt
        {
          receipt_id: receipts[0].id,
          name: 'Milk',
          quantity: 2,
          unit_price: '3.99',
          total_price: '7.98'
        },
        {
          receipt_id: receipts[0].id,
          name: 'Bread',
          quantity: 1,
          unit_price: '2.50',
          total_price: '2.50'
        },
        // Items for Walmart receipt
        {
          receipt_id: receipts[1].id,
          name: 'Electronics Cable',
          quantity: 1,
          unit_price: '25.99',
          total_price: '25.99'
        },
        {
          receipt_id: receipts[1].id,
          name: 'Batteries',
          quantity: 4,
          unit_price: '12.99',
          total_price: '51.96'
        },
        // Items for Grocery Store receipt
        {
          receipt_id: receipts[2].id,
          name: 'Apples',
          quantity: 3,
          unit_price: '1.99',
          total_price: '5.97'
        },
        {
          receipt_id: receipts[2].id,
          name: 'Chicken',
          quantity: 1,
          unit_price: '15.99',
          total_price: '15.99'
        }
      ])
      .execute();

    return receipts;
  };

  it('should return all receipts when no filters are applied', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {};
    const results = await searchReceipts(input);

    expect(results).toHaveLength(3);
    
    // Verify receipts are ordered by date descending
    expect(results[0].store_name).toBe('Grocery Store'); // Feb 1
    expect(results[1].store_name).toBe('Walmart'); // Jan 20
    expect(results[2].store_name).toBe('Target'); // Jan 15

    // Verify each receipt has items
    expect(results[0].items).toHaveLength(2);
    expect(results[1].items).toHaveLength(2);
    expect(results[2].items).toHaveLength(2);

    // Verify numeric conversions
    expect(typeof results[0].total_amount).toBe('number');
    expect(results[0].total_amount).toBe(89.75);
    expect(typeof results[0].items[0].unit_price).toBe('number');
    expect(typeof results[0].items[0].total_price).toBe('number');
  });

  it('should filter by general query (store name)', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      query: 'Target'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Target');
    expect(results[0].items).toHaveLength(2);
  });

  it('should filter by general query (item name)', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      query: 'Milk'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Target');
    expect(results[0].items.some(item => item.name === 'Milk')).toBe(true);
  });

  it('should filter by specific store name', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      store_name: 'walmart'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Walmart');
  });

  it('should filter by partial store name match', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      store_name: 'Grocery'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Grocery Store');
  });

  it('should filter by date range', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      date_from: new Date('2024-01-18'),
      date_to: new Date('2024-01-25')
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Walmart');
    expect(results[0].receipt_date.getTime()).toBe(new Date('2024-01-20').getTime());
  });

  it('should filter by minimum amount', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      min_amount: 100
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Walmart');
    expect(results[0].total_amount).toBe(125.50);
  });

  it('should filter by maximum amount', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      max_amount: 50
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Target');
    expect(results[0].total_amount).toBe(45.99);
  });

  it('should filter by amount range', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      min_amount: 40,
      max_amount: 100
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(2);
    expect(results[0].store_name).toBe('Grocery Store'); // 89.75
    expect(results[1].store_name).toBe('Target'); // 45.99
  });

  it('should combine multiple filters', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      query: 'Electronics',
      date_from: new Date('2024-01-01'),
      min_amount: 100
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Walmart');
    expect(results[0].items.some(item => item.name === 'Electronics Cable')).toBe(true);
  });

  it('should return empty array when no matches found', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      query: 'NonExistentItem'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(0);
  });

  it('should handle case-insensitive searches', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {
      store_name: 'TARGET'
    };
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Target');
  });

  it('should return receipts with correct structure', async () => {
    await createTestReceipts();
    
    const input: SearchReceiptsInput = {};
    const results = await searchReceipts(input);
    const receipt = results[0];

    // Verify receipt structure
    expect(receipt.id).toBeDefined();
    expect(typeof receipt.store_name).toBe('string');
    expect(typeof receipt.total_amount).toBe('number');
    expect(receipt.receipt_date).toBeInstanceOf(Date);
    expect(receipt.created_at).toBeInstanceOf(Date);
    expect(receipt.updated_at).toBeInstanceOf(Date);
    expect(Array.isArray(receipt.items)).toBe(true);

    // Verify item structure
    const item = receipt.items[0];
    expect(item.id).toBeDefined();
    expect(item.receipt_id).toBe(receipt.id);
    expect(typeof item.name).toBe('string');
    expect(typeof item.quantity).toBe('number');
    expect(typeof item.unit_price).toBe('number');
    expect(typeof item.total_price).toBe('number');
    expect(item.created_at).toBeInstanceOf(Date);
  });

  it('should handle receipts with no items', async () => {
    // Create receipt without items
    await db.insert(receiptsTable)
      .values({
        store_name: 'Empty Store',
        total_amount: '0.00',
        receipt_date: new Date('2024-01-01'),
        image_url: null
      })
      .execute();

    const input: SearchReceiptsInput = {};
    const results = await searchReceipts(input);

    expect(results).toHaveLength(1);
    expect(results[0].store_name).toBe('Empty Store');
    expect(results[0].items).toHaveLength(0);
  });
});