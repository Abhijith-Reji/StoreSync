import { pool, withTransaction } from '../../config/database';
import {
  ReasonCode,
  DashboardSummary,
  LowStockAlertItem,
  StockMovementItem,
  FastMovingProduct,
  CategoryBreakdownItem,
  CreateProductDto,
  UpdateProductDto,
  BulkRestockDto,
} from '../../types';

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
      minStockAlert: parseInt(row.minStockAlert, 10),
    }));
  }

  async getProductById(id: string) {
    const res = await pool.query(
      `SELECT p.id, p.barcode, p.sku, p.name, p.description, p.category_id as "categoryId",
              c.name as "categoryName", p.cost_price as "costPrice", p.selling_price as "sellingPrice",
              p.gst_rate as "gstRate", p.stock_quantity as "stockQuantity", p.min_stock_alert as "minStockAlert",
              p.is_active as "isActive", p.version, p.created_at as "createdAt", p.updated_at as "updatedAt"
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const ledgerRes = await pool.query(
      `SELECT l.id, l.change_quantity as "changeQuantity", l.previous_quantity as "previousQuantity",
              l.new_quantity as "newQuantity", l.reason_code as "reasonCode",
              l.reference_id as "referenceId", l.notes,
              u.full_name as "createdByName", l.created_at as "createdAt"
       FROM inventory_ledger l
       LEFT JOIN users u ON l.created_by = u.id
       WHERE l.product_id = $1
       ORDER BY l.created_at DESC
       LIMIT 10`,
      [id]
    );

    const product = res.rows[0];
    return {
      ...product,
      costPrice: parseFloat(product.costPrice),
      sellingPrice: parseFloat(product.sellingPrice),
      gstRate: parseFloat(product.gstRate),
      stockQuantity: parseInt(product.stockQuantity, 10),
      minStockAlert: parseInt(product.minStockAlert, 10),
      recentLedger: ledgerRes.rows,
    };
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
      minStockAlert: parseInt(row.minStockAlert, 10),
    }));
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const statsRes = await pool.query(
      `SELECT 
         COUNT(*)::int as "totalProducts",
         COALESCE(SUM(stock_quantity), 0)::int as "totalStockUnits",
         COALESCE(SUM(stock_quantity * cost_price), 0.00)::numeric(14,2) as "totalCostValue",
         COALESCE(SUM(stock_quantity * selling_price), 0.00)::numeric(14,2) as "totalRetailValue",
         COUNT(*) FILTER (WHERE stock_quantity <= min_stock_alert AND stock_quantity > 0)::int as "lowStockCount",
         COUNT(*) FILTER (WHERE stock_quantity = 0)::int as "outOfStockCount"
       FROM products
       WHERE is_active = TRUE`
    );

    const adjRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM inventory_ledger WHERE created_at >= CURRENT_DATE`
    );

    const row = statsRes.rows[0];
    const costVal = parseFloat(row.totalCostValue);
    const retailVal = parseFloat(row.totalRetailValue);
    const profit = retailVal - costVal;
    const margin = retailVal > 0 ? (profit / retailVal) * 100 : 0;

    return {
      totalProducts: row.totalProducts,
      totalStockUnits: row.totalStockUnits,
      totalCostValue: costVal,
      totalRetailValue: retailVal,
      potentialProfit: parseFloat(profit.toFixed(2)),
      profitMarginPercent: parseFloat(margin.toFixed(2)),
      lowStockCount: row.lowStockCount,
      outOfStockCount: row.outOfStockCount,
      adjustmentsTodayCount: adjRes.rows[0].count,
      timestamp: new Date().toISOString(),
    };
  }

  async getLowStockAlerts(limit = 50, offset = 0): Promise<LowStockAlertItem[]> {
    const res = await pool.query(
      `SELECT p.id, p.barcode, p.sku, p.name, COALESCE(c.name, 'Uncategorized') as "categoryName",
              p.stock_quantity as "stockQuantity", p.min_stock_alert as "minStockAlert",
              GREATEST(0, (p.min_stock_alert - p.stock_quantity))::int as "deficit",
              p.cost_price as "costPrice", p.selling_price as "sellingPrice",
              CASE 
                WHEN p.min_stock_alert = 0 THEN 0.00 
                ELSE ROUND((p.stock_quantity::numeric / p.min_stock_alert), 2)::float 
              END as "urgencyRatio"
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = TRUE AND p.stock_quantity <= p.min_stock_alert
       ORDER BY (p.stock_quantity::numeric / NULLIF(p.min_stock_alert, 0)) ASC, p.stock_quantity ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.rows.map((row) => ({
      ...row,
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      stockQuantity: parseInt(row.stockQuantity, 10),
      minStockAlert: parseInt(row.minStockAlert, 10),
      urgencyRatio: parseFloat(row.urgencyRatio),
    }));
  }

  async getStockMovement(timeframe: 'day' | 'week' | 'month' = 'month'): Promise<StockMovementItem[]> {
    let intervalClause = "NOW() - INTERVAL '30 days'";
    if (timeframe === 'day') intervalClause = "NOW() - INTERVAL '24 hours'";
    if (timeframe === 'week') intervalClause = "NOW() - INTERVAL '7 days'";

    const res = await pool.query(
      `SELECT reason_code as "reasonCode",
              COUNT(*)::int as "entryCount",
              COALESCE(SUM(ABS(change_quantity)), 0)::int as "totalQuantity",
              COALESCE(SUM(change_quantity), 0)::int as "netUnits"
       FROM inventory_ledger
       WHERE created_at >= ${intervalClause}
       GROUP BY reason_code
       ORDER BY "totalQuantity" DESC`
    );

    return res.rows;
  }

  async getFastMovingProducts(limit = 5): Promise<FastMovingProduct[]> {
    const res = await pool.query(
      `SELECT ti.product_id as "productId", p.name as "productName", p.barcode,
              COALESCE(c.name, 'Uncategorized') as "categoryName",
              COALESCE(SUM(ti.quantity), 0)::int as "unitsSold",
              COALESCE(SUM(ti.total_price), 0)::numeric(12,2) as "revenue"
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE t.created_at >= NOW() - INTERVAL '30 days' AND t.payment_status = 'COMPLETED'
       GROUP BY ti.product_id, p.name, p.barcode, c.name
       ORDER BY "unitsSold" DESC
       LIMIT $1`,
      [limit]
    );

    return res.rows.map((r) => ({
      ...r,
      revenue: parseFloat(r.revenue),
    }));
  }

  async getCategoryBreakdown(): Promise<CategoryBreakdownItem[]> {
    const res = await pool.query(
      `SELECT c.id as "categoryId", c.name as "categoryName", c.code as "categoryCode",
              COUNT(p.id)::int as "productCount",
              COALESCE(SUM(p.stock_quantity), 0)::int as "totalStockUnits",
              COALESCE(SUM(p.stock_quantity * p.cost_price), 0)::numeric(12,2) as "totalCostValue",
              COALESCE(SUM(p.stock_quantity * p.selling_price), 0)::numeric(12,2) as "totalRetailValue",
              COUNT(p.id) FILTER (WHERE p.stock_quantity <= p.min_stock_alert)::int as "lowStockCount"
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY "totalRetailValue" DESC`
    );

    return res.rows.map((r) => ({
      ...r,
      totalCostValue: parseFloat(r.totalCostValue),
      totalRetailValue: parseFloat(r.totalRetailValue),
    }));
  }

  async createProduct(dto: CreateProductDto, userId: string) {
    if (!dto.barcode || !dto.sku || !dto.name || dto.sellingPrice === undefined) {
      throw { statusCode: 400, message: 'Barcode, SKU, Name, and Selling Price are required' };
    }

    // Verify barcode and SKU uniqueness
    const conflictCheck = await pool.query(
      `SELECT id, barcode, sku FROM products WHERE barcode = $1 OR sku = $2`,
      [dto.barcode.trim(), dto.sku.trim()]
    );
    if (conflictCheck.rowCount && conflictCheck.rowCount > 0) {
      throw { statusCode: 409, message: 'A product with this Barcode or SKU already exists' };
    }

    return await withTransaction(async (client) => {
      const prodRes = await client.query(
        `INSERT INTO products (
           barcode, sku, name, description, category_id,
           cost_price, selling_price, gst_rate, stock_quantity,
           min_stock_alert, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
         RETURNING id, barcode, sku, name, description, category_id as "categoryId",
                   cost_price as "costPrice", selling_price as "sellingPrice",
                   gst_rate as "gstRate", stock_quantity as "stockQuantity",
                   min_stock_alert as "minStockAlert", is_active as "isActive",
                   version, created_at as "createdAt"`,
        [
          dto.barcode.trim(),
          dto.sku.trim(),
          dto.name.trim(),
          dto.description || null,
          dto.categoryId || null,
          dto.costPrice || 0,
          dto.sellingPrice,
          dto.gstRate || 0,
          dto.initialStock || 0,
          dto.minStockAlert || 10,
        ]
      );

      const created = prodRes.rows[0];

      // If initial stock is greater than 0, create initial RESTOCK ledger entry
      if (dto.initialStock && dto.initialStock > 0) {
        await client.query(
          `INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, reference_id, notes, created_by)
           VALUES ($1, $2, 0, $2, 'RESTOCK', 'INITIAL-ONBOARD', 'Initial catalog stock onboarding', $3)`,
          [created.id, dto.initialStock, userId]
        );
      }

      return {
        ...created,
        costPrice: parseFloat(created.costPrice),
        sellingPrice: parseFloat(created.sellingPrice),
        gstRate: parseFloat(created.gstRate),
        stockQuantity: parseInt(created.stockQuantity, 10),
        minStockAlert: parseInt(created.minStockAlert, 10),
      };
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(dto.description ? dto.description.trim() : null);
    }
    if (dto.categoryId !== undefined) {
      updates.push(`category_id = $${idx++}`);
      values.push(dto.categoryId || null);
    }
    if (dto.costPrice !== undefined) {
      updates.push(`cost_price = $${idx++}`);
      values.push(dto.costPrice);
    }
    if (dto.sellingPrice !== undefined) {
      updates.push(`selling_price = $${idx++}`);
      values.push(dto.sellingPrice);
    }
    if (dto.gstRate !== undefined) {
      updates.push(`gst_rate = $${idx++}`);
      values.push(dto.gstRate);
    }
    if (dto.minStockAlert !== undefined) {
      updates.push(`min_stock_alert = $${idx++}`);
      values.push(dto.minStockAlert);
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    if (updates.length === 0) {
      return await this.getProductById(id);
    }

    updates.push(`version = version + 1`);
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const res = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, barcode, sku, name, description, category_id as "categoryId",
                 cost_price as "costPrice", selling_price as "sellingPrice",
                 gst_rate as "gstRate", stock_quantity as "stockQuantity",
                 min_stock_alert as "minStockAlert", is_active as "isActive",
                 version, updated_at as "updatedAt"`,
      values
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found' };
    }

    const row = res.rows[0];
    return {
      ...row,
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      gstRate: parseFloat(row.gstRate),
      stockQuantity: parseInt(row.stockQuantity, 10),
      minStockAlert: parseInt(row.minStockAlert, 10),
    };
  }

  async deleteProduct(id: string) {
    const res = await pool.query(
      `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE RETURNING id, name`,
      [id]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Product not found or already deleted' };
    }

    return { success: true, message: `Product '${res.rows[0].name}' soft deleted successfully` };
  }

  async bulkRestock(dto: BulkRestockDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw { statusCode: 400, message: 'At least one product item is required for bulk restock' };
    }

    if (!dto.invoiceReference || dto.invoiceReference.trim().length === 0) {
      throw { statusCode: 400, message: 'Invoice or purchase reference number is mandatory' };
    }

    return await withTransaction(async (client) => {
      const restockedResults = [];

      for (const item of dto.items) {
        if (!item.quantity || item.quantity <= 0) {
          throw { statusCode: 400, message: `Invalid restock quantity for product ${item.productId}` };
        }

        // Lock product row
        const prodRes = await client.query(
          `SELECT id, name, stock_quantity, cost_price, version FROM products WHERE id = $1 FOR UPDATE`,
          [item.productId]
        );

        if (prodRes.rowCount === 0) {
          throw { statusCode: 404, message: `Product with ID ${item.productId} not found` };
        }

        const product = prodRes.rows[0];
        const previousQty = parseInt(product.stock_quantity, 10);
        const newQty = previousQty + item.quantity;

        // Optionally update cost price if purchase invoice has updated cost
        let costPriceUpdate = '';
        const updateParams: any[] = [newQty, item.productId];
        if (item.costPrice !== undefined && item.costPrice > 0) {
          costPriceUpdate = ', cost_price = $3';
          updateParams.push(item.costPrice);
        }

        await client.query(
          `UPDATE products 
           SET stock_quantity = $1, version = version + 1, updated_at = NOW() ${costPriceUpdate}
           WHERE id = $2`,
          updateParams
        );

        // Immutable ledger record
        const ledgerNotes = dto.supplierName
          ? `Bulk restock from ${dto.supplierName}. ${dto.notes || ''}`.trim()
          : dto.notes || 'Bulk restock arrival';

        const ledgerRes = await client.query(
          `INSERT INTO inventory_ledger (product_id, change_quantity, previous_quantity, new_quantity, reason_code, reference_id, notes, created_by)
           VALUES ($1, $2, $3, $4, 'RESTOCK', $5, $6, $7)
           RETURNING id, product_id as "productId", change_quantity as "changeQuantity", new_quantity as "newQuantity"`,
          [item.productId, item.quantity, previousQty, newQty, dto.invoiceReference.trim(), ledgerNotes, userId]
        );

        // Queue for Azure Sync
        await client.query(
          `INSERT INTO sync_queue (entity_type, entity_id, payload, status)
           VALUES ('INVENTORY_LEDGER', $1, $2, 'PENDING')`,
          [
            ledgerRes.rows[0].id,
            JSON.stringify({
              productId: item.productId,
              changeQuantity: item.quantity,
              newQuantity: newQty,
              reasonCode: 'RESTOCK',
              referenceId: dto.invoiceReference,
              timestamp: new Date().toISOString(),
            }),
          ]
        );

        restockedResults.push({
          productId: product.id,
          productName: product.name,
          addedQuantity: item.quantity,
          previousQuantity: previousQty,
          newQuantity: newQty,
        });
      }

      return {
        invoiceReference: dto.invoiceReference,
        supplierName: dto.supplierName || null,
        totalItemsRestocked: restockedResults.length,
        items: restockedResults,
      };
    });
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

  async getLedgerFiltered(filters: {
    productId?: string;
    reasonCode?: ReasonCode;
    startDate?: string;
    endDate?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.productId) {
      conditions.push(`l.product_id = $${idx++}`);
      values.push(filters.productId);
    }
    if (filters.reasonCode) {
      conditions.push(`l.reason_code = $${idx++}`);
      values.push(filters.reasonCode);
    }
    if (filters.userId) {
      conditions.push(`l.created_by = $${idx++}`);
      values.push(filters.userId);
    }
    if (filters.startDate) {
      conditions.push(`l.created_at >= $${idx++}`);
      values.push(new Date(filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(`l.created_at <= $${idx++}`);
      values.push(new Date(filters.endDate));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM inventory_ledger l ${whereClause}`,
      values
    );

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const dataRes = await pool.query(
      `SELECT l.id, l.product_id as "productId", p.name as "productName", p.barcode,
              l.change_quantity as "changeQuantity", l.previous_quantity as "previousQuantity",
              l.new_quantity as "newQuantity", l.reason_code as "reasonCode",
              l.reference_id as "referenceId", l.notes,
              u.full_name as "createdByName", l.created_at as "createdAt"
       FROM inventory_ledger l
       JOIN products p ON l.product_id = p.id
       LEFT JOIN users u ON l.created_by = u.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return {
      total: countRes.rows[0].total,
      limit,
      offset,
      entries: dataRes.rows,
    };
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
