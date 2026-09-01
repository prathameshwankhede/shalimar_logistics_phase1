// src/utils/exportComparativeStatementExcel.js
// 🌟 High-Definition Executive Excel (.xlsx) Generator for Comparative Rate Statement & Lifting Audit

export async function exportComparativeStatementExcel({
  rateRequest = {},
  routeRows = [],
  transporterColumns = [],
  submissions = [],
  allocations = [],
  dispatches = [],
  company = {},
  statementTypeLabel = 'COMPARATIVE FREIGHT RATE STATEMENT'
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
    // 📑 SHEET 1: COMPARATIVE FREIGHT RATE STATEMENT (Bidding Matrix)
    // =========================================================================
    const ws1 = wb.addWorksheet('Comparative Rate Matrix', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF064E3B' } }
    });

    const totalColumnsCount = 4 + transporterColumns.length + 2; // Sub-indent, Product, Route, Qty, Transporters..., Min Rate, Remark
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

    // 2. High-Level Summary Cards (Row 5 to 7)
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

    // Lifting Quick Snapshot on Sheet 1
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
        horizontal: colNum === 4 || colNum > 4 && colNum <= 4 + transporterColumns.length + 1 ? 'center' : 'left'
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

      const alloc = (allocations || []).find((a) =>
        (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
        (!a.item_id || String(a.item_id) === String(rowObj.id))
      );
      const winner = alloc ? (company?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;
      const winnerName = alloc ? (alloc.transporter_name || winner?.company_name || 'Vendor') : '';

      const rowData = [
        rowObj.subIndentNo,
        rowObj.product,
        `${rowObj.origin} ➔ ${rowObj.dest}`,
        rowObj.qty
      ];

      const ratesPerCol = [];
      transporterColumns.forEach((tCol) => {
        const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
        const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
        const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
        const rateVal = rawRate !== null && !isNaN(Number(rawRate)) && Number(rawRate) > 0 ? Number(rawRate) : null;
        ratesPerCol.push(rateVal);
        rowData.push(rateVal !== null ? rateVal : '-');
      });

      rowData.push(minRate > 0 ? minRate : '-');

      const remark = alloc
        ? `🏆 Awarded: ${winnerName} @ ₹${alloc.agreed_rate}/MT`
        : minRate > 0
        ? `L1 Lowest Quote: ₹${minRate}/MT`
        : 'Awaiting Bids';
      rowData.push(remark);

      const dRow = ws1.addRow(rowData);
      dRow.height = 24;
      const isEven = rIdx % 2 === 0;

      dRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
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

        if (colNum === 1) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };
        if (colNum === 4) {
          cell.numFmt = '#,##0.000 "MT"';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
        }

        // Transporter rate cells
        const transColStartIndex = 5;
        const transColEndIndex = 4 + transporterColumns.length;
        if (colNum >= transColStartIndex && colNum <= transColEndIndex) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          const rateVal = ratesPerCol[colNum - transColStartIndex];
          if (rateVal !== null) {
            cell.numFmt = '"₹"#,##0.00';
            if (rateVal === minRate && minRate > 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
              cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
            } else {
              cell.font = { name: 'Arial', size: 9, bold: true };
            }
          }
        }

        // Min Rate Column
        if (colNum === transColEndIndex + 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (minRate > 0) {
            cell.numFmt = '"₹"#,##0.00';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
          }
        }

        // Remark Column
        if (colNum === transColEndIndex + 2) {
          if (alloc) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF15803D' } };
          } else if (minRate > 0) {
            cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0284C7' } };
          }
        }
      });
    });

    // 5. Total Row on Matrix
    const lastMatrixRow = startDataRow1 + routeRows.length - 1;
    const summaryRow1Index = lastMatrixRow + 1;

    ws1.mergeCells(`A${summaryRow1Index}:C${summaryRow1Index}`);
    const totLabel1 = ws1.getCell(`A${summaryRow1Index}`);
    totLabel1.value = 'TOTAL BATCH TONNAGE';
    totLabel1.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totLabel1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    totLabel1.alignment = { vertical: 'middle', horizontal: 'right' };

    const totQtyCell1 = ws1.getCell(`D${summaryRow1Index}`);
    totQtyCell1.value = { formula: `SUM(D${startDataRow1}:D${lastMatrixRow})`, result: totalIndentQty };
    totQtyCell1.numFmt = '#,##0.000 "MT"';
    totQtyCell1.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totQtyCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    totQtyCell1.alignment = { vertical: 'middle', horizontal: 'center' };

    for (let c = 5; c <= totalColumnsCount; c++) {
      const emptyTotalCell = ws1.getCell(`${getColumnLetter(c)}${summaryRow1Index}`);
      emptyTotalCell.value = '-';
      emptyTotalCell.font = { color: { argb: 'FFFFFFFF' } };
      emptyTotalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      emptyTotalCell.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    for (let c = 1; c <= totalColumnsCount; c++) {
      ws1.getRow(summaryRow1Index).getCell(c).border = {
        top: { style: 'medium', color: { argb: 'FF064E3B' } },
        bottom: { style: 'double', color: { argb: 'FF064E3B' } }
      };
    }

    // =========================================================================
    // 🚚 SHEET 2: MATERIAL LIFTING & DISPATCH AUDIT ("Kisne kitna load kiya, pehle vs baad me")
    // =========================================================================
    const ws2 = wb.addWorksheet('Lifting & Dispatch Audit', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF0284C7' } }
    });

    // 1. Corporate Banner Header for Sheet 2
    ws2.mergeCells('A1:M1');
    const title2 = ws2.getCell('A1');
    title2.value = `${company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.'} — MATERIAL LIFTING & DISPATCH AUDIT`;
    title2.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
    title2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 34;

    ws2.mergeCells('A2:M2');
    const sub2 = ws2.getCell('A2');
    sub2.value = `CHRONOLOGICAL LIFTING CHRONICLE FOR INDENT ${reqNoStr} (INITIAL DISPATCH VS REMAINING DISPATCHES)`;
    sub2.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFBAE6FD' } };
    sub2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
    sub2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(2).height = 22;

    ws2.addRow([]); // Spacer Row 3

    // 2. Executive Fulfillment KPI Cards (Row 4 to 6)
    ws2.mergeCells('B4:D4');
    ws2.getCell('B4').value = 'TOTAL INDENT ORDER';
    ws2.getCell('B4').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' }, bold: true };
    ws2.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws2.getCell('B4').alignment = { horizontal: 'center' };

    ws2.mergeCells('B5:D5');
    ws2.getCell('B5').value = `${totalIndentQty.toFixed(3)} MT`;
    ws2.getCell('B5').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    ws2.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws2.getCell('B5').alignment = { horizontal: 'center' };

    ws2.mergeCells('E4:G4');
    ws2.getCell('E4').value = 'TOTAL LOADED / DISPATCHED';
    ws2.getCell('E4').font = { name: 'Arial', size: 8.5, color: { argb: 'FF0284C7' }, bold: true };
    ws2.getCell('E4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    ws2.getCell('E4').alignment = { horizontal: 'center' };

    ws2.mergeCells('E5:G5');
    ws2.getCell('E5').value = `${totalDispatchedQty.toFixed(3)} MT`;
    ws2.getCell('E5').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0284C7' } };
    ws2.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    ws2.getCell('E5').alignment = { horizontal: 'center' };

    ws2.mergeCells('H4:J4');
    ws2.getCell('H4').value = 'REMAINING BALANCE TO LIFT';
    ws2.getCell('H4').font = { name: 'Arial', size: 8.5, color: { argb: remainingBalanceQty <= 0.001 ? 'FF059669' : 'FFD97706' }, bold: true };
    ws2.getCell('H4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: remainingBalanceQty <= 0.001 ? 'FFDCFCE7' : 'FFFEF3C7' } };
    ws2.getCell('H4').alignment = { horizontal: 'center' };

    ws2.mergeCells('H5:J5');
    ws2.getCell('H5').value = `${remainingBalanceQty.toFixed(3)} MT`;
    ws2.getCell('H5').font = { name: 'Arial', size: 14, bold: true, color: { argb: remainingBalanceQty <= 0.001 ? 'FF059669' : 'FFD97706' } };
    ws2.getCell('H5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: remainingBalanceQty <= 0.001 ? 'FFDCFCE7' : 'FFFEF3C7' } };
    ws2.getCell('H5').alignment = { horizontal: 'center' };

    const fulfillmentPct = totalIndentQty > 0 ? Math.min(100, Math.round((totalDispatchedQty / totalIndentQty) * 100)) : 0;
    ws2.mergeCells('K4:M4');
    ws2.getCell('K4').value = 'FULFILLMENT PROGRESS';
    ws2.getCell('K4').font = { name: 'Arial', size: 8.5, color: { argb: 'FF059669' }, bold: true };
    ws2.getCell('K4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    ws2.getCell('K4').alignment = { horizontal: 'center' };

    ws2.mergeCells('K5:M5');
    ws2.getCell('K5').value = `${fulfillmentPct}% COMPLETE`;
    ws2.getCell('K5').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF059669' } };
    ws2.getCell('K5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    ws2.getCell('K5').alignment = { horizontal: 'center' };

    ws2.addRow([]); // Spacer Row 6
    ws2.addRow([]); // Spacer Row 7

    // 3. SECTION A: TRANSPORTER-WISE LIFTING SUMMARY ("Kisne kitna load kiya")
    ws2.mergeCells('A8:M8');
    const secATitle = ws2.getCell('A8');
    secATitle.value = 'SECTION 1: TRANSPORTER-WISE TOTAL LIFTING SUMMARY (KISNE KITNA LOAD KIYA)';
    secATitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    secATitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    ws2.getRow(8).height = 24;

    const summaryHeaders = [
      'Sr.',
      'Transporter Name',
      'Vendor Code',
      'Total Trucks Loaded',
      'Total Tonnage Loaded (MT)',
      '% of Total Order',
      'Agreed Rate / MT (₹)',
      'Total Freight Earned (₹)',
      '70% Advance Disbursed',
      '30% Balance Pending',
      'Lifting Status',
      '',
      ''
    ];

    const sHeadRow = ws2.addRow(summaryHeaders);
    sHeadRow.height = 24;
    sHeadRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 4 && colNum <= 10 ? 'right' : (colNum === 1 || colNum === 3 ? 'center' : 'left') };
    });

    // Aggregate by transporter
    const transporterMap = {};
    relevantDispatches.forEach((d) => {
      const tKey = d.transporter_code || d.transporter_id || 'TR';
      if (!transporterMap[tKey]) {
        transporterMap[tKey] = {
          name: d.transporter_name || 'Vendor',
          code: tKey,
          trucks: 0,
          qty: 0,
          rate: Number(d.finalized_rate ?? d.freight_rate) || 0,
          gross: 0
        };
      }
      const q = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
      const r = Number(d.finalized_rate ?? d.freight_rate) || transporterMap[tKey].rate;
      transporterMap[tKey].trucks += 1;
      transporterMap[tKey].qty += q;
      transporterMap[tKey].gross += (q * r);
    });

    const transSummaryList = Object.values(transporterMap);
    if (transSummaryList.length === 0) {
      const emptyRow = ws2.addRow(['-', 'No trucks dispatched yet for this requirement.', '-', 0, 0, '0%', '-', 0, 0, 0, 'Awaiting Dispatch', '', '']);
      emptyRow.font = { italic: true, color: { argb: 'FF94A3B8' } };
    } else {
      transSummaryList.forEach((tSummary, idx) => {
        const pct = totalIndentQty > 0 ? ((tSummary.qty / totalIndentQty) * 100).toFixed(1) : '0.0';
        const adv = Math.round(tSummary.gross * 0.7);
        const bal = Math.round(tSummary.gross * 0.3);

        const r = ws2.addRow([
          idx + 1,
          tSummary.name,
          tSummary.code,
          `${tSummary.trucks} Trucks`,
          tSummary.qty,
          `${pct}%`,
          tSummary.rate,
          tSummary.gross,
          adv,
          bal,
          tSummary.qty >= totalIndentQty ? 'Order Fulfilled' : 'Active Lifting',
          '',
          ''
        ]);
        r.height = 22;

        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNum === 1 || colNum === 3) cell.alignment = { horizontal: 'center' };
          if (colNum >= 4 && colNum <= 10) cell.alignment = { horizontal: 'right' };

          if (colNum === 2) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };
          if (colNum === 5) {
            cell.numFmt = '#,##0.000 "MT"';
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
          }
          if (colNum === 7) cell.numFmt = '"₹"#,##0.00';
          if (colNum === 8) { cell.numFmt = '"₹"#,##0.00'; cell.font = { bold: true }; }
          if (colNum === 9 || colNum === 10) cell.numFmt = '"₹"#,##0.00';
        });
      });
    }

    ws2.addRow([]); // Spacer
    ws2.addRow([]); // Spacer

    // 4. SECTION B: CHRONOLOGICAL DISPATCH LEDGER ("Pehle kitna kiya, baad me kitna kiya")
    const secBTitleRowIndex = ws2.rowCount + 1;
    ws2.mergeCells(`A${secBTitleRowIndex}:M${secBTitleRowIndex}`);
    const secBTitle = ws2.getCell(`A${secBTitleRowIndex}`);
    secBTitle.value = 'SECTION 2: CHRONOLOGICAL DISPATCH LEDGER (PEHLE KITNA LOAD KIYA VS BAAD ME REMAINING KITNA KIYA)';
    secBTitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    secBTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    ws2.getRow(secBTitleRowIndex).height = 24;

    const ledgerHeaders = [
      'Stage / Phase',
      'LR Number',
      'Dispatch Date',
      'Transporter',
      'Truck No.',
      'Driver Name',
      'Driver Mobile',
      'Commodity & Route',
      'Loaded Qty (MT)',
      'Rate / MT (₹)',
      'Freight Amount (₹)',
      'Cumulative Loaded (MT)',
      'Remaining Balance (MT)'
    ];

    const colWidths2 = [22, 22, 14, 18, 16, 16, 15, 26, 16, 14, 18, 20, 20];
    const lHeadRow = ws2.addRow(ledgerHeaders);
    lHeadRow.height = 26;

    lHeadRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNum >= 9 ? 'right' : (colNum === 1 || colNum === 3 || colNum === 5 ? 'center' : 'left')
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
      ws2.getColumn(colNum).width = colWidths2[colNum - 1] || 18;
    });

    let runningTotalLoaded = 0;
    const ledgerStartRow = ws2.rowCount + 1;

    if (relevantDispatches.length === 0) {
      const emptyLedger = ws2.addRow(['Awaiting 1st Dispatch', '-', '-', '-', '-', '-', '-', '-', 0, 0, 0, 0, totalIndentQty]);
      emptyLedger.font = { italic: true, color: { argb: 'FF94A3B8' } };
    } else {
      relevantDispatches.forEach((d, idx) => {
        const qty = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty ?? 0) || 0;
        const rate = Number(d.finalized_rate ?? d.freight_rate ?? 0) || 0;
        const gross = Math.round(qty * rate * 100) / 100;
        runningTotalLoaded += qty;
        const curRemaining = Math.max(0, totalIndentQty - runningTotalLoaded);

        const stageLabel = idx === 0
          ? '1st Dispatch (Pehle)'
          : `${idx + 1}th Dispatch (Baad me)`;

        const dateFormatted = d.dispatched_at
          ? new Date(d.dispatched_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '-';

        const routeStr = (d.pickup_origin && d.drop_location)
          ? `${d.pickup_origin} ➔ ${d.drop_location}`
          : 'MIDC ➔ Plant';

        const rowValues = [
          stageLabel,
          d.lr_number || d.lr_no || d.id || 'N/A',
          dateFormatted,
          `${d.transporter_name || 'Vendor'} (${d.transporter_code || 'TR'})`,
          d.truck_number || d.truck_no || 'N/A',
          d.driver_name || 'Driver',
          String(d.driver_mobile || d.driver_phone || 'N/A'),
          `${d.product_name || 'Agri'} (${routeStr})`,
          qty,
          rate,
          gross,
          runningTotalLoaded,
          curRemaining
        ];

        const row = ws2.addRow(rowValues);
        row.height = 23;
        const isEven = idx % 2 === 0;

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNum >= 9 ? 'right' : (colNum === 1 || colNum === 3 || colNum === 5 ? 'center' : 'left')
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

          if (colNum === 1) {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: idx === 0 ? 'FF0284C7' : 'FF059669' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx === 0 ? 'FFE0F2FE' : 'FFDCFCE7' } };
          }
          if (colNum === 2) cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };
          if (colNum === 5) cell.font = { name: 'Arial', size: 9, bold: true };
          if (colNum === 7) cell.numFmt = '@'; // Prevent scientific notation!
          if (colNum === 9) {
            cell.numFmt = '#,##0.000 "MT"';
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
          }
          if (colNum === 10) cell.numFmt = '"₹"#,##0.00';
          if (colNum === 11) { cell.numFmt = '"₹"#,##0.00'; cell.font = { bold: true }; }
          if (colNum === 12) {
            cell.numFmt = '#,##0.000 "MT"';
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0284C7' } };
          }
          if (colNum === 13) {
            cell.numFmt = '#,##0.000 "MT"';
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: curRemaining <= 0.001 ? 'FF059669' : 'FFD97706' } };
          }
        });
      });
    }

    // 5. Total Ledger Row
    const ledgerEndRow = ws2.rowCount;
    const ledgerTotalRowIndex = ledgerEndRow + 1;

    ws2.mergeCells(`A${ledgerTotalRowIndex}:H${ledgerTotalRowIndex}`);
    const lTotLabel = ws2.getCell(`A${ledgerTotalRowIndex}`);
    lTotLabel.value = 'TOTAL DISPATCHED SUMMARY';
    lTotLabel.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lTotLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    lTotLabel.alignment = { vertical: 'middle', horizontal: 'right' };

    const lTotRow = ws2.getRow(ledgerTotalRowIndex);
    lTotRow.height = 26;

    // Sum of Loaded Qty
    const lTotQtyCell = ws2.getCell(`I${ledgerTotalRowIndex}`);
    lTotQtyCell.value = { formula: `SUM(I${ledgerStartRow}:I${ledgerEndRow})`, result: totalDispatchedQty };
    lTotQtyCell.numFmt = '#,##0.000 "MT"';
    lTotQtyCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lTotQtyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    lTotQtyCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Blank rate
    const lBlankRate = ws2.getCell(`J${ledgerTotalRowIndex}`);
    lBlankRate.value = '-';
    lBlankRate.alignment = { vertical: 'middle', horizontal: 'center' };
    lBlankRate.font = { color: { argb: 'FFFFFFFF' } };
    lBlankRate.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };

    // Sum of Freight
    const totalGrossAllDispatches = relevantDispatches.reduce((acc, d) => {
      const q = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
      const r = Number(d.finalized_rate ?? d.freight_rate) || 0;
      return acc + (q * r);
    }, 0);

    const lTotFreightCell = ws2.getCell(`K${ledgerTotalRowIndex}`);
    lTotFreightCell.value = { formula: `SUM(K${ledgerStartRow}:K${ledgerEndRow})`, result: totalGrossAllDispatches };
    lTotFreightCell.numFmt = '"₹"#,##0.00';
    lTotFreightCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lTotFreightCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    lTotFreightCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Cumulative Total
    const lCumulCell = ws2.getCell(`L${ledgerTotalRowIndex}`);
    lCumulCell.value = `${totalDispatchedQty.toFixed(3)} MT`;
    lCumulCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lCumulCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    lCumulCell.alignment = { vertical: 'middle', horizontal: 'right' };

    // Final Remaining
    const lRemCell = ws2.getCell(`M${ledgerTotalRowIndex}`);
    lRemCell.value = `${remainingBalanceQty.toFixed(3)} MT`;
    lRemCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    lRemCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    lRemCell.alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 13; c++) {
      ws2.getRow(ledgerTotalRowIndex).getCell(c).border = {
        top: { style: 'medium', color: { argb: 'FF064E3B' } },
        bottom: { style: 'double', color: { argb: 'FF064E3B' } }
      };
    }

    // 6. Sign-off Blocks on Sheet 2
    ws2.addRow([]);
    ws2.addRow([]);
    const signRow2 = ws2.rowCount + 1;
    ws2.mergeCells(`B${signRow2}:E${signRow2}`);
    const sign1 = ws2.getCell(`B${signRow2}`);
    sign1.value = '____________________________________\nPlant Logistics & Weighbridge Incharge';
    sign1.font = { name: 'Arial', size: 9, bold: true };
    sign1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    ws2.mergeCells(`I${signRow2}:L${signRow2}`);
    const sign2 = ws2.getCell(`I${signRow2}`);
    sign2.value = '____________________________________\nAuthorized Transporter Signatory';
    sign2.font = { name: 'Arial', size: 9, bold: true };
    sign2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    ws2.getRow(signRow2).height = 36;

    // Generate real Excel binary buffer
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const cleanReqNo = String(reqNoStr).replace(/[\/\\]/g, '_');
    const filename = `Comparative_Statement_and_Lifting_Audit_${cleanReqNo}.xlsx`;

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

// Helper to convert 1-based column number to Excel column letter (1 -> A, 27 -> AA)
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
