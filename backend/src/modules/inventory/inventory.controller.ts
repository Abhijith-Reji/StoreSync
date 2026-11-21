import { Request, Response, NextFunction } from 'express';
import { inventoryService } from './inventory.service';

export class InventoryController {
  async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await inventoryService.getProducts();
      res.json(products);
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

  async listLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const ledger = await inventoryService.getLedger(limit);
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
