# Receipt Generation Engine

### 1. Motivation & Approach

Traditional POS setups depend heavily on physical ESC/POS thermal printers connected via USB, COM serial, or Ethernet ports. When these printers run out of paper, encounter driver issues, or are simply not yet purchased during initial store launch, retail checkouts halt.

StockSync eliminates this hardware bottleneck by introducing an **embedded PDF Receipt Engine**.

---

### 2. Standardized Receipt Payload Schema

Every completed transaction compiles into a standardized, deterministic receipt schema:

```json
{
  "receiptId": "b8f6c4d0-...",
  "receiptNumber": "REC-M3L98-7412",
  "storeName": "StockSync Supermarket",
  "storeAddress": "123 Retail Avenue, Tech City",
  "storeGstin": "27AAAAA0000A1Z5",
  "counterId": "COUNTER-01",
  "cashierName": "Cashier One",
  "transactionTime": "2026-11-21T18:00:00.000Z",
  "items": [
    {
      "name": "Multigrain Brown Bread 400g",
      "barcode": "8901030002012",
      "quantity": 2,
      "unitPrice": 50.00,
      "gstRate": 0.00,
      "totalPrice": 100.00
    },
    {
      "name": "Classic Instant Coffee 100g",
      "barcode": "8901030003012",
      "quantity": 1,
      "unitPrice": 240.00,
      "gstRate": 18.00,
      "totalPrice": 240.00
    }
  ],
  "subtotal": 303.39,
  "taxBreakdowns": [
    {
      "gstRate": 0.00,
      "taxableAmount": 100.00,
      "cgstAmount": 0.00,
      "sgstAmount": 0.00,
      "totalTax": 0.00
    },
    {
      "gstRate": 18.00,
      "taxableAmount": 203.39,
      "cgstAmount": 18.31,
      "sgstAmount": 18.31,
      "totalTax": 36.61
    }
  ],
  "totalDiscount": 0.00,
  "grandTotal": 340.00,
  "paymentMethod": "CASH"
}
```

---

### 3. PDF Specifications

* **Dimensions**: Width 226.77 pt (standard 80mm roll width), auto-flowing height.
* **Typography**: Crisp, monospace-aligned tabular data for item names, quantities, unit prices, and line totals.
* **GST Breakdown**: Dedicated statutory compliance section displaying CGST (Central GST) and SGST (State GST) per tax slab (0%, 5%, 12%, 18%).
* **Output Modes**:
  1. Instant download via `/api/receipts/:id/pdf`
  2. In-browser preview / print dialog modal on the POS terminal
  3. Digital receipt sharing (SMS / WhatsApp / Email delivery pipeline in future phases)
