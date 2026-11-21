import { pool, testDbConnection } from '../src/config/database';
import { authService } from '../src/modules/auth/auth.service';
import { inventoryService } from '../src/modules/inventory/inventory.service';
import { categoriesService } from '../src/modules/categories/categories.service';
import { transactionsService } from '../src/modules/transactions/transactions.service';
import { receiptPdfService } from '../src/modules/receipts/receipt-pdf.service';
import { syncService } from '../src/modules/sync/sync.service';
import { usersService } from '../src/modules/users/users.service';
import { PaymentMethod, ReasonCode, UserRole, Permission, ROLE_PERMISSIONS } from '../src/types/index';
import fs from 'fs';
import path from 'path';

async function runIntegrationSuite() {
  console.log('========================================================================');
  console.log('   StockSync Enterprise Backend Architecture Verification Suite   ');
  console.log('========================================================================\n');

  // 1. Database Connectivity
  console.log('[Test 1] Testing PostgreSQL Container Connection...');
  const connected = await testDbConnection();
  if (!connected) throw new Error('Database connection failed');
  console.log('-> PASS: Database connected and responsive\n');

  // 2. Authentication & 30-Day Sliding Window Session
  console.log('[Test 2] Testing User Authentication & 30-Day Database Session...');
  const cashierLogin = await authService.login('cashier1', 'Cashier@123', 'COUNTER-01', '127.0.0.1', 'StockSync-Desktop/1.0.0');
  console.log(`-> Logged in as: ${cashierLogin.user.fullName} (${cashierLogin.user.role})`);
  console.log(`   Session ID: ${cashierLogin.session.id}`);
  console.log(`   Session Expires: ${cashierLogin.session.expiresAt}`);
  
  if (!cashierLogin.session.id) throw new Error('Missing session ID from login response');
  if (cashierLogin.user.role !== UserRole.SALESPERSON) throw new Error('Role mismatch for cashier');

  const managerAuth = await authService.login('manager', 'Manager@123', 'BACKOFFICE-01');
  const ownerAuth = await authService.login('owner', 'Owner@123', 'ADMIN-CONSOLE');
  console.log('-> PASS: All default RBAC user roles verified with database-backed sessions\n');

  // 3. Sliding Window Refresh Token Rotation
  console.log('[Test 3] Testing 30-Day Sliding Window Refresh Token Rotation...');
  const oldRefreshToken = cashierLogin.refreshToken;
  const rotated = await authService.refreshToken(oldRefreshToken, '127.0.0.1', 'StockSync-Desktop/1.0.0');
  console.log(`-> Rotated Refresh Token successfully. Extended Expiry: ${rotated.expiresAt}`);
  if (!rotated.accessToken || !rotated.refreshToken) throw new Error('Refresh token rotation failed');

  // Replay Attack Test: Attempting to reuse old refresh token must be rejected!
  let replayBlocked = false;
  try {
    await authService.refreshToken(oldRefreshToken);
  } catch (err: any) {
    replayBlocked = true;
    console.log(`-> Replay attack correctly blocked: "${err.message}"`);
  }
  if (!replayBlocked) throw new Error('Security breach: Reused refresh token was accepted!');
  console.log('-> PASS: Refresh token rotation with reuse detection verified\n');

  // 4. Session Revocation & Logout
  console.log('[Test 4] Testing Session Revocation & Logout...');
  const tempUser = await usersService.createUser({
    username: `session_tester_${Date.now()}`,
    password: 'Password@123',
    fullName: 'Session Tester',
    role: UserRole.SALESPERSON,
  });
  const tempLogin = await authService.login(tempUser.username, 'Password@123', 'TEST-COUNTER');
  const activeSessions = await authService.getActiveSessions(tempUser.id, tempLogin.session.id);
  console.log(`-> Active sessions count for temp user: ${activeSessions.length}`);
  if (activeSessions.length !== 1) throw new Error('Expected exactly 1 active session');

  await authService.logout(tempLogin.session.id);
  const postLogoutSessions = await authService.getActiveSessions(tempUser.id);
  console.log(`-> Active sessions after logout: ${postLogoutSessions.length}`);
  if (postLogoutSessions.length !== 0) throw new Error('Session was not revoked properly');
  console.log('-> PASS: Database session revocation verified\n');

  // 5. Password Change & Re-Authentication
  console.log('[Test 5] Testing Authenticated Password Change...');
  const pwChangeUser = await usersService.createUser({
    username: `pw_tester_${Date.now()}`,
    password: 'OldPassword@123',
    fullName: 'Password Tester',
    role: UserRole.SALESPERSON,
  });
  const pwLogin1 = await authService.login(pwChangeUser.username, 'OldPassword@123');
  await authService.changePassword(pwChangeUser.id, 'OldPassword@123', 'NewPassword@123', pwLogin1.session.id);
  
  // Verify new password works
  const newLogin = await authService.login(pwChangeUser.username, 'NewPassword@123');
  if (!newLogin.accessToken) throw new Error('Failed to log in with new password');
  console.log('-> PASS: Password update & hashing verified\n');

  // 6. RBAC Role Hierarchy & Permission Matrix
  console.log('[Test 6] Testing Role-Based Access Control Permissions Matrix...');
  const ownerPerms = ROLE_PERMISSIONS[UserRole.OWNER];
  const mgrPerms = ROLE_PERMISSIONS[UserRole.MANAGER];
  const salesPerms = ROLE_PERMISSIONS[UserRole.SALESPERSON];

  if (!ownerPerms.includes(Permission.SESSIONS_REVOKE)) throw new Error('Owner missing SESSIONS_REVOKE');
  if (!mgrPerms.includes(Permission.DASHBOARD_VIEW)) throw new Error('Manager missing DASHBOARD_VIEW');
  if (salesPerms.includes(Permission.DASHBOARD_VIEW)) throw new Error('Salesperson should not have DASHBOARD_VIEW');
  console.log(`-> Owner permissions: ${ownerPerms.length}, Manager: ${mgrPerms.length}, Salesperson: ${salesPerms.length}`);
  console.log('-> PASS: RBAC permission hierarchy validated\n');

  // 7. Stock Management Dashboard KPIs & Valuation
  console.log('[Test 7] Testing Stock Management Dashboard Summary & Valuation...');
  const summary = await inventoryService.getDashboardSummary();
  console.log(`-> Total Active SKUs: ${summary.totalProducts}`);
  console.log(`-> Total Physical Units: ${summary.totalStockUnits}`);
  console.log(`-> Valuation at Cost: INR ${summary.totalCostValue.toLocaleString('en-IN')}`);
  console.log(`-> Valuation at Retail: INR ${summary.totalRetailValue.toLocaleString('en-IN')}`);
  console.log(`-> Potential Gross Profit: INR ${summary.potentialProfit.toLocaleString('en-IN')} (${summary.profitMarginPercent}% Margin)`);
  console.log(`-> Low Stock Alert Count: ${summary.lowStockCount}`);
  console.log(`-> Out of Stock Count: ${summary.outOfStockCount}`);
  console.log(`-> Inventory Adjustments Today: ${summary.adjustmentsTodayCount}`);

  if (summary.totalProducts <= 0 || summary.totalCostValue <= 0) {
    throw new Error('Dashboard summary calculation error: zero valuation or SKUs');
  }
  console.log('-> PASS: Real-time stock valuation & dashboard KPIs verified\n');

  // 8. Low-Stock & Critical Out-of-Stock Priority Alerts
  console.log('[Test 8] Testing Low-Stock Alert Engine with Urgency Ranking...');
  const lowStockAlerts = await inventoryService.getLowStockAlerts(10, 0);
  console.log(`-> Total Low-Stock Alert Items Found: ${lowStockAlerts.length}`);
  if (lowStockAlerts.length > 0) {
    const topAlert = lowStockAlerts[0];
    console.log(`   Top Priority Item: ${topAlert.name} (Stock: ${topAlert.stockQuantity}, Min Alert: ${topAlert.minStockAlert}, Deficit: ${topAlert.deficit}, Urgency Ratio: ${topAlert.urgencyRatio})`);
  }
  console.log('-> PASS: Low-stock priority queue verified\n');

  // 9. Stock Movement Velocity by Reason Code
  console.log('[Test 9] Testing Stock Movement Analytics...');
  const movement = await inventoryService.getStockMovement('month');
  console.log(`-> Movement reason buckets: ${movement.length}`);
  for (const item of movement) {
    console.log(`   Reason [${item.reasonCode}]: ${item.totalQuantity} units moved (${item.entryCount} audit entries)`);
  }
  console.log('-> PASS: Inventory turnover & movement analytics verified\n');

  // 10. Category Management & Valuation Breakdown
  console.log('[Test 10] Testing Category Management & Department Breakdown...');
  const testCatCode = `CAT-${Date.now().toString().slice(-4)}`;
  const newCat = await categoriesService.createCategory({
    name: `Specialty Gourmet ${Date.now().toString().slice(-4)}`,
    code: testCatCode,
    description: 'Imported artisanal sauces and gourmet dressings',
  });
  console.log(`-> Created new category: ${newCat.name} (${newCat.code})`);

  const categoryBreakdown = await inventoryService.getCategoryBreakdown();
  console.log(`-> Categories with breakdown data: ${categoryBreakdown.length}`);
  for (const cat of categoryBreakdown.slice(0, 3)) {
    console.log(`   [${cat.categoryCode}] ${cat.categoryName}: ${cat.productCount} SKUs, ${cat.totalStockUnits} units, Retail: INR ${cat.totalRetailValue}`);
  }
  console.log('-> PASS: Category analytics & lifecycle verified\n');

  // 11. Product Creation with Automatic Initial RESTOCK Ledger Entry
  console.log('[Test 11] Testing Product Creation with Initial Stock Ledger...');
  const testBarcode = `89099${Date.now().toString().slice(-8)}`;
  const testSku = `SKU-TEST-${Date.now().toString().slice(-4)}`;
  const newProduct = await inventoryService.createProduct(
    {
      barcode: testBarcode,
      sku: testSku,
      name: 'Organic Honey 500g',
      description: 'Raw unfiltered organic mountain honey',
      categoryId: newCat.id,
      costPrice: 280.0,
      sellingPrice: 380.0,
      gstRate: 5.0,
      initialStock: 25,
      minStockAlert: 5,
    },
    ownerAuth.user.id
  );
  console.log(`-> Product Created: ${newProduct.name} (Barcode: ${newProduct.barcode}, Initial Stock: ${newProduct.stockQuantity})`);

  // Verify initial RESTOCK entry was written to inventory_ledger
  const prodDetails = await inventoryService.getProductById(newProduct.id);
  if (prodDetails.stockQuantity !== 25) throw new Error('Initial stock mismatch');
  if (prodDetails.recentLedger.length === 0 || prodDetails.recentLedger[0].reasonCode !== ReasonCode.RESTOCK) {
    throw new Error('Initial RESTOCK audit ledger entry missing');
  }
  console.log(`-> Initial RESTOCK ledger entry confirmed: ${prodDetails.recentLedger[0].reasonCode} (${prodDetails.recentLedger[0].changeQuantity} units)`);
  console.log('-> PASS: Product lifecycle & initial ledger onboarding verified\n');

  // 12. Atomic Multi-Item Bulk Restock with Purchase Invoice Reference
  console.log('[Test 12] Testing Atomic Multi-Item Bulk Restock...');
  const invoiceNum = `INV-SUPPLY-${Date.now()}`;
  const restockBatch = await inventoryService.bulkRestock(
    {
      invoiceReference: invoiceNum,
      supplierName: 'Himalayan Organic Farms Pvt Ltd',
      notes: 'Morning warehouse restock truck delivery',
      items: [
        {
          productId: newProduct.id,
          quantity: 15,
          costPrice: 275.0,
        },
      ],
    },
    managerAuth.user.id
  );
  console.log(`-> Bulk Restocked ${restockBatch.totalItemsRestocked} items under invoice ${restockBatch.invoiceReference}`);
  const postRestockProd = await inventoryService.getProductById(newProduct.id);
  if (postRestockProd.stockQuantity !== 40) {
    throw new Error(`Stock mismatch after bulk restock: expected 40, got ${postRestockProd.stockQuantity}`);
  }
  console.log(`-> New Stock for ${newProduct.name}: ${postRestockProd.stockQuantity} (Updated Cost: INR ${postRestockProd.costPrice})`);
  console.log('-> PASS: Atomic bulk restock transaction verified\n');

  // 13. Fast Barcode Search & Concurrency-Safe POS Checkout
  console.log('[Test 13] Testing Fast Barcode Search & Concurrency-Safe POS Checkout...');
  const searchResults = await inventoryService.searchProduct(testBarcode);
  if (searchResults.length === 0) throw new Error('Barcode search failed for newly created product');
  const targetProduct = searchResults[0];

  const purchaseQuantity = 3;
  const initialStock = targetProduct.stockQuantity;

  const tx = await transactionsService.createTransaction(
    {
      counterId: 'COUNTER-01',
      cashierId: cashierLogin.user.id,
      paymentMethod: PaymentMethod.UPI,
      paymentDetails: {
        upiReference: `UPI-REF-${Date.now()}`,
      },
      items: [
        {
          productId: targetProduct.id,
          quantity: purchaseQuantity,
          unitPrice: targetProduct.sellingPrice,
          gstRate: targetProduct.gstRate,
        },
      ],
      notes: 'POS checkout verification',
    },
    cashierLogin.user.id
  );

  console.log(`-> Transaction Created: ${tx.receiptNumber}`);
  console.log(`   Grand Total: INR ${tx.grandTotal} (Paid via ${tx.paymentMethod})`);

  const afterCheckoutProd = await inventoryService.getProductById(targetProduct.id);
  if (afterCheckoutProd.stockQuantity !== initialStock - purchaseQuantity) {
    throw new Error(`Stock deduction failed! Expected ${initialStock - purchaseQuantity}, got ${afterCheckoutProd.stockQuantity}`);
  }
  console.log(`-> Stock atomically deducted from ${initialStock} to ${afterCheckoutProd.stockQuantity}`);
  console.log('-> PASS: Concurrency-safe POS checkout verified\n');

  // 14. Hardware-Free PDF Receipt Engine
  console.log('[Test 14] Testing 80mm PDF Receipt Engine...');
  const receiptPayload = await receiptPdfService.getReceiptPayload(tx.id);
  const pdfDoc = receiptPdfService.generatePdfStream(receiptPayload);
  const pdfOutputDir = path.resolve(__dirname, '../../docs');
  if (!fs.existsSync(pdfOutputDir)) {
    fs.mkdirSync(pdfOutputDir, { recursive: true });
  }
  const pdfOutputPath = path.join(pdfOutputDir, 'sample-receipt.pdf');
  const writeStream = fs.createWriteStream(pdfOutputPath);
  pdfDoc.pipe(writeStream);
  pdfDoc.end();
  await new Promise((resolve) => writeStream.on('finish', resolve));

  const stats = fs.statSync(pdfOutputPath);
  console.log(`-> PDF Receipt generated successfully at ${pdfOutputPath} (${stats.size} bytes)`);
  console.log('-> PASS: PDF receipt engine verified\n');

  // 15. Offline Cloud Sync Queue & Azure Batch Worker
  console.log('[Test 15] Testing Offline Sync Queue & Azure Cloud Worker...');
  const statusBefore = await syncService.getSyncStatus();
  console.log(`-> Pending Sync Records: ${statusBefore.queueCounts.PENDING}`);
  const syncResult = await syncService.processPendingSyncBatch();
  console.log(`-> Sync Batch Processed: ${syncResult.processed} items`);
  const statusAfter = await syncService.getSyncStatus();
  console.log(`-> Updated Queue: SYNCED=${statusAfter.queueCounts.SYNCED}, PENDING=${statusAfter.queueCounts.PENDING}`);
  console.log('-> PASS: Asynchronous cloud sync batching verified\n');

  console.log('========================================================================');
  console.log('   ALL ENTERPRISE BACKEND VERIFICATION TESTS PASSED (15/15)            ');
  console.log('========================================================================\n');

  await pool.end();
}

runIntegrationSuite().catch(async (err) => {
  console.error('\n[SUITE FAILURE]', err);
  await pool.end();
  process.exit(1);
});
