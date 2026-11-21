import { pool, withTransaction } from '../../config/database';
import { CreateTransactionDto, PaymentMethod, PaymentStatus, ReasonCode } from '../../types';

export class TransactionsService {
  /**
   * Process a checkout transaction with database-level row locking.
   * Ensures multi-counter LAN concurrency safety without overselling.
   */
  async createTransaction(dto: CreateTransactionDto, cashierId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw { statusCode: 400, message: 'Transaction must include at least one item' };
    }

    // Sort product IDs deterministically to eliminate deadlocks across concurrent terminals
    const sortedItems = [...dto.items].sort((a, b) => a.productId.localeCompare(b.productId));

    return await withTransaction(async (client) => {
      const receiptNumber = `REC-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      const processedItems: Array<{
        productId: string;
        name: string;
        barcode: string;
        quantity: number;
        unitPrice: number;
        gstRate: number;
        gstAmount: number;
        discountAmount: number;
        totalPrice: number;
      }> = [];

      for (const item of sortedItems) {
        // 1. Concurrency Control: Exclusive row lock on each product
        const prodRes = await client.query(
          `SELECT id, barcode, sku, name, selling_price, gst_rate, stock_quantity, version
           FROM products
           WHERE id = $1 FOR UPDATE`,
          [item.productId]
        );

        if (prodRes.rowCount === 0) {
          throw { statusCode: 404, message: `Product ${item.productId} not found` };
        }

        const product = prodRes.rows[0];
        const currentStock = parseInt(product.stock_quantity, 10);
        const requestedQty = item.quantity;

        if (requestedQty <= 0) {
          throw { statusCode: 400, message: `Invalid quantity ${requestedQty} for product ${product.name}` };
        }

        if (currentStock < requestedQty) {
          throw {
            statusCode: 409,
            message: `Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${requestedQty}`,
          };
        }

        const unitPrice = parseFloat(product.selling_price);
        const gstRate = parseFloat(product.gst_rate);
        const itemDiscount = item.discountAmount || 0;
        const itemGross = unitPrice * requestedQty - itemDiscount;

        // GST calculation: price inclusive of tax or added depending on setup (standard retail tax calculation)
        // Here: Tax = (Taxable Value * GST%) / 100
        const itemTax = (itemGross * gstRate) / (100 + gstRate); // Inclusive calculation
        const itemTaxable = itemGross - itemTax;

        subtotal += itemTaxable;
        totalTax += itemTax;
        totalDiscount += itemDiscount;

        const newStock = currentStock - requestedQty;

        // 2. Deduct stock and increment version
        await client.query(
          `UPDATE products
           SET stock_quantity = $1, version = version + 1, updated_at = NOW()
           WHERE id = $2`,
          [newStock, product.id]
        );

        // 3. Write immutable audit ledger entry for SALE
        await client.query(
          `INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, reference_id, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            product.id,
            -requestedQty,
            currentStock,
            newStock,
            ReasonCode.SALE,
            receiptNumber,
            `POS Checkout from ${dto.counterId}`,
            cashierId,
          ]
        );

