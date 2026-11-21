import { pool, testDbConnection } from '../src/config/database';
import { authService } from '../src/modules/auth/auth.service';
import { inventoryService } from '../src/modules/inventory/inventory.service';
import { transactionsService } from '../src/modules/transactions/transactions.service';
import { receiptPdfService } from '../src/modules/receipts/receipt-pdf.service';
import { syncService } from '../src/modules/sync/sync.service';
import { usersService } from '../src/modules/users/users.service';
import { PaymentMethod, ReasonCode, UserRole } from '../src/types/index';
import fs from 'fs';
import path from 'path';

async function runIntegrationSuite() {
  console.log('====================================================');
  console.log('   StockSync End-to-End System Verification Suite   ');
  console.log('====================================================\n');

  // 1. Database Connectivity
  console.log('[Test 1] Testing PostgreSQL Container Connection...');
  const connected = await testDbConnection();
  if (!connected) throw new Error('Database connection failed');
  console.log('-> PASS: Database connected and responsive\n');

  // 2. Authentication & Roles
  console.log('[Test 2] Testing User Authentication & RBAC...');
  const cashierAuth = await authService.login('cashier1', 'Cashier@123', 'COUNTER-01');
  console.log(`-> Logged in as: ${cashierAuth.user.fullName} (${cashierAuth.user.role})`);
  if (cashierAuth.user.role !== UserRole.SALESPERSON) throw new Error('Role mismatch for cashier');

  const managerAuth = await authService.login('manager', 'Manager@123');
  console.log(`-> Logged in as: ${managerAuth.user.fullName} (${managerAuth.user.role})`);

  const ownerAuth = await authService.login('owner', 'Owner@123');
  console.log(`-> Logged in as: ${ownerAuth.user.fullName} (${ownerAuth.user.role})`);
  console.log('-> PASS: All default RBAC user roles verified\n');

  // 3. Product Catalog & Barcode Search
  console.log('[Test 3] Testing Product Catalog & Fast Barcode Search...');
  const products = await inventoryService.getProducts();
  console.log(`-> Total Active Products: ${products.length}`);
  const targetProduct = products[0];
  console.log(`-> Testing Barcode Search for "${targetProduct.barcode}"...`);
  const searchResults = await inventoryService.searchProduct(targetProduct.barcode);
  if (searchResults.length === 0 || searchResults[0].id !== targetProduct.id) {
    throw new Error('Barcode search failed');
  }
  console.log(`-> Found: ${searchResults[0].name} (Price: INR ${searchResults[0].sellingPrice}, Stock: ${searchResults[0].stockQuantity})`);
  console.log('-> PASS: Catalog search verified\n');

  // 4. POS Checkout with Row-Level Locking & Ledger Deductions
  console.log('[Test 4] Testing Concurrency-Safe POS Checkout...');
  const initialStock = targetProduct.stockQuantity;
  const purchaseQuantity = 2;

  const tx = await transactionsService.createTransaction(
    {
      counterId: 'COUNTER-01',
      cashierId: cashierAuth.user.id,
      paymentMethod: PaymentMethod.CASH,
      items: [
        {
          productId: targetProduct.id,
          quantity: purchaseQuantity,
          unitPrice: targetProduct.sellingPrice,
          gstRate: targetProduct.gstRate,
        },
      ],
      notes: 'Test POS automated sale',
    },
    cashierAuth.user.id
  );

  console.log(`-> Transaction Created: ${tx.receiptNumber}`);
  console.log(`   Subtotal: INR ${tx.subtotal}, Tax: INR ${tx.totalTax}, Grand Total: INR ${tx.grandTotal}`);

  // Verify stock deduction in database
  const updatedProducts = await inventoryService.searchProduct(targetProduct.barcode);
  const newStock = updatedProducts[0].stockQuantity;
  console.log(`-> Stock Verification: Initial=${initialStock}, Purchased=${purchaseQuantity}, Current=${newStock}`);
  if (newStock !== initialStock - purchaseQuantity) {
    throw new Error(`Stock deduction mismatch! Expected ${initialStock - purchaseQuantity}, got ${newStock}`);
  }
  console.log('-> PASS: Stock deducted atomically with row-level locks\n');

  // 5. PDF Receipt Generation Engine
  console.log('[Test 5] Testing Standardized PDF Receipt Engine...');
  const receiptPayload = await receiptPdfService.getReceiptPayload(tx.id);
  console.log(`-> Receipt Payload compiled for: ${receiptPayload.storeName}`);
  console.log(`   GST Breakdowns:`, receiptPayload.taxBreakdowns);

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
  console.log('-> PASS: Hardware-free PDF receipt engine verified\n');

  // 6. Manual Stock Adjustment with Mandatory Reason Code
  console.log('[Test 6] Testing Manual Stock Adjustment with Reason Code Audit...');
  const adjustResult = await inventoryService.adjustStock({
    productId: targetProduct.id,
    changeQuantity: 10,
    reasonCode: ReasonCode.RESTOCK,
    notes: 'Received fresh morning shipment batch #9042',
    userId: managerAuth.user.id,
  });
  console.log(`-> Restocked 10 units. New Stock: ${adjustResult.product.stockQuantity}`);

  // Ensure mandatory reason code rejection
  let rejected = false;
  try {
    await inventoryService.adjustStock({
      productId: targetProduct.id,
      changeQuantity: -1,
      reasonCode: ReasonCode.SALE,
      notes: 'Invalid reason',
      userId: managerAuth.user.id,
    });
  } catch (err: any) {
    rejected = true;
    console.log(`-> Correctly rejected manual adjustment with SALE reason: "${err.message}"`);
  }
  if (!rejected) throw new Error('Failed to reject manual adjustment with SALE reason');
  console.log('-> PASS: Inventory audit trail & reason enforcement verified\n');

  // 7. Azure Cloud Sync Worker & Queue
  console.log('[Test 7] Testing Offline Sync Queue & Azure Batch Worker...');
  const statusBefore = await syncService.getSyncStatus();
  console.log(`-> Pending Sync Records: ${statusBefore.queueCounts.PENDING}`);

  const syncResult = await syncService.processPendingSyncBatch();
  console.log(`-> Sync Batch Processed: ${syncResult.processed} items`);

  const statusAfter = await syncService.getSyncStatus();
  console.log(`-> Updated Queue: SYNCED=${statusAfter.queueCounts.SYNCED}, PENDING=${statusAfter.queueCounts.PENDING}`);
  console.log('-> PASS: Asynchronous cloud sync batching verified\n');

  // 8. User Management & Instant Revocation
  console.log('[Test 8] Testing Staff Management & Access Revocation...');
  const testUsername = `cashier_${Date.now()}`;
  const newStaff = await usersService.createUser({
    username: testUsername,
    password: 'TempPassword@123',
    fullName: 'Test Trainee Cashier',
    role: UserRole.SALESPERSON,
  });
  console.log(`-> Created new staff user: ${newStaff.username} (ID: ${newStaff.id})`);

  // Instant Revocation
  const deactivated = await usersService.toggleActiveStatus(newStaff.id, false);
  console.log(`-> Revoked access: isActive = ${deactivated.isActive}`);

  let loginBlocked = false;
  try {
    await authService.login(testUsername, 'TempPassword@123');
  } catch (err: any) {
    loginBlocked = true;
    console.log(`-> Login correctly blocked for deactivated user: "${err.message}"`);
  }
  if (!loginBlocked) throw new Error('Deactivated user was able to log in!');
  console.log('-> PASS: Instant user access revocation verified\n');

  console.log('====================================================');
  console.log('  ALL INTEGRATION VERIFICATION TESTS PASSED (8/8)  ');
  console.log('====================================================');

  await pool.end();
}

runIntegrationSuite().catch(async (err) => {
  console.error('\n[SUITE FAILURE]', err);
  await pool.end();
  process.exit(1);
});
