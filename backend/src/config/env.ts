import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend folder or current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[Security Error] Mandatory environment variable "${key}" is missing. Please set it in your .env file.`
    );
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'stocksync_admin',
    password: getRequiredEnv('DB_PASSWORD'),
    name: process.env.DB_NAME || 'stocksync_local',
  },
  jwt: {
    secret: getRequiredEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    refreshSecret: getRequiredEnv('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  pos: {
    counterId: process.env.COUNTER_ID || 'COUNTER-01',
    storeName: process.env.STORE_NAME || 'StockSync Supermarket',
    storeAddress: process.env.STORE_ADDRESS || '123 Retail Avenue, Tech City',
    storeGstin: process.env.STORE_GSTIN || '27AAAAA0000A1Z5',
  },
  sync: {
    enabled: process.env.AZURE_SYNC_ENABLED === 'true',
    endpoint: process.env.AZURE_SYNC_ENDPOINT || 'https://stocksync-cloud-api.azurewebsites.net/api/v1/sync',
    intervalMs: parseInt(process.env.AZURE_SYNC_INTERVAL_MS || '30000', 10),
    apiKey: process.env.AZURE_SYNC_API_KEY || '',
  },
};
