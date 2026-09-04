// src/utils/exportComparativeStatementExcel.js
// 🌟 High-Definition Executive Excel (.xlsx) Generator for Comparative Rate Statement, Counter Negotiation & Lifting Audit

export async function exportComparativeStatementExcel({
  rateRequest = {},
  routeRows = [],
  transporterColumns = [],
  submissions = [],
  allocations = [],
  dispatches = [],
  company = {},
  statementTypeLabel = 'COMPARATIVE FREIGHT RATE STATEMENT',
  activeReportMode = 'STANDARD'
}) {
  try {
    const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;

    const wb = new ExcelJS.Workbook();
    wb.creator = company?.name || 'Shalimar Nutrients Pvt Ltd';
    wb.lastModifiedBy = 'TransFlow Logistics ERP';
    wb.created = new Date();

    const reqNoStr = rateRequest.req_no || rateRequest.request_no || rateRequest.id || 'REQ-0001';
    const totalIndentQty = routeRows.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);

    // Filter and sort dispatches for this requirement chronologically
    const relevantDispatches = dispatches.filter((d) => {
      if (!d) return false;
      const matchReqId = String(d.requirement_id || '') === String(rateRequest.id);
      const matchReqNo = reqNoStr && (
        String(d.req_no || '') === String(reqNoStr) ||
        String(d.sub_indent_no || '').startsWith(String(reqNoStr)) ||
        String(d.requirement_id || '') === String(reqNoStr)
      );
      return matchReqId || matchReqNo;
    }).sort((a, b) => new Date(a.dispatched_at || 0) - new Date(b.dispatched_at || 0));

    const totalDispatchedQty = relevantDispatches.reduce(
      (acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0),
      0
    );
    const remainingBalanceQty = Math.max(0, totalIndentQty - totalDispatchedQty);

    // =========================================================================
    // 📑 SHEET 1: COMPARATIVE FREIGHT RATE STATEMENT (Standard Bidding Matrix)
    // =========================================================================
    const ws1 = wb.addWorksheet('Comparative Rate Matrix', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF064E3B' } }
    });

    const totalColumnsCount = 4 + transporterColumns.length + 2;
    const lastColLetter = getColumnLetter(totalColumnsCount);

    // 1. Corporate Banner Header
    ws1.mergeCells(`A1:${lastColLetter}1`);
    const title1 = ws1.getCell('A1');
    title1.value = company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.';
    title1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    title1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(1).height = 36;

    ws1.mergeCells(`A2:${lastColLetter}2`);
    const sub1 = ws1.getCell('A2');
    sub1.value = `${statementTypeLabel} COMPARATIVE FREIGHT RATE STATEMENT — ${new Date().toLocaleDateString('en-IN')}`;
    sub1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF6EE7B7' } };
    sub1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    sub1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 22;

    ws1.mergeCells(`A3:${lastColLetter}3`);
    const meta1 = ws1.getCell('A3');
    meta1.value = `${company?.reg_office || 'MIDC Industrial Area, Nagpur, Maharashtra - 440028'} | GSTIN: ${company?.gstin || '27AAPCS1419M1ZV'}`;
    meta1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFE2E8F0' } };
    meta1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    meta1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(3).height = 18;

    ws1.addRow([]); // Spacer Row 4

    // 2. High-Level Summary Cards
    ws1.mergeCells('B5:D5');
    ws1.getCell('B5').value = 'INDENT / BATCH PROFILE';
    ws1.getCell('B5').font = { name: 'Arial', bold: true, size: 9.5, color: { argb: 'FF0F172A' } };
    ws1.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    ws1.mergeCells('B6:D6');
    ws1.getCell('B6').value = `Indent No: ${reqNoStr} | Routes: ${routeRows.length}`;
    ws1.getCell('B6').font = { name: 'Arial', size: 9 };

    ws1.mergeCells('B7:D7');
    ws1.getCell('B7').value = `Total Indent Volume: ${totalIndentQty.toFixed(3)} MT`;
    ws1.getCell('B7').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };

    const midCol1 = getColumnLetter(Math.max(5, Math.floor(totalColumnsCount / 2)));
    const midCol2 = getColumnLetter(totalColumnsCount);

    ws1.mergeCells(`${midCol1}5:${midCol2}5`);
    ws1.getCell(`${midCol1}5`).value = 'LIFTING & DISPATCH SNAPSHOT';
    ws1.getCell(`${midCol1}5`).font = { name: 'Arial', bold: true, size: 9.5, color: { argb: 'FF0F172A' } };
    ws1.getCell(`${midCol1}5`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    ws1.mergeCells(`${midCol1}6:${midCol2}6`);
    ws1.getCell(`${midCol1}6`).value = `Dispatched So Far: ${totalDispatchedQty.toFixed(3)} MT (${relevantDispatches.length} Trucks)`;
    ws1.getCell(`${midCol1}6`).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };

    ws1.mergeCells(`${midCol1}7:${midCol2}7`);
    ws1.getCell(`${midCol1}7`).value = `Remaining to Lift: ${remainingBalanceQty.toFixed(3)} MT | Status: ${remainingBalanceQty <= 0.001 ? '100% Fully Dispatched' : 'Partially Dispatched'}`;
    ws1.getCell(`${midCol1}7`).font = { name: 'Arial', size: 9, bold: true, color: { argb: remainingBalanceQty <= 0.001 ? 'FF059669' : 'FFD97706' } };

    ws1.addRow([]); // Spacer Row 8

    // 3. Matrix Table Headers (Row 9)
    const tableHeaders = [
      'Sub-Indent No.',
      'Commodity / Cargo',
      'Route (Origin ➔ Destination)',
      'Quantity (MT)'
    ];

    transporterColumns.forEach((tCol) => {
      tableHeaders.push(`${(tCol.name || '').toUpperCase()} (${tCol.code || 'TR'})`);
    });

    tableHeaders.push('Minimum Rate (L1)');
    tableHeaders.push('Awarded Transporter / Status');

    const colWidths1 = [20, 18, 30, 15];
    transporterColumns.forEach(() => colWidths1.push(18));
    colWidths1.push(18, 28);

    const headerRow1 = ws1.addRow(tableHeaders);
    headerRow1.height = 28;

    headerRow1.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum === 4 || (colNum > 4 && colNum <= 4 + transporterColumns.length + 1) ? 'center' : 'left'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
      ws1.getColumn(colNum).width = colWidths1[colNum - 1] || 18;
    });

    // 4. Matrix Data Rows
    let startDataRow1 = 10;
    let totalL1Cost = 0;

    routeRows.forEach((rowObj, rIdx) => {
      const itemSubs = (submissions || []).filter((s) => {
        const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                         String(s.rate_request_id) === String(rateRequest.id) ||
                         String(s.requirement_id) === String(reqNoStr);
        const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                          String(s.item_id) === String(rowObj.id) ||
                          String(s.item_id) === String(rowObj.subIndentNo);
        return matchReq && matchItem;
      });

      const validRates = itemSubs
        .map((s) => Number(s.rate_per_mt ?? s.rate_per_unit ?? s.final_rate ?? s.original_rate))
        .filter((r) => !isNaN(r) && r > 0);
      const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
      totalL1Cost += (rowObj.qty * minRate);

      const alloc = (allocations || []).find((a) =>
        (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
        (!a.item_id || String(a.item_id) === String(rowObj.id))
      );
      const winner = alloc ? (company?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;
      const winnerName = alloc ? (alloc.transporter_name || winner?.company_name || 'Vendor') : '';

      const rowData = [
        rowObj.subIndentNo,
        rowObj.product,
        rowObj.locationName,
        rowObj.qty
      ];

      transporterColumns.forEach((tCol) => {
        const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
        const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
        const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
        rowData.push(rawRate !== null && !isNaN(Number(rawRate)) ? Number(rawRate) : '-');
      });

      rowData.push(minRate > 0 ? minRate : '-');
      rowData.push(alloc ? `Awarded: ${winnerName} @ ₹${alloc.agreed_rate}/MT` : minRate > 0 ? `L1 Quote: ₹${minRate}/MT` : 'Awaiting Bids');

      const dataRow = ws1.addRow(rowData);
      dataRow.height = 22;

      dataRow.eachCell((cell, colNum) => {
        const isMinCol = colNum === 4 + transporterColumns.length + 1;
        const isTransCol = colNum > 4 && colNum <= 4 + transporterColumns.length;

        cell.font = {
          name: 'Arial',
          size: 9,
          bold: isMinCol || colNum === 1 || colNum === 4,
          color: isMinCol ? { argb: 'FF15803D' } : { argb: 'FF0F172A' }
        };

        if (rIdx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }

        if (isMinCol) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        }

        if (isTransCol && cell.value !== '-' && Number(cell.value) === minRate && minRate > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
        }

        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 4 || isTransCol || isMinCol ? 'center' : 'left'
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // =========================================================================
    // 📑 SHEET 2: COUNTER RATE NEGOTIATION STATEMENT & SAVINGS ANALYSIS
    // =========================================================================
    const ws2 = wb.addWorksheet('Counter Rate Negotiation', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FFC2410C' } }
    });

    const totalCounterColsCount = 5 + transporterColumns.length + 2;
    const lastCounterColLetter = getColumnLetter(totalCounterColsCount);

    ws2.mergeCells(`A1:${lastCounterColLetter}1`);
    const cTitle = ws2.getCell('A1');
    cTitle.value = company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.';
    cTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } };
    cTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 36;

    ws2.mergeCells(`A2:${lastCounterColLetter}2`);
    const cSub = ws2.getCell('A2');
    cSub.value = `${statementTypeLabel} COUNTER RATE NEGOTIATION STATEMENT & SAVINGS AUDIT — ${new Date().toLocaleDateString('en-IN')}`;
    cSub.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFEDD5' } };
    cSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } };
    cSub.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(2).height = 22;

    ws2.addRow([]); // Spacer

    // Counter Negotiation Headers
    const counterHeaders = [
      'Sub-Indent No.',
      'Commodity / Cargo',
      'Route (Origin ➔ Destination)',
      'Quantity (MT)',
      'Initial L1 Rate',
      'Admin Counter Target 🎯'
    ];

    transporterColumns.forEach((tCol) => {
      counterHeaders.push(`${(tCol.name || '').toUpperCase()} (${tCol.code || 'TR'})`);
    });

    counterHeaders.push('Final Agreed Rate');
    counterHeaders.push('Negotiated Savings (₹)');

    const cHeaderRow = ws2.addRow(counterHeaders);
    cHeaderRow.height = 28;

    cHeaderRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 4 ? 'center' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
      ws2.getColumn(colNum).width = 18;
    });

    let totalCounterSavings = 0;
    let totalAgreedOutlay = 0;

    routeRows.forEach((rowObj, rIdx) => {
      const itemSubs = (submissions || []).filter((s) => {
        const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                         String(s.rate_request_id) === String(rateRequest.id) ||
                         String(s.requirement_id) === String(reqNoStr);
        const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                          String(s.item_id) === String(rowObj.id) ||
                          String(s.item_id) === String(rowObj.subIndentNo);
        return matchReq && matchItem;
      });

      const validRates = itemSubs
        .map((s) => Number(s.rate_per_mt ?? s.rate_per_unit ?? s.final_rate ?? s.original_rate))
        .filter((r) => !isNaN(r) && r > 0);
      const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
      const counterRate = rowObj.adminCounterRate;

      const alloc = (allocations || []).find((a) =>
        (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
        (!a.item_id || String(a.item_id) === String(rowObj.id))
      );
      const finalRate = alloc ? Number(alloc.agreed_rate) : counterRate > 0 ? counterRate : minRate;
      const savingsPerMT = (minRate > 0 && counterRate > 0 && minRate > counterRate) ? (minRate - counterRate) : 0;
      const totalSavings = savingsPerMT * rowObj.qty;

      totalCounterSavings += totalSavings;
      totalAgreedOutlay += (finalRate * rowObj.qty);

      const rowData = [
        rowObj.subIndentNo,
        rowObj.product,
        rowObj.locationName,
        rowObj.qty,
        minRate > 0 ? minRate : '-',
        counterRate > 0 ? counterRate : '-'
      ];

      transporterColumns.forEach((tCol) => {
        const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
        const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
        const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
        const rateVal = rawRate !== null && !isNaN(Number(rawRate)) ? Number(rawRate) : null;

        const isAccepted = sub && (
          sub.counter_offer_status === 'accepted' ||
          sub.is_frozen === true ||
          (sub.final_rate && Number(sub.final_rate) === Number(counterRate)) ||
          (rateVal !== null && counterRate !== null && Number(rateVal) <= Number(counterRate))
        );

        rowData.push(rateVal !== null ? (isAccepted ? `${rateVal} (ACCEPTED)` : rateVal) : '-');
      });

      rowData.push(finalRate > 0 ? finalRate : '-');
      rowData.push(savingsPerMT > 0 ? `₹${savingsPerMT}/MT (₹${totalSavings.toLocaleString()})` : '₹0');

      const dataRow = ws2.addRow(rowData);
      dataRow.height = 22;

      dataRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        if (colNum === 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        if (colNum === 6) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFC2410C' } };
        }
        if (colNum === totalCounterColsCount - 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
        }
        if (colNum === totalCounterColsCount) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
        }
        cell.alignment = { vertical: 'middle', horizontal: colNum >= 4 ? 'center' : 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // =========================================================================
    // 📑 SHEET 3: MATERIAL LIFTING & DISPATCH CHRONICLE
    // =========================================================================
    if (relevantDispatches.length > 0) {
      const ws3 = wb.addWorksheet('Material Lifting & Dispatches', {
        views: [{ showGridLines: true }],
        properties: { tabColor: { argb: 'FF0284C7' } }
      });

      ws3.mergeCells('A1:K1');
      const dTitle = ws3.getCell('A1');
      dTitle.value = company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.';
      dTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      dTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      ws3.getRow(1).height = 36;

      ws3.mergeCells('A2:K2');
      const dSub = ws3.getCell('A2');
      dSub.value = `${statementTypeLabel} MATERIAL LIFTING & DISPATCH CHRONICLE (Pehle vs Baad me)`;
      dSub.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFE0F2FE' } };
      dSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      dSub.alignment = { vertical: 'middle', horizontal: 'center' };
      ws3.getRow(2).height = 22;

      ws3.addRow([]);

      const dispatchHeaders = [
        'Stage / Phase',
        'LR Number',
        'Date',
        'Transporter',
        'Truck No.',
        'Driver Name & Mobile',
        'Loaded Qty (MT)',
        'Rate / MT',
        'Freight Amount (₹)',
        'Cumulative Loaded (MT)',
        'Remaining Balance (MT)'
      ];

      const dHeaderRow = ws3.addRow(dispatchHeaders);
      dHeaderRow.height = 28;

      dHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      let runningLoaded = 0;
      relevantDispatches.forEach((d, idx) => {
        const qty = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
        const rate = Number(d.finalized_rate ?? d.freight_rate) || 0;
        const gross = Math.round(qty * rate * 100) / 100;
        runningLoaded += qty;
        const rem = Math.max(0, totalIndentQty - runningLoaded);

        const dRow = ws3.addRow([
          idx === 0 ? '1st Dispatch (Pehle)' : `${idx + 1}th Dispatch (Baad me)`,
          d.lr_number || d.lr_no || d.id,
          d.dispatched_at ? new Date(d.dispatched_at).toLocaleDateString('en-IN') : '-',
          d.transporter_name || 'Vendor',
          d.truck_number || d.truck_no,
          `${d.driver_name || 'Driver'} (${d.driver_mobile || '-'})`,
          qty,
          rate,
          gross,
          runningLoaded,
          rem
        ]);
        dRow.height = 22;
      });
    }

    // Generate real Excel binary buffer and download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const cleanReqNo = String(reqNoStr).replace(/[\/\\]/g, '_');
    const filename = `Comparative_Statement_and_Counter_Audit_${cleanReqNo}.xlsx`;

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
    console.error('Error generating comparative Excel (.xlsx):', err);
    throw err;
  }
}

// Helper to convert 1-based column number to Excel column letter
function getColumnLetter(colNum) {
  let temp;
  let letter = '';
  while (colNum > 0) {
    temp = (colNum - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colNum = (colNum - temp - 1) / 26;
  }
  return letter;
}
