// src/utils/exportMonthEndExcel.js
// 🌟 High-Definition Executive Excel (.xlsx) Generator for Shalimar Freight Billing Statements

export async function exportMonthEndExcel({
  dispatches = [],
  transporter = {},
  selectedMonth = '',
  company = {}
}) {
  try {
    // Dynamic import for zero bundle bloat
    const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;

    const wb = new ExcelJS.Workbook();
    wb.creator = company?.name || 'Shalimar Nutrients Pvt Ltd';
    wb.lastModifiedBy = 'TransFlow Logistics ERP';
    wb.created = new Date();

    const ws = wb.addWorksheet('Billing Statement', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF064E3B' } }
    });

    const transporterName = transporter?.company_name || transporter?.name || 'Vendor';
    const transporterCode = transporter?.code || 'TR001';
    const transporterGst = transporter?.gst_pan || transporter?.gstin || '27AAPCS1419M1ZV';
    const transporterPhone = transporter?.phone || transporter?.mobile || 'N/A';
    const monthLabel = selectedMonth ? selectedMonth : 'All-Time Summary';

    // 1. Corporate Brand Header (Row 1 to 3)
    ws.mergeCells('A1:O1');
    const title = ws.getCell('A1');
    title.value = company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.';
    title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:O2');
    const sub = ws.getCell('A2');
    sub.value = 'MONTH-END FREIGHT BILLING & DISPATCH AUDIT STATEMENT';
    sub.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF6EE7B7' } };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    sub.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 22;

    ws.mergeCells('A3:O3');
    const meta = ws.getCell('A3');
    meta.value = `${company?.reg_office || 'MIDC Industrial Area, Nagpur, Maharashtra - 440028'} | GSTIN: ${company?.gstin || '27AAPCS1419M1ZV'}`;
    meta.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFE2E8F0' } };
    meta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    meta.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(3).height = 18;

    ws.addRow([]); // Row 4 Spacer

    // 2. Metadata Cards (Row 5 to 7)
    ws.mergeCells('B5:E5');
    ws.getCell('B5').value = 'TRANSPORTER PROFILE';
    ws.getCell('B5').font = { name: 'Arial', bold: true, color: { argb: 'FF0F172A' }, size: 9.5 };
    ws.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    ws.mergeCells('B6:E6');
    ws.getCell('B6').value = `Vendor: ${transporterName} (Code: ${transporterCode}) | GST: ${transporterGst}`;
    ws.getCell('B6').font = { name: 'Arial', size: 9 };

    ws.mergeCells('B7:E7');
    ws.getCell('B7').value = `Contact Mobile: ${transporterPhone}`;
    ws.getCell('B7').font = { name: 'Arial', size: 9 };

    ws.mergeCells('J5:N5');
    ws.getCell('J5').value = 'BILLING STATEMENT SUMMARY';
    ws.getCell('J5').font = { name: 'Arial', bold: true, color: { argb: 'FF0F172A' }, size: 9.5 };
    ws.getCell('J5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    ws.mergeCells('J6:N6');
    ws.getCell('J6').value = `Period: ${monthLabel} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
    ws.getCell('J6').font = { name: 'Arial', size: 9 };

    const totalTonnage = dispatches.reduce((acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0), 0);
    ws.mergeCells('J7:N7');
    ws.getCell('J7').value = `Total Dispatches: ${dispatches.length} Trucks | Total Delivered: ${totalTonnage.toFixed(3)} MT`;
    ws.getCell('J7').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };

    ws.addRow([]); // Row 8 Spacer

    // 3. Table Column Headers (Row 9)
    const headers = [
      'Sr.',
      'LR Number',
      'Dispatch Date',
      'Truck No.',
      'Driver Name',
      'Driver Mobile',
      'Indent Code',
      'Product / Cargo',
      'Origin',
      'Destination',
      'Loaded Qty (MT)',
      'Rate / MT (₹)',
      'Gross Freight (₹)',
      '5% GST (₹)',
      'Total Invoice (₹)'
    ];

    const colWidths = [6, 22, 14, 16, 16, 16, 24, 18, 14, 15, 16, 14, 18, 14, 20];
    const headerRow = ws.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum >= 11 ? 'right' : (colNum === 1 || colNum === 3 ? 'center' : 'left')
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
      ws.getColumn(colNum).width = colWidths[colNum - 1];
    });

    // 4. Data Rows
    let startRowIndex = 10;
    let currentRowIndex = startRowIndex;

    dispatches.forEach((d, idx) => {
      const qty = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty ?? 0) || 0;
      const rate = Number(d.finalized_rate ?? d.freight_rate ?? 0) || 0;
      const gross = Math.round(qty * rate * 100) / 100;
      const gst = Math.round(gross * 0.05 * 100) / 100;
      const total = Math.round((gross + gst) * 100) / 100;

      const dateStr = d.dispatched_at
        ? new Date(d.dispatched_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-';

      const rowValues = [
        idx + 1,
        d.lr_number || d.lr_no || d.id || 'N/A',
        dateStr,
        d.truck_number || d.truck_no || 'N/A',
        d.driver_name || 'Driver',
        String(d.driver_mobile || d.driver_phone || 'N/A'),
        d.sub_indent_no || d.req_no || 'SNPL/REQ-01',
        d.product_name || d.material_type || 'Agri Cargo',
        d.pickup_origin || 'Origin',
        d.drop_location || 'Destination',
        qty,
        rate,
        gross,
        gst,
        total
      ];

      const row = ws.addRow(rowValues);
      row.height = 23;
      const isEven = idx % 2 === 0;

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum >= 11 ? 'right' : (colNum === 1 || colNum === 3 ? 'center' : 'left')
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Precision Cell Types
        if (colNum === 2) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };
        if (colNum === 4) cell.font = { name: 'Arial', size: 9, bold: true };
        if (colNum === 6) cell.numFmt = '@'; // Prevent Excel scientific conversion!
        if (colNum === 11) {
          cell.numFmt = '#,##0.000 "MT"';
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
        }
        if (colNum === 12) cell.numFmt = '"₹"#,##0.00';
        if (colNum === 13) {
          cell.numFmt = '"₹"#,##0.00';
          cell.font = { name: 'Arial', size: 9, bold: true };
        }
        if (colNum === 14) cell.numFmt = '"₹"#,##0.00';
        if (colNum === 15) {
          cell.numFmt = '"₹"#,##0.00';
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
        }
      });

      currentRowIndex++;
    });

    // 5. Total Row
    const totalRowIndex = currentRowIndex;
    const lastDataRowIndex = Math.max(startRowIndex, totalRowIndex - 1);

    ws.mergeCells(`A${totalRowIndex}:J${totalRowIndex}`);
    const totalLabel = ws.getCell(`A${totalRowIndex}`);
    totalLabel.value = 'GRAND SUMMARY TOTAL';
    totalLabel.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    totalLabel.alignment = { vertical: 'middle', horizontal: 'right' };

    const totalRow = ws.getRow(totalRowIndex);
    totalRow.height = 26;

    // Quantity Total
    const qtySumCell = ws.getCell(`K${totalRowIndex}`);
    qtySumCell.value = { formula: `SUM(K${startRowIndex}:K${lastDataRowIndex})`, result: totalTonnage };
    qtySumCell.numFmt = '#,##0.000 "MT"';
    qtySumCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    qtySumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    qtySumCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Rate Blank
    const blankRateCell = ws.getCell(`L${totalRowIndex}`);
    blankRateCell.value = '-';
    blankRateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    blankRateCell.font = { color: { argb: 'FFFFFFFF' } };
    blankRateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };

    // Gross Freight Total
    const totalGross = dispatches.reduce((acc, d) => {
      const q = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
      const r = Number(d.finalized_rate ?? d.freight_rate) || 0;
      return acc + (q * r);
    }, 0);

    const grossSumCell = ws.getCell(`M${totalRowIndex}`);
    grossSumCell.value = { formula: `SUM(M${startRowIndex}:M${lastDataRowIndex})`, result: totalGross };
    grossSumCell.numFmt = '"₹"#,##0.00';
    grossSumCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    grossSumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    grossSumCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // GST Total
    const totalGst = Math.round(totalGross * 0.05 * 100) / 100;
    const gstSumCell = ws.getCell(`N${totalRowIndex}`);
    gstSumCell.value = { formula: `SUM(N${startRowIndex}:N${lastDataRowIndex})`, result: totalGst };
    gstSumCell.numFmt = '"₹"#,##0.00';
    gstSumCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    gstSumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    gstSumCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Grand Total Invoice
    const grandTotal = totalGross + totalGst;
    const grandSumCell = ws.getCell(`O${totalRowIndex}`);
    grandSumCell.value = { formula: `SUM(O${startRowIndex}:O${lastDataRowIndex})`, result: grandTotal };
    grandSumCell.numFmt = '"₹"#,##0.00';
    grandSumCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    grandSumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    grandSumCell.alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 15; c++) {
      ws.getRow(totalRowIndex).getCell(c).border = {
        top: { style: 'medium', color: { argb: 'FF064E3B' } },
        bottom: { style: 'double', color: { argb: 'FF064E3B' } }
      };
    }

    // 6. Financial Settlement KPI Breakdown (Rows after table)
    const breakdownStart = totalRowIndex + 2;
    ws.addRow([]);

    ws.mergeCells(`K${breakdownStart}:O${breakdownStart}`);
    const bHead = ws.getCell(`K${breakdownStart}`);
    bHead.value = 'FINANCIAL SETTLEMENT SUMMARY';
    bHead.font = { name: 'Arial', bold: true, size: 9.5, color: { argb: 'FF1E293B' } };
    bHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    bHead.alignment = { vertical: 'middle', horizontal: 'center' };

    const addSummaryRow = (rowOffset, label, val, isBold, bg, color) => {
      const rIdx = breakdownStart + rowOffset;
      ws.mergeCells(`K${rIdx}:M${rIdx}`);
      const lCell = ws.getCell(`K${rIdx}`);
      lCell.value = label;
      lCell.font = { name: 'Arial', size: 9, bold: isBold };
      lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      ws.mergeCells(`N${rIdx}:O${rIdx}`);
      const vCell = ws.getCell(`N${rIdx}`);
      vCell.value = val;
      vCell.numFmt = '"₹"#,##0.00';
      vCell.font = { name: 'Arial', size: 9.5, bold: isBold, color: { argb: color } };
      vCell.alignment = { horizontal: 'right' };
      vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    };

    addSummaryRow(1, 'Gross Freight Billing', totalGross, false, 'FFFFFFFF', 'FF0F172A');
    addSummaryRow(2, 'Estimated 5% GST', totalGst, false, 'FFFFFFFF', 'FF0F172A');
    addSummaryRow(3, 'Total Invoice Value', grandTotal, true, 'FFF1F5F9', 'FF047857');
    addSummaryRow(4, 'Estimated 70% Advance Disbursed', Math.round(totalGross * 0.7), true, 'FFEFF6FF', 'FF1D4ED8');
    addSummaryRow(5, 'Estimated 30% Balance Pending', Math.round(totalGross * 0.3), true, 'FFF0FDF4', 'FF15803D');

    // 7. Sign-off Boxes (Bottom)
    const signRow = breakdownStart + 7;
    ws.mergeCells(`B${signRow}:E${signRow}`);
    const signTrans = ws.getCell(`B${signRow}`);
    signTrans.value = '____________________________________\nTransporter Authorized Signatory';
    signTrans.font = { name: 'Arial', size: 9, bold: true };
    signTrans.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    ws.mergeCells(`J${signRow}:N${signRow}`);
    const signShalimar = ws.getCell(`J${signRow}`);
    signShalimar.value = '____________________________________\nShalimar Logistics & Accounts Approval';
    signShalimar.font = { name: 'Arial', size: 9, bold: true };
    signShalimar.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    ws.getRow(signRow).height = 36;

    // Generate real Excel binary buffer
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const cleanTransporter = String(transporterCode).replace(/[\/\\]/g, '_');
    const cleanMonth = String(selectedMonth || 'AllTime').replace(/[\/\\]/g, '_');
    const filename = `MonthEnd_Billing_Statement_${cleanTransporter}_${cleanMonth}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Error generating executive Excel (.xlsx):', err);
    throw err;
  }
}
