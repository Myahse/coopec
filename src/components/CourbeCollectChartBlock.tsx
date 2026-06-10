import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react'
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CourbeCollectChart,
  CHART_TYPE_LABELS,
  type CourbeCollectChartType,
  type CourbeCollectScale,
} from '@/components/CourbeCollectChart'
import type { CourbeCollectPoint } from '@/services/courbe-collect'
import {
  exportChartSvgToPdf,
  exportChartSvgToPng,
  getChartSvgFromContainer,
} from '@/utils/chart-export'

const CHART_TYPE_OPTIONS: CourbeCollectChartType[] = ['courbe', 'aire', 'nuage']

function mergeRefs<T>(...refs: (Ref<T | null> | undefined)[]): (value: T | null) => void {
  return (value) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else ref.current = value
    }
  }
}

type Props = {
  title: string
  points: CourbeCollectPoint[]
  scale: CourbeCollectScale
  tall?: boolean
  emptyHint?: string
  exportFilenameBase: string
  filterSummary?: string
  periodLabel?: string
  chartContainerRef?: RefObject<HTMLDivElement | null>
}

function ChartToolbar({
  chartType,
  onChartTypeChange,
  onZoomIn,
  onZoomOut,
  onReset,
  onExpand,
  onPng,
  onPdf,
  disabled,
  zoomLabel,
  expandedView,
}: {
  chartType: CourbeCollectChartType
  onChartTypeChange: (value: CourbeCollectChartType) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onExpand: () => void
  onPng: () => void
  onPdf: () => void
  disabled: boolean
  zoomLabel: string
  expandedView?: boolean
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Type de graphique"
          className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
        >
          {CHART_TYPE_OPTIONS.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={chartType === type ? 'default' : 'ghost'}
              className="h-6 px-2 text-[11px]"
              aria-pressed={chartType === type}
              onClick={() => onChartTypeChange(type)}
            >
              {CHART_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">{zoomLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={disabled}
          title="Zoom avant"
          onClick={onZoomIn}
        >
          <ZoomIn className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={disabled}
          title="Zoom arrière"
          onClick={onZoomOut}
        >
          <ZoomOut className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={disabled}
          title="Réinitialiser la vue"
          onClick={onReset}
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={disabled}
          title={expandedView ? 'Réduire' : 'Agrandir'}
          onClick={onExpand}
        >
          {expandedView ? (
            <Minimize2 className="size-3.5" aria-hidden />
          ) : (
            <Maximize2 className="size-3.5" aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-primary/60 px-2 text-primary"
          disabled={disabled}
          title="Exporter en PNG"
          onClick={onPng}
        >
          PNG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-primary/60 px-2 text-primary"
          disabled={disabled}
          title="Exporter en PDF"
          onClick={onPdf}
        >
          PDF
        </Button>
      </div>
    </div>
  )
}

export function CourbeCollectChartBlock({
  title,
  points,
  scale,
  tall,
  emptyHint,
  exportFilenameBase,
  filterSummary,
  periodLabel,
  chartContainerRef,
}: Props) {
  const [brushStart, setBrushStart] = useState(0)
  const [brushEnd, setBrushEnd] = useState(0)
  const [chartType, setChartType] = useState<CourbeCollectChartType>('courbe')
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const containerExpandedRef = useRef<HTMLDivElement | null>(null)
  const setContainerRef = useMemo(
    () => mergeRefs(containerRef, chartContainerRef),
    [chartContainerRef],
  )

  const hasData = points.length > 0
  const lastIndex = Math.max(0, points.length - 1)

  useEffect(() => {
    setBrushStart(0)
    setBrushEnd(lastIndex)
  }, [points, lastIndex])

  useEffect(() => {
    if (!expanded) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  const onBrushChange = useCallback((start: number, end: number) => {
    setBrushStart(Math.max(0, Math.min(start, end)))
    setBrushEnd(Math.min(lastIndex, Math.max(start, end)))
  }, [lastIndex])

  const resetBrush = useCallback(() => {
    setBrushStart(0)
    setBrushEnd(lastIndex)
  }, [lastIndex])

  const zoomIn = useCallback(() => {
    const span = brushEnd - brushStart
    if (span <= 1) return
    const pad = Math.max(1, Math.floor(span * 0.2))
    setBrushStart(Math.min(brushEnd - 1, brushStart + pad))
    setBrushEnd(Math.max(brushStart + 1, brushEnd - pad))
  }, [brushStart, brushEnd])

  const zoomOut = useCallback(() => {
    const pad = Math.max(1, Math.floor((brushEnd - brushStart) * 0.25))
    setBrushStart(Math.max(0, brushStart - pad))
    setBrushEnd(Math.min(lastIndex, brushEnd + pad))
  }, [brushStart, brushEnd, lastIndex])

  const visibleCount = hasData ? brushEnd - brushStart + 1 : 0
  const zoomPct = hasData && lastIndex > 0
    ? Math.round((visibleCount / (lastIndex + 1)) * 100)
    : 100

  const exportFilename = useMemo(
    () => `${exportFilenameBase}_${chartType}`,
    [exportFilenameBase, chartType],
  )

  const exportPdf = useCallback(
    async (el: HTMLDivElement | null) => {
      const svg = getChartSvgFromContainer(el)
      if (!svg) return
      await exportChartSvgToPdf({
        title,
        subtitle: [periodLabel, filterSummary].filter(Boolean).join(' — '),
        filenameBase: exportFilename,
        svg,
        container: el,
      })
    },
    [title, periodLabel, filterSummary, exportFilename],
  )

  const exportPng = useCallback(
    async (el: HTMLDivElement | null) => {
      const svg = getChartSvgFromContainer(el)
      if (!svg) return
      await exportChartSvgToPng({
        filenameBase: exportFilename,
        svg,
        container: el,
      })
    },
    [exportFilename],
  )

  const zoomLabel = hasData
    ? `Vue ${zoomPct}% · ${visibleCount}/${points.length} point(s) · curseur en bas du graphique`
    : '—'

  const chartProps = {
    points,
    scale,
    chartType,
    emptyHint,
    brushStart,
    brushEnd,
    onBrushChange,
    showBrush: true as const,
  }

  return (
    <>
      <ChartToolbar
        chartType={chartType}
        onChartTypeChange={setChartType}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetBrush}
        onExpand={() => setExpanded(true)}
        onPng={() => void exportPng(containerRef.current)}
        onPdf={() => void exportPdf(containerRef.current)}
        disabled={!hasData}
        zoomLabel={zoomLabel}
      />
      <div className="rounded-lg border border-border/60 bg-background">
        <CourbeCollectChart
          key={chartType}
          ref={setContainerRef}
          {...chartProps}
          tall={tall}
        />
      </div>

      {expanded ? (
        <div
          className="fixed inset-0 z-[200] flex h-screen w-screen flex-col bg-background text-foreground"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Courbe collect</div>
                <div className="mt-0.5 truncate text-lg font-semibold tracking-tight">{title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Graphique interactif : survol, légende, et sélection de période avec le curseur en bas.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setExpanded(false)}
              >
                Fermer
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
            <div className="shrink-0">
              <ChartToolbar
                chartType={chartType}
                onChartTypeChange={setChartType}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onReset={resetBrush}
                onExpand={() => setExpanded(false)}
                onPng={() => void exportPng(containerExpandedRef.current ?? containerRef.current)}
                onPdf={() => void exportPdf(containerExpandedRef.current ?? containerRef.current)}
                disabled={!hasData}
                zoomLabel={zoomLabel}
                expandedView
              />
            </div>
            <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-background">
              <div className="min-h-0 flex-1 overflow-hidden p-2">
                <CourbeCollectChart
                  key={`expanded-${chartType}`}
                  ref={containerExpandedRef}
                  {...chartProps}
                  fill
                  className="h-full min-h-0"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
