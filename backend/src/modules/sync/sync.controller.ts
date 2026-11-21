import { Request, Response, NextFunction } from 'express';
import { syncService } from './sync.service';

export class SyncController {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await syncService.getSyncStatus();
      res.json(status);
    } catch (err) {
      next(err);
    }
  }

  async triggerSync(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await syncService.processPendingSyncBatch();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const syncController = new SyncController();