        processedItems.push({
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          quantity: requestedQty,
          unitPrice,
          gstRate,
          gstAmount: Math.round(itemTax * 100) / 100,
          discountAmount: itemDiscount,
          totalPrice: Math.round(itemGross * 100) / 100,
        });
      }

      const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

      // 4. Record Transaction Header
      const txRes = await client.query(
        `INSERT INTO transactions (
           receipt_number, cashier_id, counter_id, subtotal, total_tax,
           total_discount, grand_total, payment_method, payment_status, notes, sync_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
         RETURNING id, receipt_number as "receiptNumber", cashier_id as "cashierId", counter_id as "counterId",
                   subtotal, total_tax as "totalTax", total_discount as "totalDiscount", grand_total as "grandTotal",
                   payment_method as "paymentMethod", payment_status as "paymentStatus", sync_status as "syncStatus",
                   created_at as "createdAt"`,
        [
          receiptNumber,
          cashierId,
          dto.counterId,
          Math.round(subtotal * 100) / 100,
          Math.round(totalTax * 100) / 100,
          totalDiscount,
          grandTotal,
          dto.paymentMethod || PaymentMethod.CASH,
          PaymentStatus.COMPLETED,
          dto.notes || null,
        ]
      );

      const transaction = txRes.rows[0];

      // 5. Record Transaction Line Items
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, gst_rate, gst_amount, discount_amount, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transaction.id,
            item.productId,
            item.quantity,
            item.unitPrice,
            item.gstRate,
            item.gstAmount,
            item.discountAmount,
            item.totalPrice,
          ]
        );
      }

      // 6. Queue into sync_queue for Azure background synchronization
      await client.query(
        `INSERT INTO sync_queue (entity_type, entity_id, payload, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [
          'TRANSACTION',
          transaction.id,
          JSON.stringify({
            transaction,
            items: processedItems,
            timestamp: transaction.createdAt,
          }),
        ]
      );

      return {
        ...transaction,
        items: processedItems,
      };
    });
  }

  async getTransactions(limit = 50) {
    const res = await pool.query(
      `SELECT t.id, t.receipt_number as "receiptNumber", t.counter_id as "counterId",
              t.cashier_id as "cashierId", u.full_name as "cashierName",
              t.subtotal, t.total_tax as "totalTax", t.total_discount as "totalDiscount",
              t.grand_total as "grandTotal", t.payment_method as "paymentMethod",
              t.payment_status as "paymentStatus", t.sync_status as "syncStatus",
              t.created_at as "createdAt"
       FROM transactions t
       JOIN users u ON t.cashier_id = u.id
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map((row) => ({
      ...row,
      subtotal: parseFloat(row.subtotal),
      totalTax: parseFloat(row.totalTax),
      totalDiscount: parseFloat(row.totalDiscount),
      grandTotal: parseFloat(row.grandTotal),
    }));
  }

  async getTransactionById(id: string) {
    const txRes = await pool.query(
      `SELECT t.id, t.receipt_number as "receiptNumber", t.counter_id as "counterId",
              t.cashier_id as "cashierId", u.full_name as "cashierName",
              t.subtotal, t.total_tax as "totalTax", t.total_discount as "totalDiscount",
              t.grand_total as "grandTotal", t.payment_method as "paymentMethod",
              t.payment_status as "paymentStatus", t.notes, t.sync_status as "syncStatus",
              t.created_at as "createdAt"
       FROM transactions t
       JOIN users u ON t.cashier_id = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (txRes.rowCount === 0) {
      throw { statusCode: 404, message: 'Transaction not found' };
    }

    const itemsRes = await pool.query(
      `SELECT ti.id, ti.product_id as "productId", p.name as "productName", p.barcode,
              ti.quantity, ti.unit_price as "unitPrice", ti.gst_rate as "gstRate",
              ti.gst_amount as "gstAmount", ti.discount_amount as "discountAmount",
              ti.total_price as "totalPrice"
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       WHERE ti.transaction_id = $1`,
      [id]
    );

    return {
      ...txRes.rows[0],
      subtotal: parseFloat(txRes.rows[0].subtotal),
      totalTax: parseFloat(txRes.rows[0].totalTax),
      totalDiscount: parseFloat(txRes.rows[0].totalDiscount),
      grandTotal: parseFloat(txRes.rows[0].grandTotal),
      items: itemsRes.rows.map((item) => ({
        ...item,
        unitPrice: parseFloat(item.unitPrice),
        gstRate: parseFloat(item.gstRate),
        gstAmount: parseFloat(item.gstAmount),
        discountAmount: parseFloat(item.discountAmount),
        totalPrice: parseFloat(item.totalPrice),
      })),
    };
  }
}

export const transactionsService = new TransactionsService();
