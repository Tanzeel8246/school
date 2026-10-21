/**
 * Reports export layer — PDF, Excel, CSV.
 * Each function streams the file directly to the Express Response.
 * No audit needed for read-only report exports.
 */
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

// ── Shared helpers ─────────────────────────────────────────────────────────

/** Convert a camelCase or snake_case key into a human-readable header. */
function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/** Build a safe filename without spaces or special chars. */
function filename(reportType: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `${reportType}-report-${d}`;
}

/** Extract ordered column keys from the first data row. Returns [] for empty data. */
function getKeys(data: unknown[]): string[] {
  if (!data.length) return [];
  return Object.keys(data[0] as Record<string, unknown>);
}

/** Safely stringify a cell value for CSV. */
function csvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  // Wrap in quotes if value contains comma, double-quote, or newline.
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── CSV ────────────────────────────────────────────────────────────────────

/**
 * Stream a CSV file to the response.
 * Pure implementation — no external dependencies beyond Node builtins.
 */
export async function exportCsv(
  res: Response,
  reportType: string,
  data: unknown[],
  _summary: unknown,
  _title: string,
): Promise<void> {
  const fn   = filename(reportType);
  const keys = getKeys(data);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fn}.csv"`);

  // Header row
  res.write(keys.map(humanize).map(csvCell).join(',') + '\r\n');

  // Data rows
  for (const row of data) {
    const r = row as Record<string, unknown>;
    res.write(keys.map((k) => csvCell(r[k])).join(',') + '\r\n');
  }

  res.end();
}

// ── Excel (ExcelJS) ────────────────────────────────────────────────────────

/**
 * Stream an XLSX workbook with two sheets:
 *   1. Data sheet — bold header row + data rows
 *   2. Summary sheet — key/value pairs
 */
export async function exportExcel(
  res: Response,
  reportType: string,
  data: unknown[],
  summary: unknown,
  title: string,
): Promise<void> {
  const fn = filename(reportType);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fn}.xlsx"`);

  const wb    = new ExcelJS.Workbook();
  wb.creator  = 'EduCore ERP';
  wb.created  = new Date();

  // ── Data sheet ─────────────────────────────────────────────────────────
  const dataSheet = wb.addWorksheet(reportType, {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

  const keys = getKeys(data);

  if (keys.length) {
    // Header row — bold
    const headerRow = dataSheet.addRow(keys.map(humanize));
    headerRow.font  = { bold: true };
    headerRow.fill  = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Data rows
    for (const row of data) {
      const r = row as Record<string, unknown>;
      dataSheet.addRow(keys.map((k) => r[k] ?? ''));
    }

    // Auto-fit columns (approximate — ExcelJS doesn't compute pixel width).
    dataSheet.columns.forEach((col, i) => {
      const header = humanize(keys[i] ?? '');
      let maxLen   = header.length;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 40);
    });
  } else {
    dataSheet.addRow(['No data available']);
  }

  // ── Summary sheet ──────────────────────────────────────────────────────
  const summarySheet  = wb.addWorksheet('Summary');
  // ExcelJS addRow() returns Row; .font must be set via the row reference,
  // not chained directly off addRow() to satisfy strict TypeScript.
  const titleRow      = summarySheet.addRow([title]);
  titleRow.font       = { bold: true, size: 14 };
  summarySheet.addRow([]);

  const headerRow2 = summarySheet.addRow(['Metric', 'Value']);
  headerRow2.font  = { bold: true };

  if (summary && typeof summary === 'object') {
    for (const [key, val] of Object.entries(summary as Record<string, unknown>)) {
      summarySheet.addRow([humanize(key), val ?? '']);
    }
  }
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;

  await wb.xlsx.write(res);
  res.end();
}

// ── PDF (PDFKit) ────────────────────────────────────────────────────────────

/**
 * Stream a landscape A4 PDF report:
 *   - Title + date stamp at top
 *   - Summary KPI box
 *   - Data table with auto-sized columns
 */
export async function exportPdf(
  res: Response,
  reportType: string,
  data: unknown[],
  summary: unknown,
  title: string,
): Promise<void> {
  const fn = filename(reportType);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fn}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  const pageW    = doc.page.width  - 80; // usable width after margins
  const dateStr  = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Title ──────────────────────────────────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').text(title, 40, 40);
  doc.fontSize(10).font('Helvetica').text(`Generated: ${dateStr}`, 40, doc.y + 2);
  doc.moveDown(0.8);

  // ── Summary KPIs ───────────────────────────────────────────────────────
  if (summary && typeof summary === 'object') {
    const entries = Object.entries(summary as Record<string, unknown>);
    if (entries.length) {
      doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline: true });
      doc.moveDown(0.3);
      const colW     = pageW / Math.min(entries.length, 4);
      const startX   = 40;
      const startY   = doc.y;
      let colIdx     = 0;
      for (const [key, val] of entries) {
        const x = startX + (colIdx % 4) * colW;
        const y = startY + Math.floor(colIdx / 4) * 36;
        doc.fontSize(9).font('Helvetica').text(humanize(key), x, y, { width: colW - 8 });
        doc.fontSize(12).font('Helvetica-Bold').text(String(val ?? ''), x, y + 12, { width: colW - 8 });
        colIdx++;
      }
      // Move cursor below summary block.
      const rows = Math.ceil(entries.length / 4);
      doc.y = startY + rows * 36 + 8;
      doc.moveDown(0.5);
    }
  }

  // ── Data table ─────────────────────────────────────────────────────────
  const keys = getKeys(data);
  if (!keys.length) {
    doc.fontSize(10).font('Helvetica').text('No data available.');
    doc.end();
    return;
  }

  const colCount = keys.length;
  const colW     = pageW / colCount;
  const rowH     = 16;
  const fontSize = Math.max(6, Math.min(9, Math.floor(colW / 8)));

  // Helper to draw a single table row.
  function drawRow(values: string[], y: number, bold: boolean, shade: boolean) {
    if (shade) {
      doc.rect(40, y, pageW, rowH).fill('#F0F0F0').fillColor('black');
    }
    doc.fontSize(fontSize).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    values.forEach((v, i) => {
      doc.text(v, 40 + i * colW + 2, y + 3, {
        width: colW - 4,
        height: rowH - 3,
        ellipsis: true,
        lineBreak: false,
      });
    });
    // Bottom border
    doc.moveTo(40, y + rowH).lineTo(40 + pageW, y + rowH).stroke('#CCCCCC');
  }

  let tableY = doc.y;

  // Header row
  drawRow(keys.map(humanize), tableY, true, true);
  tableY += rowH;

  for (let i = 0; i < data.length; i++) {
    // Add a new page if we're near the bottom.
    if (tableY + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      tableY = doc.page.margins.top;
      // Re-draw header on new page
      drawRow(keys.map(humanize), tableY, true, true);
      tableY += rowH;
    }
    const r      = data[i] as Record<string, unknown>;
    const values = keys.map((k) => {
      const v = r[k];
      return v === null || v === undefined ? '' : String(v);
    });
    drawRow(values, tableY, false, i % 2 === 1);
    tableY += rowH;
  }

  doc.end();
}
