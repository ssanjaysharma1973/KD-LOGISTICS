/**
 * E-Way Bill Excel Export Service
 * 
 * Exports e-way bills to Excel format with formatting and multiple sheets
 * - Main data sheet with all bill details
 * - Summary statistics sheet
 * - Warnings/alerts sheet (expired, expiring soon)
 * - PDF import ready for GST portal submission
 */

import fs from 'fs';
import path from 'path';

// Try to load Excel library - graceful fallback if not available
let ExcelJS;
try {
  const _require = require.createRequire ? require.createRequire(import.meta.url) : null;
  if (_require) {
    ExcelJS = _require('exceljs');
  }
} catch (e) {
  console.warn('[ExcelExport] ExcelJS not available, using fallback JSON->CSV format');
}

/**
 * Export e-way bills to Excel workbook
 * Returns Buffer (binary file data)
 */
export async function exportEwayBillsToExcel(bills, clientId, exportDate = new Date()) {
  // Fallback if ExcelJS not available
  if (!ExcelJS) {
    return exportEwayBillsToCSV(bills, clientId);
  }

  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Main Bills Data
  const billsSheet = workbook.addWorksheet('E-Way Bills');
  addBillsSheet(billsSheet, bills, clientId);
  
  // Sheet 2: Summary Statistics
  const summarySheet = workbook.addWorksheet('Summary');
  addSummarySheet(summarySheet, bills, clientId, exportDate);
  
  // Sheet 3: Warnings & Alerts
  if (bills.length > 0) {
    const warningsSheet = workbook.addWorksheet('Warnings');
    addWarningsSheet(warningsSheet, bills);
  }
  
  // Generate buffer
  return await workbook.xlsx.writeBuffer();
}

/**
 * Main bills data sheet
 */
function addBillsSheet(sheet, bills, clientId) {
  // Header row with formatting
  const headers = [
    'EWB No',
    'Doc No',
    'Vehicle No',
    'From Place',
    'To Place',
    'From POI',
    'To POI',
    'Value (₹)',
    'Status',
    'Munshi',
    'Movement Type',
    'Valid Upto',
    'Days Left',
    'Imported Date',
    'Notes',
  ];

  const headerRow = sheet.addRow(headers);
  
  // Format header row
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };

  // Add data rows
  bills.forEach((bill, idx) => {
    const daysLeft = calculateDaysLeft(bill.valid_upto);
    const row = sheet.addRow([
      bill.ewb_no || bill.ewb_number || '',
      bill.doc_no || '',
      bill.vehicle_no || '',
      bill.from_place || '',
      bill.to_place || '',
      bill.from_poi_name || '',
      bill.to_poi_name || '',
      Number(bill.total_value || 0).toFixed(2),
      bill.status || 'active',
      bill.munshi_name || '',
      bill.movement_type || '',
      bill.valid_upto || '',
      daysLeft,
      bill.imported_at || '',
      bill.notes || '',
    ]);

    // Color code rows by status
    if (bill.status === 'expired' || daysLeft < 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } }; // Red
    } else if (daysLeft <= 3) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD93D' } }; // Yellow
    } else if (bill.status === 'delivered') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6BCB77' } }; // Green
    }
  });

  // Adjust column widths
  sheet.columns = [
    { width: 15 }, // EWB No
    { width: 12 }, // Doc No
    { width: 12 }, // Vehicle No
    { width: 15 }, // From Place
    { width: 15 }, // To Place
    { width: 15 }, // From POI
    { width: 15 }, // To POI
    { width: 12 }, // Value
    { width: 12 }, // Status
    { width: 15 }, // Munshi
    { width: 15 }, // Movement Type
    { width: 12 }, // Valid Upto
    { width: 10 }, // Days Left
    { width: 15 }, // Imported Date
    { width: 20 }, // Notes
  ];

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Summary statistics sheet
 */
