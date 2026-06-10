import jsPDF from 'jspdf'

/** SVG rendered by Recharts inside a shadcn ChartContainer. */
export function getChartSvgFromContainer(container: HTMLElement | null): SVGSVGElement | null {
  if (!container) return null
  const svg = container.querySelector('svg.recharts-surface')
  return svg instanceof SVGSVGElement ? svg : null
}

function findChartScope(container: HTMLElement | null): HTMLElement {
  if (!container) return document.documentElement
  return (
    container.querySelector<HTMLElement>('[data-chart]') ??
    container.closest<HTMLElement>('[data-chart]') ??
    container
  )
}

function datedFilename(base: string): string {
  return `${base}_${new Date().toISOString().slice(0, 10)}`
}

function readCssVar(scope: HTMLElement, name: string, fallback: string): string {
  const fromScope = getComputedStyle(scope).getPropertyValue(name).trim()
  if (fromScope) return fromScope
  const fromRoot = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return fromRoot || fallback
}

function buildCssVarMap(scope: HTMLElement): Record<string, string> {
  const chart1 = readCssVar(scope, '--chart-1', '#3d7a52')
  const chart2 = readCssVar(scope, '--chart-2', '#3d6b8c')
  return {
    '--chart-1': chart1,
    '--chart-2': chart2,
    '--color-montantCollecte': readCssVar(scope, '--color-montantCollecte', chart1),
    '--color-commission': readCssVar(scope, '--color-commission', chart2),
    '--border': readCssVar(scope, '--border', '#e5e7eb'),
    '--muted': readCssVar(scope, '--muted', '#f4f4f5'),
    '--muted-foreground': readCssVar(scope, '--muted-foreground', '#71717a'),
    '--background': readCssVar(scope, '--background', '#ffffff'),
    '--foreground': readCssVar(scope, '--foreground', '#18181b'),
  }
}

function replaceCssVars(value: string, varMap: Record<string, string>): string {
  return value.replace(/var\((--[^,)]+)\)/g, (_, varName: string) => {
    const key = varName.trim()
    return varMap[key] ?? key
  })
}

function hasUnresolvedVar(value: string | null | undefined): boolean {
  return Boolean(value && value.includes('var('))
}

function inlineStyleProperty(style: string, prop: string, varMap: Record<string, string>): string {
  const re = new RegExp(`(${prop}\\s*:\\s*)([^;]+)`, 'i')
  return style.replace(re, (_, prefix: string, raw: string) => `${prefix}${replaceCssVars(raw.trim(), varMap)}`)
}

/** Clone SVG and inline CSS variables / computed paints so canvas export keeps curves. */
export function inlineSvgColors(svg: SVGSVGElement, container?: HTMLElement | null): SVGSVGElement {
  const scope = findChartScope(container ?? null)
  const varMap = buildCssVarMap(scope)
  const clone = svg.cloneNode(true) as SVGSVGElement

  const originalNodes = [svg, ...Array.from(svg.querySelectorAll('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))]

  cloneNodes.forEach((node, index) => {
    const el = node as SVGElement
    const original = originalNodes[index] as Element | undefined
    if (!original) return

    for (const attr of ['stroke', 'fill', 'stop-color', 'flood-color', 'color']) {
      const raw = el.getAttribute(attr)
      if (!raw) continue
      el.setAttribute(attr, replaceCssVars(raw, varMap))
    }

    const inlineStyle = el.getAttribute('style')
    if (inlineStyle) {
      let nextStyle = inlineStyle
      for (const prop of ['stroke', 'fill', 'stop-color', 'color']) {
        nextStyle = inlineStyleProperty(nextStyle, prop, varMap)
      }
      el.setAttribute('style', nextStyle)
    }

    const computed = getComputedStyle(original)
    const tag = el.tagName.toLowerCase()
    const paintTags = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'])

    if (!paintTags.has(tag)) return

    const stroke = computed.stroke
    const fill = computed.fill
    const currentStroke = el.getAttribute('stroke')
    const currentFill = el.getAttribute('fill')

    if (stroke && stroke !== 'none' && (!currentStroke || hasUnresolvedVar(currentStroke))) {
      el.setAttribute('stroke', stroke)
    }
    if (fill && fill !== 'none' && (!currentFill || hasUnresolvedVar(currentFill))) {
      el.setAttribute('fill', fill)
    }

    if (computed.strokeOpacity && computed.strokeOpacity !== '1') {
      el.setAttribute('stroke-opacity', computed.strokeOpacity)
    }
    if (computed.fillOpacity && computed.fillOpacity !== '1') {
      el.setAttribute('fill-opacity', computed.fillOpacity)
    }
    if (computed.strokeWidth && computed.strokeWidth !== '0') {
      el.setAttribute('stroke-width', computed.strokeWidth)
    }
  })

  return clone
}

export async function svgElementToPngDataUrl(
  svg: SVGSVGElement,
  width = 1200,
  height = 600,
  container?: HTMLElement | null,
): Promise<string> {
  const prepared = inlineSvgColors(svg, container)
  prepared.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const vb = prepared.getAttribute('viewBox')
  if (vb) {
    prepared.setAttribute('width', String(width))
    prepared.setAttribute('height', String(height))
  }
  const svgData = new XMLSerializer().serializeToString(prepared)
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas non disponible'))
        return
      }
      ctx.fillStyle = readCssVar(findChartScope(container ?? null), '--background', '#ffffff')
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png', 1))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Export graphique impossible'))
    }
    img.src = url
  })
}

