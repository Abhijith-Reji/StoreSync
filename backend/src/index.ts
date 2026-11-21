import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { apiRouter } from './routes/api.router';
import { errorHandler } from './middleware/error.middleware';
import { syncService } from './modules/sync/sync.service';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api', apiRouter);

// Centralized Error Handling
app.use(errorHandler);

// Boot Server
async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('  StockSync Local POS & Supermarket Backend Engine  ');
  console.log('----------------------------------------------------');

  const dbConnected = await testDbConnection();
  if (!dbConnected) {
    console.error('[Startup Warning] Database not reachable. Retrying in background...');
  }

  app.listen(config.port, () => {
    console.log(`[StockSync Server] Listening on http://localhost:${config.port}`);
    console.log(`[POS Counter] Assigned: ${config.pos.counterId}`);
    console.log(`[Store] ${config.pos.storeName} (${config.pos.storeGstin})`);
  });

  // Scheduled background sync worker (every configured interval)
  if (config.sync.enabled) {
    console.log(`[Background Sync] Azure Sync worker active (every ${config.sync.intervalMs / 1000}s)`);
    setInterval(async () => {
      try {
        await syncService.processPendingSyncBatch();
      } catch (err) {
        // Logged inside syncService
      }
    }, config.sync.intervalMs);
  }
}

bootstrap().catch((err) => {
  console.error('[Fatal Error] Failed to boot StockSync backend:', err);
  process.exit(1);
});