function addSummarySheet(sheet, bills, clientId, exportDate) {
  sheet.addRow(['E-Way Bill Export Summary']);
  sheet.getCell('A1').font = { bold: true, size: 14 };
  
  sheet.addRow(['']);
  sheet.addRow(['Export Date', new Date(exportDate).toISOString()]);
  sheet.addRow(['Client ID', clientId || 'ALL']);
  sheet.addRow(['Total Bills', bills.length]);
  
  sheet.addRow(['']);
  sheet.addRow(['Status Breakdown']);
  
  // Calculate status breakdown
  const statusCounts = {};
  bills.forEach(bill => {
    const status = bill.status || 'active';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  let row = 7;
  for (const [status, count] of Object.entries(statusCounts)) {
    sheet.addRow([status, count]);
    row++;
  }

  sheet.addRow(['']);
  row++;
  
  // Value statistics
  sheet.addRow(['Value Summary']);
  const totalValue = bills.reduce((sum, b) => sum + Number(b.total_value || 0), 0);
  const avgValue = bills.length > 0 ? totalValue / bills.length : 0;
  
  sheet.addRow(['Total Value', `₹ ${totalValue.toFixed(2)}`]);
  sheet.addRow(['Average Value', `₹ ${avgValue.toFixed(2)}`]);
  
  // Expiry analysis
  sheet.addRow(['']);
  sheet.addRow(['Expiry Analysis']);
  
  let expiredCount = 0;
  let expiringSoonCount = 0;
  
  bills.forEach(bill => {
    const daysLeft = calculateDaysLeft(bill.valid_upto);
    if (daysLeft < 0) expiredCount++;
    else if (daysLeft <= 3) expiringSoonCount++;
  });
  
  sheet.addRow(['Expired', expiredCount]);
  sheet.addRow(['Expiring within 3 days', expiringSoonCount]);
  sheet.addRow(['Active & Valid', bills.length - expiredCount - expiringSoonCount]);

  // Format columns
  sheet.columns = [
    { width: 25 },
    { width: 20 },
  ];
}

/**
 * Warnings and alerts sheet
 */
function addWarningsSheet(sheet, bills) {
  const headers = ['Type', 'EWB No', 'Vehicle No', 'From-To', 'Days Left', 'Action Required'];
  const headerRow = sheet.addRow(headers);
  
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };

  bills.forEach(bill => {
    const daysLeft = calculateDaysLeft(bill.valid_upto);
    
    if (bill.status === 'expired' || daysLeft < 0) {
      const row = sheet.addRow([
        'EXPIRED',
        bill.ewb_no || '',
        bill.vehicle_no || '',
        `${bill.from_place || bill.from_poi_name} → ${bill.to_place || bill.to_poi_name}`,
        daysLeft,
        'Renew immediately',
      ]);
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
    } else if (daysLeft <= 3 && daysLeft > 0) {
      const row = sheet.addRow([
        'EXPIRING SOON',
        bill.ewb_no || '',
        bill.vehicle_no || '',
        `${bill.from_place || bill.from_poi_name} → ${bill.to_place || bill.to_poi_name}`,
        daysLeft,
        'Extend validity',
      ]);
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD93D' } };
    } else if (bill.status === 'active' && !bill.vehicle_no) {
      const row = sheet.addRow([
        'UNASSIGNED VEHICLE',
        bill.ewb_no || '',
        '(Not assigned)',
        `${bill.from_place} → ${bill.to_place}`,
        daysLeft,
        'Assign vehicle (Part B)',
      ]);
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE66D' } };
    }
  });

  sheet.columns = [
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 30 },
    { width: 12 },
    { width: 20 },
  ];
}

/**
 * Fallback: Export as CSV if ExcelJS not available
 */
function exportEwayBillsToCSV(bills, clientId) {
  const headers = [
    'EWB No',
    'Doc No',
    'Vehicle No',
    'From Place',
    'To Place',
    'Value',
    'Status',
    'Munshi',
    'Valid Upto',
    'Notes',
  ];

  const rows = [
    headers.join(','),
    ...bills.map(bill => [
      `"${bill.ewb_no || bill.ewb_number || ''}"`,
      `"${bill.doc_no || ''}"`,
      `"${bill.vehicle_no || ''}"`,
      `"${bill.from_place || ''}"`,
      `"${bill.to_place || ''}"`,
      Number(bill.total_value || 0).toFixed(2),
      `"${bill.status || 'active'}"`,
      `"${bill.munshi_name || ''}"`,
      `"${bill.valid_upto || ''}"`,
      `"${bill.notes || ''}"`,
    ].join(',')),
  ];

  return Buffer.from(rows.join('\n'), 'utf-8');
}

/**
 * Calculate days remaining until validity expires
 */
export function calculateDaysLeft(validUpto) {
  if (!validUpto) return null;
  
  const expiry = new Date(validUpto);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysLeft;
}

/**
 * Generate filename for export
 */
export function generateExportFilename(clientId, format = 'xlsx') {
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const clientPart = clientId ? `_${clientId}` : '_all-clients';
  return `ewaybills${clientPart}_${timestamp}.${format}`;
}

export default {
  exportEwayBillsToExcel,
  calculateDaysLeft,
  generateExportFilename,
};
