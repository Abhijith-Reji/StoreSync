import { Request, Response, NextFunction } from 'express';
import { receiptPdfService } from './receipt-pdf.service';

export class ReceiptsController {
  async getPayload(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = await receiptPdfService.getReceiptPayload(req.params.id);
      res.json(payload);
    } catch (err) {
      next(err);
    }
  }

  async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = await receiptPdfService.getReceiptPayload(req.params.id);
      const doc = receiptPdfService.generatePdfStream(payload);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${payload.receiptNumber}.pdf"`);

      doc.pipe(res);
      doc.end();
    } catch (err) {
      next(err);
    }
  }
}

export const receiptsController = new ReceiptsController();
