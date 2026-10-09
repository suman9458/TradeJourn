import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const getTradeProfitUSD = (p) => {
  if (!p) return 0;

  let rawTp = (p.takeProfit !== undefined && p.takeProfit !== null && p.takeProfit !== '')
    ? p.takeProfit
    : (p.takeProfitUSD !== undefined && p.takeProfitUSD !== null && p.takeProfitUSD !== '' ? p.takeProfitUSD : null);

  if (rawTp === null || Number(rawTp) === 0) {
    try {
      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
      if (p._id && overrides[p._id] !== undefined) {
        rawTp = overrides[p._id];
      } else if (p.tradeName && p.date) {
        const sig = `${p.tradeName}_${p.date}_${p.time || '00:00'}`;
        if (overrides[sig] !== undefined) {
          rawTp = overrides[sig];
        }
      } else if (p.date) {
        const dateKey = `${p.date}_${p.time || '00:00'}`;
        if (overrides[dateKey] !== undefined) {
          rawTp = overrides[dateKey];
        }
      }
    } catch (e) {}
  }

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (p.result === 'WIN') return Math.abs(tp);
      if (p.result === 'LOSS') return tp < 0 ? tp : -tp;
      if (p.result === 'BE') return 0;
      return tp;
    }
  }

  const pips = Number(p.pips || 0);
  if (pips !== 0) {
    if (p.result === 'LOSS' && pips > 0) return -pips;
    if (p.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (p.result === 'BE') return 0;
    return pips;
  }

  const rResult = Number(p.rResult !== undefined ? p.rResult : (p.result === 'WIN' ? (p.rr || 1.5) : p.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

const formatUSD = (val) => {
  const num = Number(val || 0);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generates and downloads a clean, professional institutional PDF
 * of the user's trade history with complete summary cards and table rows.
 */
export const exportTradeHistoryPDF = ({ trades = [], user = {}, stats = null, options = {} }) => {
  const {
    selectedColumns = null,
    includeSummary = true,
    timeframe = 'ALL'
  } = options || {};

  // Filter trades by timeframe if specified
  let filteredTrades = Array.isArray(trades) ? [...trades] : [];
  if (timeframe !== 'ALL') {
    const now = Date.now();
    let cutoff = 0;
    if (timeframe === '7D') cutoff = now - 7 * 86400000;
    else if (timeframe === '30D') cutoff = now - 30 * 86400000;
    else if (timeframe === '90D') cutoff = now - 90 * 86400000;

    filteredTrades = trades.filter(t => {
      if (!t?.date) return false;
      const ts = new Date(t.date).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
  }

  // A4 Landscape format (width: 841.89pt, height: 595.28pt)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const traderName = user?.name || user?.userId || 'Trader';
  const traderId = user?.userId || '';
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. TOP HEADER BANNER
  doc.setFillColor(8, 15, 24); // #080f18
  doc.rect(0, 0, pageWidth, 62, 'F');

  // Accent Line under header (brand green)
  doc.setFillColor(0, 245, 155); // #00f59b
  doc.rect(0, 62, pageWidth, 2.5, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('TradeJourn', 28, 34);

  // Brand Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text('INSTITUTIONAL TRADE HISTORY LEDGER & AUDIT REPORT', 28, 48);

  // Right Header: Trader Name & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(traderName + (traderId ? ` (${traderId})` : ''), pageWidth - 28, 32, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Exported: ${dateFormatted}`, pageWidth - 28, 46, { align: 'right' });

  // 2. METRICS SUMMARY BAR (Optional)
  let tableStartY = 74;

  if (includeSummary) {
    tableStartY = 118;
    const totalTrades = filteredTrades.length;
    const winCount = filteredTrades.filter(t => t.result === 'WIN').length;
    const lossCount = filteredTrades.filter(t => t.result === 'LOSS').length;
    const beCount = filteredTrades.filter(t => t.result === 'BE').length;
    const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : '0.0';

    let totalPips = 0;
    let totalProfitUSD = 0;
    let totalR = 0;

    filteredTrades.forEach(t => {
      let pips = Number(t.pips || 0);
      if (t.result === 'LOSS' && pips > 0) pips = -pips;
      else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
      else if (t.result === 'BE') pips = 0;
      totalPips += pips;

      totalProfitUSD += getTradeProfitUSD(t);
      totalR += Number(t.rResult !== undefined ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
    });

    const summaryY = 74;
    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.roundedRect(28, summaryY, pageWidth - 56, 34, 4, 4, 'FD');

    const statItems = [
      { label: 'TOTAL TRADES', val: `${totalTrades}` },
      { label: 'WIN RATE', val: `${winRate}%` },
      { label: 'RECORD (W/L/BE)', val: `${winCount}W / ${lossCount}L / ${beCount}BE` },
      { label: 'TOTAL PIPS', val: `${totalPips >= 0 ? '+' : ''}${totalPips.toFixed(1)}` },
      { label: 'NET PROFIT ($)', val: formatUSD(totalProfitUSD) },
      { label: 'NET R-MULTIPLE', val: `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R` }
    ];

    const colWidth = (pageWidth - 56) / statItems.length;
    statItems.forEach((item, idx) => {
      const itemX = 28 + idx * colWidth + colWidth / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, itemX, summaryY + 13, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (item.label.includes('PIPS') || item.label.includes('PROFIT') || item.label.includes('R-MULTIPLE')) {
        doc.setTextColor(item.val.startsWith('+') ? 16 : item.val.startsWith('-') ? 220 : 15, item.val.startsWith('+') ? 149 : item.val.startsWith('-') ? 38 : 23, item.val.startsWith('+') ? 93 : item.val.startsWith('-') ? 38 : 42);
      } else if (item.label === 'WIN RATE') {
        doc.setTextColor(parseFloat(winRate) >= 50 ? 16 : 71, parseFloat(winRate) >= 50 ? 149 : 85, parseFloat(winRate) >= 50 ? 93 : 105);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(item.val, itemX, summaryY + 27, { align: 'center' });
    });
  }

  // 3. TABLE COLUMNS AND ROWS DYNAMIC DEFINITION
  const ALL_POSSIBLE_COLUMNS = [
    { id: 'index', header: '#', dataKey: 'index', style: { halign: 'center', cellWidth: 22, textColor: [100, 116, 139] } },
    { id: 'dateTime', header: 'Date & Time', dataKey: 'dateTime', style: { cellWidth: 72 } },
    { id: 'instrument', header: 'Ticker', dataKey: 'instrument', style: { fontStyle: 'bold', cellWidth: 52 } },
    { id: 'tradeName', header: 'Trade Identifier / Setup', dataKey: 'tradeName', style: { cellWidth: 95 } },
    { id: 'session', header: 'Session', dataKey: 'session', style: { cellWidth: 48 } },
    { id: 'bias', header: 'Bias', dataKey: 'bias', style: { cellWidth: 42 } },
    { id: 'result', header: 'Outcome', dataKey: 'result', style: { halign: 'center', cellWidth: 44, fontStyle: 'bold' } },
    { id: 'rr', header: 'Net R', dataKey: 'rr', style: { halign: 'right', cellWidth: 42 } },
    { id: 'pips', header: 'Pips', dataKey: 'pips', style: { halign: 'right', cellWidth: 42 } },
    { id: 'pnl', header: 'P&L ($)', dataKey: 'pnl', style: { halign: 'right', cellWidth: 62, fontStyle: 'bold' } },
    { id: 'grade', header: 'Grade', dataKey: 'grade', style: { halign: 'center', cellWidth: 40 } },
    { id: 'emotion', header: 'Emotion', dataKey: 'emotion', style: { cellWidth: 50 } },
    { id: 'notes', header: 'Mistakes / Review Notes', dataKey: 'notes', style: { cellWidth: 'auto' } }
  ];

  const activeColumnsDef = (selectedColumns && selectedColumns.length > 0)
    ? [
        ALL_POSSIBLE_COLUMNS[0], // Always include # index column
        ...ALL_POSSIBLE_COLUMNS.filter(c => c.id !== 'index' && selectedColumns.includes(c.id))
      ]
    : ALL_POSSIBLE_COLUMNS;

  const tableColumns = activeColumnsDef.map(c => ({ header: c.header, dataKey: c.dataKey }));

  const columnStyles = {};
  activeColumnsDef.forEach(c => {
    columnStyles[c.dataKey] = c.style;
  });

  const tableRows = filteredTrades.map((t, i) => {
    const dateStr = t.date ? `${t.date} ${t.time || ''}`.trim() : '-';
    const mistakesStr = Array.isArray(t.mistakes) && t.mistakes.length > 0 && !t.mistakes.includes('None')
      ? `[${t.mistakes.join(', ')}] `
      : '';
    const notesStr = `${mistakesStr}${t.notes || ''}`.trim() || '-';

    let rawPips = Number(t.pips || 0);
    if (t.result === 'LOSS' && rawPips > 0) rawPips = -rawPips;
    else if (t.result === 'WIN' && rawPips < 0) rawPips = Math.abs(rawPips);
    else if (t.result === 'BE') rawPips = 0;

    const profitVal = getTradeProfitUSD(t);

    const rResult = Number(t.rResult !== undefined ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));

    return {
      index: String(i + 1),
      dateTime: dateStr,
      instrument: t.instrument || 'EURUSD',
      tradeName: t.tradeName || 'Trade',
      session: t.session || '-',
      bias: t.bias || 'Bullish',
      result: t.result || 'WIN',
      rr: `${rResult >= 0 ? '+' : ''}${rResult.toFixed(2)}R`,
      pips: `${rawPips >= 0 ? '+' : ''}${rawPips.toFixed(1)}`,
      pnl: formatUSD(profitVal),
      grade: t.setupRating || t.tradeGrade || '-',
      emotion: t.emotion || 'Calm',
      notes: notesStr
    };
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 28, right: 28, bottom: 35 },
    columns: tableColumns,
    body: tableRows.length > 0 ? tableRows : [
      {
        index: '-',
        dateTime: '-',
        instrument: '-',
        tradeName: 'No trades recorded in ledger yet. Add trades using "+ Quick Add Trade".',
        session: '-',
        bias: '-',
        result: '-',
        rr: '-',
        pips: '-',
        pnl: '-',
        grade: '-',
        emotion: '-',
        notes: '-'
      }
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 4.5,
      lineColor: [226, 232, 240], // #e2e8f0
      lineWidth: 0.5,
      textColor: [30, 41, 59], // #1e293b
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42], // #0f172a
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 6
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // #f8fafc
    },
    columnStyles: columnStyles,
    didParseCell: (data) => {
      // Highlight Result column
      if (data.section === 'body' && data.column.dataKey === 'result') {
        const val = data.cell.raw;
        if (val === 'WIN') {
          data.cell.styles.textColor = [16, 149, 93]; // green
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'LOSS') {
          data.cell.styles.textColor = [220, 38, 38]; // red
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'BE') {
          data.cell.styles.textColor = [100, 116, 139]; // grey
        }
      }
      // Highlight Pips column
      if (data.section === 'body' && data.column.dataKey === 'pips') {
        const raw = String(data.cell.raw);
        if (raw.startsWith('+')) {
          data.cell.styles.textColor = [16, 149, 93];
        } else if (raw.startsWith('-')) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
      // Highlight P&L ($) column
      if (data.section === 'body' && data.column.dataKey === 'pnl') {
        const raw = String(data.cell.raw);
        if (raw.startsWith('+')) {
          data.cell.styles.textColor = [16, 149, 93];
        } else if (raw.startsWith('-')) {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
    didDrawPage: (data) => {
      // Page Footer
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Footer top border line
      doc.setDrawColor(226, 232, 240);
      doc.line(28, pageHeight - 24, pageWidth - 28, pageHeight - 24);

      doc.text('TradeJourn Trading Command Center • Verified Trade History Ledger', 28, pageHeight - 12);
      doc.text(str, pageWidth - 28, pageHeight - 12, { align: 'right' });
    }
  });

  // Save the PDF file
  const sanitizedName = (traderName || 'Trader').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = now.toISOString().slice(0, 10);
  doc.save(`TradeJourn_History_${sanitizedName}_${dateStamp}.pdf`);
};
