import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';
import { ReasonCode } from '../../types';

export class InventoryController {
  async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await inventoryService.getProducts();
      res.json({ products });
    } catch (err) {
      next(err);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await inventoryService.getProductById(req.params.id);
      res.json({ product });
    } catch (err) {
      next(err);
    }
  }

  async searchProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string;
      if (!q) {
        res.status(400).json({ error: 'Search query parameter q is required' });
        return;
      }
      const products = await inventoryService.searchProduct(q);
      res.json(products);
    } catch (err) {
      next(err);
    }
  }

  async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await inventoryService.getDashboardSummary();
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  }

  async getLowStockAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const alerts = await inventoryService.getLowStockAlerts(limit, offset);
      res.json({ alerts, count: alerts.length });
    } catch (err) {
      next(err);
    }
  }

  async getStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'month';
      const movement = await inventoryService.getStockMovement(timeframe);
      res.json({ timeframe, movement });
    } catch (err) {
      next(err);
    }
  }

  async getFastMovingProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
      const products = await inventoryService.getFastMovingProducts(limit);
      res.json({ products });
    } catch (err) {
      next(err);
    }
  }

  async getCategoryBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const breakdown = await inventoryService.getCategoryBreakdown();
      res.json({ breakdown });
    } catch (err) {
      next(err);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        barcode,
        sku,
        name,
        description,
        categoryId,
        costPrice,
        sellingPrice,
        gstRate,
        initialStock,
        minStockAlert,
      } = req.body;

      const product = await inventoryService.createProduct(
        {
          barcode,
          sku,
          name,
          description,
          categoryId,
          costPrice: parseFloat(costPrice) || 0,
          sellingPrice: parseFloat(sellingPrice),
          gstRate: parseFloat(gstRate) || 0,
          initialStock: initialStock !== undefined ? parseInt(initialStock, 10) : 0,
          minStockAlert: minStockAlert !== undefined ? parseInt(minStockAlert, 10) : 10,
        },
        req.user!.id
      );

      res.status(201).json({ product });
    } catch (err) {
      next(err);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await inventoryService.updateProduct(req.params.id, req.body);
      res.json({ product });
    } catch (err) {
      next(err);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.deleteProduct(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async bulkRestock(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceReference, supplierName, notes, items } = req.body;
      const result = await inventoryService.bulkRestock(
        {
          invoiceReference,
          supplierName,
          notes,
          items,
        },
        req.user!.id
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async listLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, reasonCode, startDate, endDate, userId, limit, offset } = req.query;

      if (productId || reasonCode || startDate || endDate || userId) {
        const result = await inventoryService.getLedgerFiltered({
          productId: productId as string,
          reasonCode: reasonCode as ReasonCode,
          startDate: startDate as string,
          endDate: endDate as string,
          userId: userId as string,
          limit: limit ? parseInt(limit as string, 10) : 50,
          offset: offset ? parseInt(offset as string, 10) : 0,
        });
        res.json(result);
        return;
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      const ledger = await inventoryService.getLedger(limitNum);
      res.json(ledger);
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, changeQuantity, reasonCode, notes } = req.body;
      if (!productId || changeQuantity === undefined || !reasonCode || !notes) {
        res.status(400).json({
          error: 'productId, changeQuantity, reasonCode, and notes are required for manual stock adjustment',
        });
        return;
      }

      const result = await inventoryService.adjustStock({
        productId,
        changeQuantity: parseInt(changeQuantity, 10),
        reasonCode,
        notes,
        userId: req.user!.id,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const inventoryController = new InventoryController();
