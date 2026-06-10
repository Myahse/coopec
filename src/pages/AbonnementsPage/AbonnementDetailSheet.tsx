import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { abonnementNumero, loadAbonnementDetail } from '@/services/abonnement'
import type { WAbonnement } from '@/services/openapi-components'
import { formatDate, formatMontant, statusLabel } from './abonnement-format'

type Props = {
  row: WAbonnement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  )
}

export function AbonnementDetailSheet({ row, open, onOpenChange }: Props) {
  const [detail, setDetail] = useState<WAbonnement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numero = row ? abonnementNumero(row) : ''

  useEffect(() => {
    if (!open || !numero) {
      setDetail(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setDetail(row)
    ;(async () => {
      try {
        const loaded = await loadAbonnementDetail(numero)
        if (cancelled) return
        setDetail(loaded ?? row)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible de charger le détail')
          setDetail(row)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, numero, row])

  const d = detail ?? row

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,720px)] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 border-b border-border">
          <DialogTitle>Détail abonnement</DialogTitle>
          <DialogDescription className="font-mono text-xs">{numero || '—'}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : d ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3">
              <DetailRow label="Client" value={d.nomClient ?? '—'} />
              <DetailRow label="Code client" value={d.codeClient ?? '—'} />
              <DetailRow label="N° carte" value={String(d.numabonnemntTemp ?? d.idwAbonnement ?? '—')} />
              <DetailRow label="Date abonnement" value={formatDate(d.dateAbonnement)} />
              <DetailRow label="Période" value={`${formatDate(d.dateDebut)} → ${formatDate(d.dateFin)}`} />
              <DetailRow label="Compte LES" value={d.compteLes ?? d.compteLesN ?? '—'} />
              <DetailRow label="Compte LCE" value={d.compteLce ?? d.compteLceN ?? '—'} />
              <DetailRow label="Collecteur" value={d.codeCollect ?? '—'} />
              <DetailRow label="Agence" value={d.codeAgence ?? d.codeAgenceN ?? '—'} />
              <DetailRow label="Montant" value={formatMontant(d.montantCollect)} />
              <DetailRow label="Téléphone" value={d.gsmprincipale ?? '—'} />
              <DetailRow label="État" value={statusLabel(d.status)} />
              {d.motifarret ? <DetailRow label="Motif arrêt" value={d.motifarret} /> : null}
              {d.datearret ? <DetailRow label="Date arrêt" value={formatDate(d.datearret)} /> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée.</p>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="success" className="w-full" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
