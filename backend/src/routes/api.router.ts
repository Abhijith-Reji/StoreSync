import { Router } from 'express';
import { authController } from '../modules/auth/auth.controller';
import { usersController } from '../modules/users/users.controller';
import { categoriesController } from '../modules/categories/categories.controller';
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

// ============================================================
// 1. Public & Health Check Endpoints
// ============================================================
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

// ============================================================
// 2. Authentication & Session Management
// ============================================================
apiRouter.post('/auth/login', (req, res, next) => authController.login(req, res, next));
apiRouter.post('/auth/refresh', (req, res, next) => authController.refresh(req, res, next));
apiRouter.post('/auth/logout', authenticateToken, (req, res, next) => authController.logout(req, res, next));
apiRouter.post('/auth/logout-all', authenticateToken, (req, res, next) => authController.logoutAll(req, res, next));
apiRouter.get('/auth/sessions', authenticateToken, (req, res, next) => authController.getSessions(req, res, next));
apiRouter.delete('/auth/sessions/:sessionId', authenticateToken, (req, res, next) =>
  authController.revokeSession(req, res, next)
);
apiRouter.post('/auth/change-password', authenticateToken, (req, res, next) =>
  authController.changePassword(req, res, next)
);
apiRouter.get('/auth/me', authenticateToken, (req, res) => authController.me(req, res));

// ============================================================
// 3. User & Staff Management (Owner & Manager Only)
// ============================================================
apiRouter.get('/users', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.listUsers(req, res, next)
);
apiRouter.get('/users/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.getUser(req, res, next)
);
apiRouter.post('/users', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.createUser(req, res, next)
);
apiRouter.put('/users/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.updateUser(req, res, next)
);
apiRouter.patch('/users/:id/status', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  usersController.toggleStatus(req, res, next)
);

// ============================================================
// 4. Category Management
// ============================================================
apiRouter.get('/categories', authenticateToken, (req, res, next) =>
  categoriesController.listCategories(req, res, next)
);
apiRouter.get('/categories/:id', authenticateToken, (req, res, next) =>
  categoriesController.getCategory(req, res, next)
);
apiRouter.post('/categories', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  categoriesController.createCategory(req, res, next)
);
apiRouter.put('/categories/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  categoriesController.updateCategory(req, res, next)
);
apiRouter.delete('/categories/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  categoriesController.deleteCategory(req, res, next)
);

// ============================================================
// 5. Stock Management Dashboard & Intelligence (Owner & Manager)
// ============================================================
apiRouter.get('/inventory/dashboard/summary', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.getDashboardSummary(req, res, next)
);
apiRouter.get('/inventory/dashboard/low-stock', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.getLowStockAlerts(req, res, next)
);
apiRouter.get('/inventory/dashboard/movement', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.getStockMovement(req, res, next)
);
apiRouter.get('/inventory/dashboard/fast-moving', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.getFastMovingProducts(req, res, next)
);
apiRouter.get('/inventory/dashboard/category-breakdown', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.getCategoryBreakdown(req, res, next)
);

// ============================================================
// 6. Product Catalog & Operations
// ============================================================
apiRouter.get('/products', authenticateToken, (req, res, next) =>
  inventoryController.listProducts(req, res, next)
);
apiRouter.get('/products/search', authenticateToken, (req, res, next) =>
  inventoryController.searchProduct(req, res, next)
);
apiRouter.get('/products/:id', authenticateToken, (req, res, next) =>
  inventoryController.getProductById(req, res, next)
);
apiRouter.post('/products', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.createProduct(req, res, next)
);
apiRouter.put('/products/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.updateProduct(req, res, next)
);
apiRouter.delete('/products/:id', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.deleteProduct(req, res, next)
);
apiRouter.post('/products/bulk-restock', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.bulkRestock(req, res, next)
);
apiRouter.post('/products/adjust-stock', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.adjustStock(req, res, next)
);
apiRouter.get('/products/ledger', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  inventoryController.listLedger(req, res, next)
);

// ============================================================
// 7. POS Transactions & Checkout
// ============================================================
apiRouter.post('/transactions', authenticateToken, (req, res, next) =>
  transactionsController.checkout(req, res, next)
);
apiRouter.get('/transactions', authenticateToken, (req, res, next) =>
  transactionsController.listTransactions(req, res, next)
);
apiRouter.get('/transactions/:id', authenticateToken, (req, res, next) =>
  transactionsController.getTransaction(req, res, next)
);

// ============================================================
// 8. Receipt Generation Engine
// ============================================================
apiRouter.get('/receipts/:id/payload', authenticateToken, (req, res, next) =>
  receiptsController.getPayload(req, res, next)
);
apiRouter.get('/receipts/:id/pdf', authenticateToken, (req, res, next) =>
  receiptsController.downloadPdf(req, res, next)
);

// ============================================================
// 9. Cloud Sync Engine
// ============================================================
apiRouter.get('/sync/status', authenticateToken, (req, res, next) =>
  syncController.getStatus(req, res, next)
);
apiRouter.post('/sync/trigger', authenticateToken, requireRole(UserRole.OWNER, UserRole.MANAGER), (req, res, next) =>
  syncController.triggerSync(req, res, next)
);
