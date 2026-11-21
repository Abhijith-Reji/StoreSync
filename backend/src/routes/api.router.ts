import { Router } from 'express';
import { authController } from '../modules/auth/auth.controller';
import { usersController } from '../modules/users/users.controller';
import { inventoryController } from '../modules/inventory/inventory.controller';
import { transactionsController } from '../modules/transactions/transactions.controller';
import { receiptsController } from '../modules/receipts/receipts.controller';
import { syncController } from '../modules/sync/sync.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '../types';
import { config } from '../config/env';
import { pool } from '../config/database';

export const apiRouter = Router();

// Public / Health Endpoints
apiRouter.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time');
    res.json({
      status: 'healthy',
      app: 'StockSync Local API',
      counterId: config.pos.counterId,
      database: 'connected',
      dbTime: dbRes.rows[0].db_time,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Authentication Routes
apiRouter.post('/auth/login', (req, res, next) => authController.login(req, res, next));
apiRouter.post('/auth/refresh', (req, res, next) => authController.refresh(req, res, next));
apiRouter.get('/auth/me', authenticateToken, (req, res) => authController.me(req, res));

// User Management Routes (Owner & Manager Only)
apiRouter.get('/users', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.listUsers(req, res, next)
);
apiRouter.post('/users', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.createUser(req, res, next)
);
apiRouter.patch('/users/:id/status', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.toggleStatus(req, res, next)
);

// Products & Inventory Catalog (Authenticated POS Staff)
apiRouter.get('/products', authenticateToken, (req, res, next) =>
  inventoryController.listProducts(req, res, next)
);
apiRouter.get('/products/search', authenticateToken, (req, res, next) =>
  inventoryController.searchProduct(req, res, next)
);
apiRouter.get('/products/ledger', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.listLedger(req, res, next)
);
apiRouter.post('/products/adjust-stock', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.adjustStock(req, res, next)
);

// POS Checkout & Transactions
apiRouter.post('/transactions', authenticateToken, (req, res, next) =>
  transactionsController.checkout(req, res, next)
);
apiRouter.get('/transactions', authenticateToken, (req, res, next) =>
  transactionsController.listTransactions(req, res, next)
);
apiRouter.get('/transactions/:id', authenticateToken, (req, res, next) =>
  transactionsController.getTransaction(req, res, next)
);

// Receipt Generation Engine (PDF & Structured Payload)
apiRouter.get('/receipts/:id/payload', authenticateToken, (req, res, next) =>
  receiptsController.getPayload(req, res, next)
);
apiRouter.get('/receipts/:id/pdf', authenticateToken, (req, res, next) =>
  receiptsController.downloadPdf(req, res, next)
);

// Cloud Sync Engine (Owner & Manager)
apiRouter.get('/sync/status', authenticateToken, (req, res, next) =>
  syncController.getStatus(req, res, next)
);
apiRouter.post('/sync/trigger', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  syncController.triggerSync(req, res, next)
);