export async function exportChartSvgToPdf(options: {
  title: string
  subtitle?: string
  filenameBase: string
  svg: SVGSVGElement | null
  container?: HTMLElement | null
}): Promise<void> {
  if (!options.svg) return
  const png = await svgElementToPngDataUrl(options.svg, 1400, 520, options.container)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFontSize(14)
  doc.text(options.title, 40, 36)
  if (options.subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(90)
    const lines = doc.splitTextToSize(options.subtitle, pageW - 80)
    doc.text(lines, 40, 52)
    doc.setTextColor(0)
  }
  const imgW = pageW - 80
  const imgH = (imgW * 520) / 1400
  doc.addImage(png, 'PNG', 40, options.subtitle ? 68 : 50, imgW, imgH)
  doc.save(`${datedFilename(options.filenameBase)}.pdf`)
}

export async function exportChartSvgToPng(options: {
  filenameBase: string
  svg: SVGSVGElement | null
  container?: HTMLElement | null
  width?: number
  height?: number
}): Promise<void> {
  if (!options.svg) return
  const png = await svgElementToPngDataUrl(
    options.svg,
    options.width ?? 1400,
    options.height ?? 520,
    options.container,
  )
  const link = document.createElement('a')
  link.href = png
  link.download = `${datedFilename(options.filenameBase)}.png`
  link.click()
}

export async function exportCourbeCollectChartsPdf(options: {
  filenameBase: string
  filterSummary: string
  periodLabel: string
  charts: { title: string; container?: HTMLElement | null; svg?: SVGSVGElement | null }[]
}): Promise<void> {
  const withSvg = options.charts
    .map((c) => ({
      title: c.title,
      container: c.container ?? null,
      svg: c.svg ?? getChartSvgFromContainer(c.container ?? null),
    }))
    .filter((c) => c.svg)
  if (!withSvg.length) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFontSize(14)
  doc.text('Courbe collect', 40, 36)
  doc.setFontSize(9)
  doc.setTextColor(90)
  const meta = doc.splitTextToSize(`${options.periodLabel}\n${options.filterSummary}`, pageW - 80)
  doc.text(meta, 40, 52)
  doc.setTextColor(0)

  let y = 80
  const imgW = pageW - 80
  const imgH = Math.min(220, (imgW * 520) / 1400)

  for (const chart of withSvg) {
    if (y + imgH + 40 > pageH) {
      doc.addPage()
      y = 40
    }
    doc.setFontSize(11)
    doc.text(chart.title, 40, y)
    y += 16
    const png = await svgElementToPngDataUrl(chart.svg!, 1400, 520, chart.container)
    doc.addImage(png, 'PNG', 40, y, imgW, imgH)
    y += imgH + 24
  }

  doc.save(`${datedFilename(options.filenameBase)}.pdf`)
}
