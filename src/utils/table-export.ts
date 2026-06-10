import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type ExportAlign = 'left' | 'right' | 'center'

export type TableExportOptions = {
  subtitle?: string
  /** Excel column headers treated as numeric (amounts, totals, etc.) */
  numericColumns?: string[]
  /** PDF column index → alignment */
  columnAlign?: Record<number, ExportAlign>
}

const PDF_HEAD_FILL: [number, number, number] = [72, 140, 100]
const PDF_ALT_ROW: [number, number, number] = [248, 250, 248]
const PDF_MARGIN = 36
const NUMERIC_HEADER_RE =
  /^(montant|mt[\s._]|total|commission|solde|mnt|amount|prix|capital|impay|rembours|encours|taux|nombre)/i

function datedFilename(base: string): string {
  const d = new Date().toISOString().slice(0, 10)
  return `${base}_${d}`
}

function exportTimestamp(): string {
  return new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sheetRange(ws: XLSX.WorkSheet): XLSX.Range | null {
  const ref = ws['!ref']
  if (!ref) return null
  return XLSX.utils.decode_range(ref)
}

export function parseFrenchNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === null || value === undefined || value === '') return null
  const raw = String(value).trim()
  if (!raw || raw === '—' || raw === '-') return null
  const normalized = raw.replace(/\u00a0/g, '').replace(/\s/g, '').replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function isNumericHeader(header: string, explicit?: Set<string>): boolean {
  if (explicit?.has(header)) return true
  return NUMERIC_HEADER_RE.test(header.trim())
}

function applyXlsxFormatting(
  ws: XLSX.WorkSheet,
  headers: string[],
  numericColumnKeys?: Set<string>,
): void {
  const range = sheetRange(ws)
  if (!range) return

  const headerRow = range.s.r
  const colCount = range.e.c - range.s.c + 1
  const colWidths = headers.map((h) => Math.min(44, Math.max(h.length + 2, 10)))

  const numericColIndices = new Set<number>()
  headers.forEach((key, idx) => {
    if (isNumericHeader(key, numericColumnKeys)) numericColIndices.add(idx)
  })

  for (let R = headerRow; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const colIdx = C - range.s.c
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (!cell) continue

      const text = String(cell.v ?? '')
      colWidths[colIdx] = Math.max(colWidths[colIdx] ?? 10, Math.min(44, text.length + 2))

      if (R === headerRow) continue

      if (typeof cell.v === 'number') {
        cell.t = 'n'
        cell.z = Number.isInteger(cell.v) ? '#,##0' : '#,##0.00'
        continue
      }

      if (!numericColIndices.has(colIdx)) continue

      const num = parseFrenchNumber(cell.v)
      if (num === null) continue

      cell.t = 'n'
      cell.v = num
      cell.z = Number.isInteger(num) ? '#,##0' : '#,##0.00'
    }
  }

  ws['!cols'] = colWidths.slice(0, colCount).map((wch) => ({ wch }))

  const endCol = XLSX.utils.encode_col(range.e.c)
  const endRow = XLSX.utils.encode_row(range.e.r)
  ws['!autofilter'] = { ref: `A${headerRow + 1}:${endCol}${endRow + 1}` }

  ws['!views'] = [
    {
      state: 'frozen',
      ySplit: 1,
      xSplit: 0,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
    },
  ]
}

function detectPdfNumericColumns(
  headers: string[],
  body: (string | number)[][],
): Record<number, ExportAlign> {
  const styles: Record<number, ExportAlign> = {}

  headers.forEach((h, i) => {
    if (isNumericHeader(h)) styles[i] = 'right'
  })

  if (!body.length) return styles

  headers.forEach((_, colIdx) => {
    if (styles[colIdx]) return
    let numericCount = 0
    let nonEmpty = 0
    for (const row of body) {
      const v = row[colIdx]
      if (v === '' || v === '—' || v === '-') continue
      nonEmpty += 1
      if (typeof v === 'number' || parseFrenchNumber(v) !== null) numericCount += 1
    }
    if (nonEmpty > 0 && numericCount === nonEmpty) styles[colIdx] = 'right'
  })

  return styles
}

function buildPdfColumnStyles(
  headers: string[],
  body: (string | number)[][],
  columnAlign?: Record<number, ExportAlign>,
): Record<number, { halign: ExportAlign }> {
  const detected = detectPdfNumericColumns(headers, body)
  const merged: Record<number, ExportAlign> = { ...detected, ...columnAlign }
  const out: Record<number, { halign: ExportAlign }> = {}
  for (const [k, v] of Object.entries(merged)) {
    out[Number(k)] = { halign: v }
  }
  return out
}

export function exportJsonToXlsx(
  filenameBase: string,
  sheetName: string,
  data: Record<string, string | number>[],
  options?: Pick<TableExportOptions, 'numericColumns'>,
): void {
  if (!data.length) return
  const ws = XLSX.utils.json_to_sheet(data)
  const headers = Object.keys(data[0] ?? {})
  const numericSet = options?.numericColumns ? new Set(options.numericColumns) : undefined
  applyXlsxFormatting(ws, headers, numericSet)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, `${datedFilename(filenameBase)}.xlsx`)
}

export function exportTableToPdf(
  title: string,
  filenameBase: string,
  headers: string[],
  body: (string | number)[][],
  options?: Pick<TableExportOptions, 'subtitle' | 'columnAlign'>,
): void {
  if (!body.length) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, PDF_MARGIN, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  const meta = options?.subtitle
    ? `${options.subtitle} · ${body.length} ligne(s) · ${exportTimestamp()}`
    : `${body.length} ligne(s) · Export du ${exportTimestamp()}`
  doc.text(meta, PDF_MARGIN, 46)
  doc.setTextColor(0)

  const columnStyles = buildPdfColumnStyles(headers, body, options?.columnAlign)

  autoTable(doc, {
    startY: 54,
    head: [headers],
    body: body.map((row) =>
      row.map((cell) => (cell === null || cell === undefined || cell === '' ? '—' : String(cell))),
    ),
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [210, 210, 210],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: PDF_HEAD_FILL,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: PDF_ALT_ROW },
    columnStyles,
    margin: { top: 54, left: PDF_MARGIN, right: PDF_MARGIN, bottom: 36 },
    tableWidth: 'auto',
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - PDF_MARGIN,
        pageHeight - 18,
        { align: 'right' },
      )
      doc.setTextColor(0)
    },
  })

  doc.save(`${datedFilename(filenameBase)}.pdf`)
}

export function exportMultiSheetXlsx(
  filenameBase: string,
  sheets: { name: string; data: Record<string, string | number>[] }[],
  options?: Pick<TableExportOptions, 'numericColumns'>,
): void {
  const nonEmpty = sheets.filter((s) => s.data.length > 0)
  if (!nonEmpty.length) return
  const wb = XLSX.utils.book_new()
  const numericSet = options?.numericColumns ? new Set(options.numericColumns) : undefined
  for (const s of nonEmpty) {
    const ws = XLSX.utils.json_to_sheet(s.data)
    const headers = Object.keys(s.data[0] ?? {})
    applyXlsxFormatting(ws, headers, numericSet)
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, `${datedFilename(filenameBase)}.xlsx`)
}

/** Format montant pour export PDF (affichage lisible). */
export function formatMontantForExport(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '—'
  const num = typeof n === 'number' ? n : parseFrenchNumber(n)
  if (num === null) return String(n)
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(num)
}
