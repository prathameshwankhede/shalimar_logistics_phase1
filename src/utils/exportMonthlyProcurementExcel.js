// src/utils/exportMonthlyProcurementExcel.js
// 🌟 High-Definition Executive Excel (.xlsx) Generator for Monthly / Period Transport Procurement & Dispatch Statement

export async function exportMonthlyProcurementExcel({
  requirements = [],
  dispatches = [],
  transporters = [],
  company = {},
  reportPeriodLabel = 'MONTHLY TRANSPORT PROCUREMENT & DISPATCH MIS'
}) {
  try {
    const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;

    const wb = new ExcelJS.Workbook();
    wb.creator = company?.name || 'Shalimar Nutrients Pvt Ltd';
    wb.lastModifiedBy = 'TransFlow Logistics ERP';
    wb.created = new Date();

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Aggregate core metrics
    let totalIndentVolumeMT = 0;
    let totalDispatchedVolumeMT = 0;
    let totalFreightSpendRs = 0;
    let totalNegotiationSavingsRs = 0;
    let totalCargoItemsCount = 0;

    // Flatten all requirement items
    const allRequirementItems = [];
    requirements.forEach((req) => {
      const items = req.items && Array.isArray(req.items) && req.items.length > 0
        ? req.items
        : [{
            id: req.id || 'item_1',
            pickup_location: req.pickup_location || req.origin_city || req.route_origin || 'Nagpur Plant',
            delivery_location: req.drop_location || req.dest_city || req.route_destination || 'Solapur Refinery',
            product_name: req.material_type || req.cargo_type || req.product_name || 'Refined Edible Oil (Bulk)',
            quantity_mt: req.quantity_mt || req.total_quantity_mt || req.qty || 0,
            target_rate: req.target_rate || 0,
            finalized_rate: req.finalized_rate || req.winning_rate || null,
            allocated_transporter_id: req.allocated_transporter_id || req.winning_transporter_id || null,
            allocated_transporter_name: req.allocated_transporter_name || null,
            sub_indent_no: `${req.req_no || req.id}/01`
          }];

      items.forEach((item, idx) => {
        totalCargoItemsCount += 1;
        const itemQty = Number(item.quantity_mt || item.required_qty || 0);
        totalIndentVolumeMT += itemQty;

        // Calculate dispatches for this item
        const itemDispatches = dispatches.filter((d) => {
          if (!d) return false;
          const matchSubIndent = d.sub_indent_no && item.sub_indent_no && String(d.sub_indent_no) === String(item.sub_indent_no);
          const matchItemId = d.requirement_item_id && String(d.requirement_item_id) === String(item.id);
          const matchReqId = !d.requirement_item_id && String(d.requirement_id) === String(req.id);
          return matchSubIndent || matchItemId || matchReqId;
        });

        const itemDispatchedQty = itemDispatches.reduce(
          (acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0),
          0
        );
        const itemRemainingQty = Math.max(0, itemQty - itemDispatchedQty);

        const finRate = Number(item.finalized_rate || item.winning_rate || req.finalized_rate || 0);
        const itemSpend = itemDispatchedQty > 0 && finRate > 0 ? itemDispatchedQty * finRate : (itemQty * finRate);
        if (finRate > 0) {
          totalFreightSpendRs += itemSpend;
        }

        const baseL1 = Number(item.base_l1_rate || item.target_rate || 0);
        if (baseL1 > finRate && finRate > 0) {
          totalNegotiationSavingsRs += (baseL1 - finRate) * itemQty;
        }

        allRequirementItems.push({
          req,
          item,
          itemIndex: idx + 1,
          reqNo: req.req_no || req.request_no || req.id || 'REQ',
          itemQty,
          itemDispatchedQty,
          itemRemainingQty,
          finRate,
          itemSpend,
          dispatchesCount: itemDispatches.length,
          status: (itemQty > 0 && itemDispatchedQty >= itemQty) || item.dispatch_status === 'FULLY_DISPATCHED'
            ? 'COMPLETED (100%)'
            : (itemDispatchedQty > 0 ? 'PARTIALLY LIFTED' : (finRate > 0 ? 'AWARDED & OPEN' : 'OPEN FOR BIDS'))
        });
      });
    });

    totalDispatchedVolumeMT = dispatches.reduce(
      (acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0),
      0
    );
    const totalRemainingVolumeMT = Math.max(0, totalIndentVolumeMT - totalDispatchedVolumeMT);
    const overallLiftingPercent = totalIndentVolumeMT > 0 ? (totalDispatchedVolumeMT / totalIndentVolumeMT) * 100 : 0;

    // =========================================================================
    // 📑 SHEET 1: EXECUTIVE DASHBOARD & SUMMARY
    // =========================================================================
    const ws1 = wb.addWorksheet('Executive Summary', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF064E3B' } }
    });

    // Header Banner
    ws1.mergeCells('A1:H1');
    const title1 = ws1.getCell('A1');
    title1.value = company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.';
    title1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    title1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(1).height = 36;

    ws1.mergeCells('A2:H2');
    const sub1 = ws1.getCell('A2');
    sub1.value = `${reportPeriodLabel} — Generated on ${formattedDate} at ${formattedTime}`;
    sub1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF6EE7B7' } };
    sub1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    sub1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(2).height = 24;

    ws1.mergeCells('A3:H3');
    const meta1 = ws1.getCell('A3');
    meta1.value = `${company?.reg_office || 'MIDC Industrial Area, Nagpur, Maharashtra - 440028'} | GSTIN: ${company?.gstin || '27AAPCS1419M1ZV'} | 256-Bit SSL Encrypted Logistics System`;
    meta1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFE2E8F0' } };
    meta1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
    meta1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(3).height = 20;

    ws1.addRow([]); // Spacer Row 4

    // KPI Summary Section Header
    ws1.mergeCells('A5:H5');
    const kpiHeader = ws1.getCell('A5');
    kpiHeader.value = '📌 PROCUREMENT & DISPATCH OPERATIONAL SCORECARD';
    kpiHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    kpiHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    kpiHeader.alignment = { vertical: 'middle', indent: 1 };
    ws1.getRow(5).height = 24;

    // KPI Cards Matrix (Rows 6-10)
    const kpis = [
      { col1: 'A', col2: 'B', label: 'Total Indent Requisitions', value: requirements.length, unit: 'Indents' },
      { col1: 'C', col2: 'D', label: 'Total Cargo Route Items', value: totalCargoItemsCount, unit: 'Items' },
      { col1: 'E', col2: 'F', label: 'Total Indent Volume', value: totalIndentVolumeMT, unit: 'MT', format: '#,##0.00 "MT"' },
      { col1: 'G', col2: 'H', label: 'Total Dispatched Volume', value: totalDispatchedVolumeMT, unit: 'MT', format: '#,##0.00 "MT"' },
    ];

    const kpisRow2 = [
      { col1: 'A', col2: 'B', label: 'Total Truck Dispatches', value: dispatches.length, unit: 'Trucks Loaded' },
      { col1: 'C', col2: 'D', label: 'Overall Lifting Fulfillment', value: `${overallLiftingPercent.toFixed(1)}%`, unit: `${totalDispatchedVolumeMT.toFixed(1)} / ${totalIndentVolumeMT.toFixed(1)} MT` },
      { col1: 'E', col2: 'F', label: 'Total Freight Billing Value', value: totalFreightSpendRs, unit: '₹ INR Total', format: '₹#,##0.00' },
      { col1: 'G', col2: 'H', label: 'Total Negotiation Savings', value: totalNegotiationSavingsRs, unit: '₹ Net Saved vs L1', format: '₹#,##0.00' },
    ];

    // Render Row 1 Cards
    kpis.forEach(card => {
      ws1.mergeCells(`${card.col1}6:${card.col2}6`);
      const cellTitle = ws1.getCell(`${card.col1}6`);
      cellTitle.value = card.label;
      cellTitle.font = { name: 'Arial', size: 8.5, color: { argb: 'FF475569' }, bold: true };
      cellTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellTitle.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(`${card.col1}7:${card.col2}7`);
      const cellVal = ws1.getCell(`${card.col1}7`);
      cellVal.value = card.value;
      if (card.format) cellVal.numFmt = card.format;
      cellVal.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF064E3B' } };
      cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellVal.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(`${card.col1}8:${card.col2}8`);
      const cellUnit = ws1.getCell(`${card.col1}8`);
      cellUnit.value = card.unit;
      cellUnit.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
      cellUnit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellUnit.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    ws1.addRow([]); // Spacer Row 9

    // Render Row 2 Cards (Rows 10-12)
    kpisRow2.forEach(card => {
      ws1.mergeCells(`${card.col1}10:${card.col2}10`);
      const cellTitle = ws1.getCell(`${card.col1}10`);
      cellTitle.value = card.label;
      cellTitle.font = { name: 'Arial', size: 8.5, color: { argb: 'FF475569' }, bold: true };
      cellTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellTitle.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(`${card.col1}11:${card.col2}11`);
      const cellVal = ws1.getCell(`${card.col1}11`);
      cellVal.value = card.value;
      if (card.format) cellVal.numFmt = card.format;
      cellVal.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0284C7' } };
      cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellVal.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(`${card.col1}12:${card.col2}12`);
      const cellUnit = ws1.getCell(`${card.col1}12`);
      cellUnit.value = card.unit;
      cellUnit.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
      cellUnit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellUnit.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    ws1.addRow([]); // Spacer Row 13
    ws1.addRow([]); // Spacer Row 14

    // Transporter Performance Table on Summary Sheet
    ws1.mergeCells('A15:H15');
    const tpHead = ws1.getCell('A15');
    tpHead.value = '🏆 TRANSPORTER ALLOCATION & LIFTING PERFORMANCE MATRIX';
    tpHead.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    tpHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    tpHead.alignment = { vertical: 'middle', indent: 1 };
    ws1.getRow(15).height = 24;

    const summaryTableHeader = [
      '#', 'Transporter Name', 'Vendor Code', 'Allocated Routes',
      'Allocated Qty (MT)', 'Dispatched Qty (MT)', 'Balance Pending (MT)', 'Fulfillment %'
    ];
    const sThRow = ws1.addRow(summaryTableHeader);
    sThRow.height = 22;
    sThRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    sThRow.alignment = { vertical: 'middle', horizontal: 'center' };
    sThRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }
      };
    });

    // Populate Transporter Summary Rows
    transporters.forEach((t, idx) => {
      const tDispatches = dispatches.filter(d => d.transporter_id === t.id || d.transporter_code === t.code || d.transporter_name === t.company_name);
      const tDispatchedQty = tDispatches.reduce((acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0), 0);

      const tAllocatedItems = allRequirementItems.filter(r => r.item.allocated_transporter_id === t.id || r.item.allocated_transporter_name === t.company_name);
      const tAllocatedQty = tAllocatedItems.reduce((acc, r) => acc + r.itemQty, 0);
      const tPendingQty = Math.max(0, tAllocatedQty - tDispatchedQty);
      const tFulfill = tAllocatedQty > 0 ? (tDispatchedQty / tAllocatedQty) * 100 : 0;

      const row = ws1.addRow([
        idx + 1,
        t.company_name || 'Transporter',
        t.code || t.username || 'VENDOR',
        tAllocatedItems.length,
        tAllocatedQty,
        tDispatchedQty,
        tPendingQty,
        `${tFulfill.toFixed(1)}%`
      ]);
      row.height = 20;
      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).font = { bold: true, color: { argb: tFulfill >= 100 ? 'FF047857' : 'FF0284C7' } };

      const isEven = idx % 2 === 0;
      row.eachCell((cell) => {
        if (!cell.fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    ws1.columns = [
      { width: 6 },
      { width: 30 },
      { width: 16 },
      { width: 18 },
      { width: 20 },
      { width: 22 },
      { width: 22 },
      { width: 18 }
    ];

    // =========================================================================
    // 📑 SHEET 2: ALL REQUIREMENTS & INDENTS MASTER DIRECTORY
    // =========================================================================
    const ws2 = wb.addWorksheet('Requirements & Indents', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF0284C7' } }
    });

    // Sheet 2 Banner
    ws2.mergeCells('A1:M1');
    const ws2Title = ws2.getCell('A1');
    ws2Title.value = `${company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.'} — ALL TRANSPORT REQUIREMENTS & INDENTS DIRECTORY`;
    ws2Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    ws2Title.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 32;

    const reqHeaders = [
      '#', 'Indent No.', 'Sub-Indent / Item', 'Target Date', 'Pickup Origin', 'Drop Destination',
      'Product / Cargo', 'Indent Qty (MT)', 'Dispatched (MT)', 'Balance (MT)',
      'Finalized Rate (₹/MT)', 'Total Freight (₹)', 'Lifting Status'
    ];
    const reqHeaderRow = ws2.addRow(reqHeaders);
    reqHeaderRow.height = 24;
    reqHeaderRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    reqHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    reqHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF64748B' } },
        bottom: { style: 'thin', color: { argb: 'FF64748B' } }
      };
    });

    allRequirementItems.forEach((r, idx) => {
      const row = ws2.addRow([
        idx + 1,
        r.reqNo,
        r.item.sub_indent_no || `${r.reqNo}/0${r.itemIndex}`,
        r.req.target_date || r.req.delivery_target_date || formattedDate,
        r.item.pickup_location || r.req.pickup_location || 'Nagpur Plant',
        r.item.delivery_location || r.req.drop_location || 'Solapur Refinery',
        r.item.product_name || r.req.material_type || 'Cargo',
        r.itemQty,
        r.itemDispatchedQty,
        r.itemRemainingQty,
        r.finRate > 0 ? r.finRate : '-',
        r.itemSpend > 0 ? r.itemSpend : '-',
        r.status
      ]);
      row.height = 20;
      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      if (r.finRate > 0) row.getCell(11).numFmt = '₹#,##0.00';
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      if (r.itemSpend > 0) row.getCell(12).numFmt = '₹#,##0.00';
      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).font = { bold: true, color: { argb: r.status.includes('COMPLETED') ? 'FF047857' : (r.status.includes('LIFTED') ? 'FF0284C7' : 'FFD97706') } };

      const isEven = idx % 2 === 0;
      row.eachCell((cell) => {
        if (!cell.fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Total Row for Sheet 2
    const totalRow2 = ws2.addRow([
      '', 'TOTALS', '', '', '', '', '',
      totalIndentVolumeMT,
      totalDispatchedVolumeMT,
      totalRemainingVolumeMT,
      '',
      totalFreightSpendRs,
      `${overallLiftingPercent.toFixed(1)}% Overall`
    ]);
    totalRow2.height = 24;
    totalRow2.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow2.alignment = { vertical: 'middle' };
    totalRow2.getCell(2).alignment = { horizontal: 'center' };
    totalRow2.getCell(8).alignment = { horizontal: 'right' };
    totalRow2.getCell(8).numFmt = '#,##0.00';
    totalRow2.getCell(9).alignment = { horizontal: 'right' };
    totalRow2.getCell(9).numFmt = '#,##0.00';
    totalRow2.getCell(10).alignment = { horizontal: 'right' };
    totalRow2.getCell(10).numFmt = '#,##0.00';
    totalRow2.getCell(12).alignment = { horizontal: 'right' };
    totalRow2.getCell(12).numFmt = '₹#,##0.00';
    totalRow2.getCell(13).alignment = { horizontal: 'center' };
    totalRow2.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      cell.border = {
        top: { style: 'double', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } }
      };
    });

    ws2.columns = [
      { width: 6 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 22 },
      { width: 22 },
      { width: 24 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 20 },
      { width: 20 },
      { width: 20 }
    ];

    // =========================================================================
    // 📑 SHEET 3: CHRONOLOGICAL TRUCK DISPATCHES & LIFTING AUDIT LOG
    // =========================================================================
    const ws3 = wb.addWorksheet('Truck Dispatches Log', {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF059669' } }
    });

    ws3.mergeCells('A1:L1');
    const ws3Title = ws3.getCell('A1');
    ws3Title.value = `${company?.name || 'SHALIMAR NUTRIENTS PVT. LTD.'} — CHRONOLOGICAL TRUCK DISPATCH & LIFTING AUDIT LOG`;
    ws3Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    ws3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    ws3Title.alignment = { vertical: 'middle', horizontal: 'center' };
    ws3.getRow(1).height = 32;

    const dispatchHeaders = [
      '#', 'LR / Dispatch No.', 'Indent / Sub-Indent', 'Date & Time', 'Transporter Name',
      'Truck / Vehicle No.', 'Driver Name', 'Driver Mobile', 'Pickup Origin ➔ Drop Location',
      'Loaded Qty (MT)', 'Freight Rate (₹/MT)', 'Freight Total (₹)'
    ];
    const dispHeaderRow = ws3.addRow(dispatchHeaders);
    dispHeaderRow.height = 24;
    dispHeaderRow.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    dispHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
    dispHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF64748B' } },
        bottom: { style: 'thin', color: { argb: 'FF64748B' } }
      };
    });

    dispatches.forEach((d, idx) => {
      const loadedQty = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
      const rate = Number(d.finalized_rate || d.rate_per_unit || d.freight_rate || 0);
      const totalCost = loadedQty * rate;

      const dateStr = d.dispatched_at
        ? new Date(d.dispatched_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : (d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : formattedDate);

      const routeStr = `${d.pickup_location || 'Nagpur'} ➔ ${d.drop_location || 'Solapur'}`;

      const row = ws3.addRow([
        idx + 1,
        d.lr_number || d.dispatch_no || d.id || `DISP-${idx + 1}`,
        d.sub_indent_no || d.req_no || d.requirement_id || 'INDENT',
        dateStr,
        d.transporter_name || d.company_name || 'Transporter',
        d.truck_number || d.vehicle_number || d.vehicle_no || '-',
        d.driver_name || '-',
        d.driver_mobile || d.driver_phone || '-',
        routeStr,
        loadedQty,
        rate > 0 ? rate : '-',
        totalCost > 0 ? totalCost : '-'
      ]);

      row.height = 20;
      row.font = { name: 'Arial', size: 9 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      if (rate > 0) row.getCell(11).numFmt = '₹#,##0.00';
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      if (totalCost > 0) row.getCell(12).numFmt = '₹#,##0.00';

      const isEven = idx % 2 === 0;
      row.eachCell((cell) => {
        if (!cell.fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Sheet 3 Total Row
    const totalDispCost = dispatches.reduce((acc, d) => {
      const q = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
      const r = Number(d.finalized_rate || d.rate_per_unit || d.freight_rate || 0);
      return acc + (q * r);
    }, 0);

    const totalRow3 = ws3.addRow([
      '', 'TOTAL DISPATCHES', '', `${dispatches.length} Trucks`, '', '', '', '', '',
      totalDispatchedVolumeMT,
      '',
      totalDispCost
    ]);
    totalRow3.height = 24;
    totalRow3.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow3.alignment = { vertical: 'middle' };
    totalRow3.getCell(2).alignment = { horizontal: 'center' };
    totalRow3.getCell(4).alignment = { horizontal: 'center' };
    totalRow3.getCell(10).alignment = { horizontal: 'right' };
    totalRow3.getCell(10).numFmt = '#,##0.00';
    totalRow3.getCell(12).alignment = { horizontal: 'right' };
    totalRow3.getCell(12).numFmt = '₹#,##0.00';
    totalRow3.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      cell.border = {
        top: { style: 'double', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } }
      };
    });

    ws3.columns = [
      { width: 6 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
      { width: 28 },
      { width: 18 },
      { width: 20 },
      { width: 16 },
      { width: 34 },
      { width: 16 },
      { width: 20 },
      { width: 20 }
    ];

    // Export and trigger download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileDate = now.toISOString().slice(0, 10);
    a.download = `Shalimar_Monthly_Transport_Procurement_MIS_${fileDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, count: requirements.length };
  } catch (err) {
    console.error('Error generating Monthly Procurement Excel:', err);
    throw err;
  }
}
