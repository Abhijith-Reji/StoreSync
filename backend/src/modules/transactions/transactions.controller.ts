import { Request, Response, NextFunction } from 'express';
import { transactionsService } from './transactions.service';

export class TransactionsController {
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = req.user!.id;
      const result = await transactionsService.createTransaction(req.body, cashierId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const transactions = await transactionsService.getTransactions(limit);
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  }

  async getTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const transaction = await transactionsService.getTransactionById(req.params.id);
      res.json(transaction);
    } catch (err) {
      next(err);
    }
  }
}

export const transactionsController = new TransactionsController();
