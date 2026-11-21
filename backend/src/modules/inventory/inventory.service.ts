import { pool, withTransaction } from '../../config/database';
import { ReasonCode } from '../../types';

export class InventoryService {
  async getProducts() {
    const res = await pool.query(
      `SELECT p.id, p.barcode, p.sku, p.name, p.description, p.category_id as "categoryId",
              c.name as "categoryName", p.cost_price as "costPrice", p.selling_price as "sellingPrice",
              p.gst_rate as "gstRate", p.stock_quantity as "stockQuantity", p.min_stock_alert as "minStockAlert",
              p.is_active as "isActive", p.version, p.updated_at as "updatedAt"
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = TRUE
       ORDER BY p.name ASC`
    );
    return res.rows.map((row) => ({
      ...row,
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      gstRate: parseFloat(row.gstRate),
      stockQuantity: parseInt(row.stockQuantity, 10),
    }));
  }

  async searchProduct(query: string) {
    const term = `%${query.trim()}%`;
    const res = await pool.query(
      `SELECT p.id, p.barcode, p.sku, p.name, p.description, p.category_id as "categoryId",
              c.name as "categoryName", p.cost_price as "costPrice", p.selling_price as "sellingPrice",
              p.gst_rate as "gstRate", p.stock_quantity as "stockQuantity", p.min_stock_alert as "minStockAlert",
              p.is_active as "isActive"
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = TRUE AND (p.barcode = $1 OR p.name ILIKE $2 OR p.sku ILIKE $2)
       LIMIT 15`,
      [query.trim(), term]
    );
    return res.rows.map((row) => ({
      ...row,
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      gstRate: parseFloat(row.gstRate),
      stockQuantity: parseInt(row.stockQuantity, 10),
    }));
  }

  async getLedger(limit = 100) {
    const res = await pool.query(
      `SELECT l.id, l.product_id as "productId", p.name as "productName", p.barcode,
              l.change_quantity as "changeQuantity", l.previous_quantity as "previousQuantity",
              l.new_quantity as "newQuantity", l.reason_code as "reasonCode",
              l.reference_id as "referenceId", l.notes,
              u.full_name as "createdByName", l.created_at as "createdAt"
       FROM inventory_ledger l
       JOIN products p ON l.product_id = p.id
       LEFT JOIN users u ON l.created_by = u.id
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  async adjustStock(dto: {
    productId: string;
    changeQuantity: number;
    reasonCode: ReasonCode;
    notes: string;
    userId: string;
  }) {
    if (!dto.reasonCode || !Object.values(ReasonCode).includes(dto.reasonCode)) {
      throw { statusCode: 400, message: 'A valid reason code is mandatory for all inventory adjustments' };
    }

    if (dto.reasonCode === ReasonCode.SALE) {
      throw { statusCode: 400, message: 'Direct manual adjustment cannot have reason SALE. Use POS checkout.' };
    }

    if (!dto.notes || dto.notes.trim().length === 0) {
      throw { statusCode: 400, message: 'Mandatory reason explanation / note is required for audit trail' };
    }

    return await withTransaction(async (client) => {
      // Row-level lock to prevent concurrent stock calculation issues
      const prodRes = await client.query(
        `SELECT id, name, stock_quantity, version FROM products WHERE id = $1 FOR UPDATE`,
        [dto.productId]
      );

      if (prodRes.rowCount === 0) {
        throw { statusCode: 404, message: 'Product not found' };
      }

      const product = prodRes.rows[0];
      const previousQuantity = parseInt(product.stock_quantity, 10);
      const newQuantity = previousQuantity + dto.changeQuantity;

      if (newQuantity < 0) {
        throw {
          statusCode: 400,
          message: `Stock reduction cannot exceed current stock. Current: ${previousQuantity}, requested change: ${dto.changeQuantity}`,
        };
      }

      // Update product stock
      await client.query(
        `UPDATE products
         SET stock_quantity = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2`,
        [newQuantity, dto.productId]
      );

      // Create immutable audit ledger record
      const ledgerRes = await client.query(
        `INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, reference_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, product_id as "productId", change_quantity as "changeQuantity", previous_quantity as "previousQuantity",
                   new_quantity as "newQuantity", reason_code as "reasonCode", reference_id as "referenceId",
                   notes, created_at as "createdAt"`,
        [
          dto.productId,
          dto.changeQuantity,
          previousQuantity,
          newQuantity,
          dto.reasonCode,
          `MANUAL-${Date.now()}`,
          dto.notes.trim(),
          dto.userId,
        ]
      );

      // Queue for Azure cloud sync
      await client.query(
        `INSERT INTO sync_queue (entity_type, entity_id, payload, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [
          'INVENTORY_LEDGER',
          ledgerRes.rows[0].id,
          JSON.stringify({
            productId: dto.productId,
            changeQuantity: dto.changeQuantity,
            newQuantity,
            reasonCode: dto.reasonCode,
            notes: dto.notes,
            timestamp: new Date().toISOString(),
          }),
        ]
      );

      return {
        product: {
          id: product.id,
          name: product.name,
          stockQuantity: newQuantity,
        },
        ledgerEntry: ledgerRes.rows[0],
      };
    });
  }
}

export const inventoryService = new InventoryService();
