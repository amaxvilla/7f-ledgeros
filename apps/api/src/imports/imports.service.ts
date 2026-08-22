import { Injectable, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as Papa from 'papaparse';
import * as xlsx from 'xlsx';

@Injectable()
export class ImportsService {
  parseFile(file: any, explicitFormat?: 'csv' | 'xlsx'): { rows: Record<string, any>[] } {
    const isCsv = explicitFormat === 'csv' || file.originalname.toLowerCase().endsWith('.csv') || file.mimetype === 'text/csv';
    const isXlsx = explicitFormat === 'xlsx' || file.originalname.toLowerCase().endsWith('.xlsx') || file.mimetype.includes('spreadsheetml') || file.mimetype.includes('excel');

    if (isCsv) {
      const csvString = file.buffer.toString('utf-8');
      const result = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
      });
      return { rows: result.data as Record<string, any>[] };
    } else if (isXlsx) {
      try {
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        if (workbook.SheetNames.length === 0) throw new BadRequestException('Excel file has no sheets');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        return { rows: rows as Record<string, any>[] };
      } catch (e) {
        throw new BadRequestException('Failed to parse XLSX file');
      }
    }

    throw new BadRequestException('Unsupported file format. Must be CSV or XLSX.');
  }

  getTemplate(type: string, format: string, res: Response) {
    let headers: string[] = [];
    let sampleRow: any[] = [];
    
    switch (type.toUpperCase()) {
      case 'JOURNAL':
        headers = ['reference', 'entryDate', 'description', 'accountId', 'debit', 'credit', 'memo', 'projectId', 'departmentId'];
        sampleRow = ['JRN-01', '2026-08-01', 'Sample Journal', 'acc-1', '1000', '0', 'Line memo', '', ''];
        break;
      case 'STATEMENT':
        headers = ['transactionDate', 'description', 'reference', 'amount'];
        sampleRow = ['2026-08-01', 'Bank fee', 'REF-123', '-50'];
        break;
      case 'ITEM':
        headers = ['code', 'name', 'domain', 'unitOfMeasure'];
        sampleRow = ['SKU-100', 'Sample Item', 'GOODS', 'PCS'];
        break;
      case 'PAYMENT':
        headers = ['voucherNumber', 'vendorId', 'paymentDate', 'paymentMethod', 'bankAccountId', 'vendorInvoiceId', 'amountAllocated'];
        sampleRow = ['VCH-01', 'ven-1', '2026-08-01', 'BANK_TRANSFER', 'bank-1', 'inv-1', '500'];
        break;
      default:
        throw new BadRequestException(`Unknown template type: ${type}`);
    }

    const rows = [headers, sampleRow];

    if (format.toLowerCase() === 'csv') {
      const csv = Papa.unparse(rows);
      res.header('Content-Type', 'text/csv');
      res.attachment(`${type.toLowerCase()}-template.csv`);
      return res.send(csv);
    } else if (format.toLowerCase() === 'xlsx') {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(rows);
      xlsx.utils.book_append_sheet(wb, ws, 'Template');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment(`${type.toLowerCase()}-template.xlsx`);
      return res.send(buffer);
    }

    throw new BadRequestException(`Unknown format: ${format}`);
  }
}
