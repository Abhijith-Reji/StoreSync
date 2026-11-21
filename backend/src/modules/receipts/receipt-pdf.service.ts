import PDFDocument from 'pdfkit';
import { transactionsService } from '../transactions/transactions.service';
import { config } from '../../config/env';
import { ReceiptPayload, TaxBreakdownItem } from '../../types';

export class ReceiptPdfService {
  async getReceiptPayload(transactionId: string): Promise<ReceiptPayload> {
    const tx = await transactionsService.getTransactionById(transactionId);

    // Group items by GST rate for slab breakdown
    const taxMap = new Map<number, { taxable: number; tax: number }>();

    for (const item of tx.items) {
      const rate = item.gstRate;
      const existing = taxMap.get(rate) || { taxable: 0, tax: 0 };
      const itemTax = item.gstAmount;
      const itemTaxable = item.totalPrice - itemTax;
      taxMap.set(rate, {
        taxable: existing.taxable + itemTaxable,
        tax: existing.tax + itemTax,
      });
    }

    const taxBreakdowns: TaxBreakdownItem[] = Array.from(taxMap.entries()).map(([rate, data]) => ({
      gstRate: rate,
      taxableAmount: Math.round(data.taxable * 100) / 100,
      cgstAmount: Math.round((data.tax / 2) * 100) / 100,
      sgstAmount: Math.round((data.tax / 2) * 100) / 100,
      totalTax: Math.round(data.tax * 100) / 100,
    }));

    return {
      receiptId: tx.id,
      receiptNumber: tx.receiptNumber,
      storeName: config.pos.storeName,
      storeAddress: config.pos.storeAddress,
      storeGstin: config.pos.storeGstin,
      counterId: tx.counterId,
      cashierName: tx.cashierName || 'Cashier',
      transactionTime: tx.createdAt,
      items: tx.items.map((it: any) => ({
        name: it.productName,
        barcode: it.barcode,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        gstRate: it.gstRate,
        totalPrice: it.totalPrice,
      })),
      subtotal: tx.subtotal,
      taxBreakdowns,
      totalDiscount: tx.totalDiscount,
      grandTotal: tx.grandTotal,
      paymentMethod: tx.paymentMethod,
    };
  }

  generatePdfStream(payload: ReceiptPayload): PDFKit.PDFDocument {
    // 80mm thermal receipt standard: 226.77 points width, flexible height
    const doc = new PDFDocument({
      size: [226.77, 600],
      margins: { top: 15, bottom: 15, left: 10, right: 10 },
    });

    // Store Header
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(payload.storeName, { align: 'center' })
      .fontSize(8)
      .font('Helvetica')
      .text(payload.storeAddress, { align: 'center' })
      .text(`GSTIN: ${payload.storeGstin}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.text('------------------------------------------------', { align: 'center' });

    // Transaction Metadata
    doc
      .fontSize(8)
      .text(`Receipt #: ${payload.receiptNumber}`)
      .text(`Date/Time: ${new Date(payload.transactionTime).toLocaleString()}`)
      .text(`Counter: ${payload.counterId}  |  Cashier: ${payload.cashierName}`);

    doc.moveDown(0.3);
    doc.text('------------------------------------------------', { align: 'center' });

    // Table Header
    doc.font('Helvetica-Bold');
    doc.text('Item                   Qty   Price   Total', { align: 'left' });
    doc.font('Helvetica');

    // Line Items
    payload.items.forEach((item) => {
      const shortName = item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name.padEnd(18);
      const qty = item.quantity.toString().padStart(3);
      const price = item.unitPrice.toFixed(2).padStart(6);
      const total = item.totalPrice.toFixed(2).padStart(7);
      doc.text(`${shortName} ${qty} ${price} ${total}`);
    });

    doc.moveDown(0.3);
    doc.text('------------------------------------------------', { align: 'center' });

    // Summary Totals
    doc.font('Helvetica');
    doc.text(`Subtotal (Taxable):      INR ${payload.subtotal.toFixed(2)}`, { align: 'right' });
    if (payload.totalDiscount > 0) {
      doc.text(`Total Discount:         -INR ${payload.totalDiscount.toFixed(2)}`, { align: 'right' });
    }
    doc.font('Helvetica-Bold');
    doc.fontSize(10).text(`GRAND TOTAL:             INR ${payload.grandTotal.toFixed(2)}`, { align: 'right' });
    doc.fontSize(8);
    doc.font('Helvetica');
    doc.text(`Payment: ${payload.paymentMethod}`, { align: 'right' });

    doc.moveDown(0.5);
    doc.text('--- GST Slabs Breakdown ---', { align: 'center' });
    doc.text('Rate     Taxable       CGST       SGST', { align: 'center' });
    payload.taxBreakdowns.forEach((t) => {
      doc.text(
        `${t.gstRate}%`.padEnd(6) +
          `INR ${t.taxableAmount.toFixed(2)}`.padEnd(14) +
          `INR ${t.cgstAmount.toFixed(2)}`.padEnd(12) +
          `INR ${t.sgstAmount.toFixed(2)}`,
        { align: 'center' }
      );
    });

    doc.moveDown(0.8);
    doc.text('Thank you for shopping with us!', { align: 'center' });
    doc.text('Please retain this receipt for returns/exchange.', { align: 'center' });

    return doc;
  }
}

export const receiptPdfService = new ReceiptPdfService();
