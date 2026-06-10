import { forwardRef, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { CourbeCollectPoint } from '@/services/courbe-collect'

export type CourbeCollectScale = 'jour' | 'annee'

export type CourbeCollectChartType = 'courbe' | 'aire' | 'nuage'

export const CHART_TYPE_LABELS: Record<CourbeCollectChartType, string> = {
  courbe: 'Courbe',
  aire: 'Aire',
  nuage: 'Nuage de points',
}

type ChartRow = {
  date: string
  label: string
  montantCollecte: number
  commission: number
}

type Props = {
  points: CourbeCollectPoint[]
  className?: string
  tall?: boolean
  /** Use all available parent height (fullscreen modal). */
  fill?: boolean
  emptyHint?: string
  scale?: CourbeCollectScale
  chartType?: CourbeCollectChartType
  brushStart?: number
  brushEnd?: number
  onBrushChange?: (start: number, end: number) => void
  showBrush?: boolean
}

const chartConfig = {
  montantCollecte: {
    label: 'Montant collecté',
    color: 'var(--chart-1)',
  },
  commission: {
    label: 'Commissions',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

const CHART_MARGIN = { top: 8, right: 12, left: 4, bottom: 8 }
const BRUSH_EXTRA_BOTTOM = 28

function formatAxisLabel(iso: string, scale: CourbeCollectScale): string {
  try {
    if (scale === 'annee') {
      const [y, m] = iso.split('-')
      if (y && m) {
        const d = new Date(Number(y), Number(m) - 1, 1)
        return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      }
    }
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch {
    return iso
  }
}

function formatMontantAxis(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}

function toChartRows(points: CourbeCollectPoint[], scale: CourbeCollectScale): ChartRow[] {
  return points.map((p) => ({
    date: p.date,
    label: formatAxisLabel(p.date, scale),
    montantCollecte: p.montantCollecte,
    commission: p.commission,
  }))
}

type ChartBodyProps = {
  data: ChartRow[]
  chartType: CourbeCollectChartType
  chartMargin: { top: number; right: number; left: number; bottom: number }
  canBrush: boolean
  brushStart: number
  endIndex: number
  onBrushChange?: (start: number, end: number) => void
}

function ChartBody({
  data,
  chartType,
  chartMargin,
  canBrush,
  brushStart,
  endIndex,
  onBrushChange,
}: ChartBodyProps) {
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={28}
        interval="preserveStartEnd"
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        width={52}
        tickFormatter={formatMontantAxis}
      />
      <ChartTooltip
        cursor={chartType === 'nuage' ? false : { stroke: 'var(--border)', strokeWidth: 1 }}
        content={
          <ChartTooltipContent
            labelFormatter={(_, payloadItems) => {
              const row = payloadItems?.[0]?.payload as ChartRow | undefined
              return row?.label ?? ''
            }}
            formatter={(value) =>
              typeof value === 'number'
                ? new Intl.NumberFormat('fr-FR').format(value)
                : String(value)
            }
          />
        }
      />
      <ChartLegend content={<ChartLegendContent />} />
    </>
  )

  const brush = canBrush ? (
    <Brush
      dataKey="label"
      height={26}
      stroke="var(--border)"
      fill="var(--muted)"
      travellerWidth={8}
      startIndex={Math.min(brushStart, endIndex)}
      endIndex={endIndex}
      onChange={(range) => {
        if (
          range &&
          typeof range.startIndex === 'number' &&
          typeof range.endIndex === 'number' &&
          onBrushChange
        ) {
          onBrushChange(range.startIndex, range.endIndex)
        }
      }}
    />
  ) : null

  if (chartType === 'aire') {
    return (
      <AreaChart data={data} margin={chartMargin}>
        {axes}
        <Area
          type="monotone"
          dataKey="montantCollecte"
          stroke="var(--color-montantCollecte)"
          fill="var(--color-montantCollecte)"
          fillOpacity={0.28}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="commission"
          stroke="var(--color-commission)"
          fill="var(--color-commission)"
          fillOpacity={0.22}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        {brush}
      </AreaChart>
    )
  }

  const showLineDots = chartType === 'courbe' && data.length <= 40
  const scatterDot = { r: 4, strokeWidth: 0, fillOpacity: 1 } as const

  return (
    <LineChart data={data} margin={chartMargin}>
      {axes}
      <Line
        type="monotone"
        dataKey="montantCollecte"
        stroke={chartType === 'nuage' ? 'transparent' : 'var(--color-montantCollecte)'}
        strokeWidth={chartType === 'nuage' ? 0 : 2}
        dot={
          chartType === 'nuage'
            ? { ...scatterDot, fill: 'var(--color-montantCollecte)' }
            : showLineDots
        }
        activeDot={{ r: chartType === 'nuage' ? 6 : 4 }}
      />
      <Line
        type="monotone"
        dataKey="commission"
        stroke={chartType === 'nuage' ? 'transparent' : 'var(--color-commission)'}
        strokeWidth={chartType === 'nuage' ? 0 : 2}
        strokeDasharray={chartType === 'nuage' ? undefined : '6 4'}
        dot={
          chartType === 'nuage'
            ? { ...scatterDot, fill: 'var(--color-commission)' }
            : false
        }
        activeDot={{ r: chartType === 'nuage' ? 6 : 4 }}
      />
      {brush}
    </LineChart>
  )
}

export const CourbeCollectChart = forwardRef<HTMLDivElement, Props>(function CourbeCollectChart(
  {
    points,
    className,
    tall,
    fill,
    emptyHint,
    scale = 'jour',
    chartType = 'courbe',
    brushStart = 0,
    brushEnd,
    onBrushChange,
    showBrush = true,
  },
  ref,
) {
  const data = useMemo(() => toChartRows(points, scale), [points, scale])
  const endIndex = brushEnd ?? Math.max(0, data.length - 1)
  const canBrush = Boolean(showBrush && data.length > 2 && onBrushChange)

  const chartMargin = useMemo(
    () => ({
      ...CHART_MARGIN,
      bottom: CHART_MARGIN.bottom + (canBrush ? BRUSH_EXTRA_BOTTOM : 0),
    }),
    [canBrush],
  )

  if (!data.length) {
    return (
      <div
        ref={ref}
        className={[
          `flex ${fill ? 'h-full' : tall ? 'h-[320px]' : 'h-[220px]'} items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground`,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {emptyHint ?? 'Aucune donnée pour la période.'}
      </div>
    )
  }

  const hint =
    chartType === 'nuage'
      ? 'Survolez un point pour les valeurs · curseur en bas pour zoomer sur une période'
      : 'Survolez pour les valeurs · faites glisser la zone en bas pour zoomer sur une période'

  return (
    <div
      ref={ref}
      className={[
        fill ? 'flex h-full min-h-0 w-full flex-col' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ChartContainer
        key={chartType}
        config={chartConfig}
        className={[
          'w-full [&_.recharts-brush-texts]:hidden',
          fill ? 'aspect-auto min-h-0 flex-1' : tall ? 'h-[320px]' : 'h-[220px]',
        ].join(' ')}
        initialDimension={{ width: 640, height: fill ? 520 : tall ? 320 : 220 }}
      >
        <ChartBody
          data={data}
          chartType={chartType}
          chartMargin={chartMargin}
          canBrush={canBrush}
          brushStart={brushStart}
          endIndex={endIndex}
          onBrushChange={onBrushChange}
        />
      </ChartContainer>
      <p
        className={[
          'mt-1.5 shrink-0 text-center text-[10px] text-muted-foreground',
          fill ? 'pb-0.5' : '',
        ].join(' ')}
      >
        {hint}
      </p>
    </div>
  )
})
