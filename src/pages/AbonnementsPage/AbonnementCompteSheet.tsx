import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  abonnementNumero,
  loadCompteAbonnement,
  updateCompteAbonnement,
  type PrefixCompteAbonnement,
} from '@/services/abonnement'
import type { WAbonnement } from '@/services/openapi-components'
import { extractDataFromApiEnvelope } from '@/utils/api-envelope'

type Props = {
  row: WAbonnement | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function AbonnementCompteSheet({ row, open, onOpenChange, onSaved }: Props) {
  const numero = row ? abonnementNumero(row) : ''

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [prefix, setPrefix] = useState<PrefixCompteAbonnement | null>(null)

  const [compteLES, setCompteLES] = useState('')
  const [compteLCE, setCompteLCE] = useState('')
  const [compteLESnouveau, setCompteLESnouveau] = useState('')
  const [compteLCEnouveau, setCompteLCEnouveau] = useState('')
  const [codeClient, setCodeClient] = useState('')
  const [typeClient, setTypeClient] = useState('')
  const [statut, setStatut] = useState('')

  useEffect(() => {
    if (!open || !numero) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    ;(async () => {
      try {
        const { compte, prefix: p } = await loadCompteAbonnement(numero)
        if (cancelled) return
        setPrefix(p)
        setCompteLES(String(compte?.compteLes ?? row?.compteLes ?? ''))
        setCompteLCE(String(compte?.compteLce ?? row?.compteLce ?? ''))
        setCompteLESnouveau(String(compte?.compteLesN ?? ''))
        setCompteLCEnouveau(String(compte?.compteLceN ?? ''))
        setCodeClient(String(compte?.codeClient ?? row?.codeClient ?? ''))
        setTypeClient(String(compte?.typeClient ?? ''))
        setStatut(String(compte?.status ?? row?.status ?? ''))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible de charger les comptes')
          setCompteLES(String(row?.compteLes ?? ''))
          setCompteLCE(String(row?.compteLce ?? ''))
          setCodeClient(String(row?.codeClient ?? ''))
          setStatut(String(row?.status ?? ''))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, numero, row])

  async function handleSave() {
    if (!numero) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const env = await updateCompteAbonnement({
        numAbonnement: numero,
        compteLES: compteLES.trim() || undefined,
        compteLCE: compteLCE.trim() || undefined,
        compteLESnouveau: compteLESnouveau.trim() || undefined,
        compteLCEnouveau: compteLCEnouveau.trim() || undefined,
        codeClient: codeClient.trim() || undefined,
        typeClient: typeClient.trim() || undefined,
        statut: statut.trim() ? Number(statut) : undefined,
      })
      const msg = extractDataFromApiEnvelope<string>(env)
      setSuccess(typeof msg === 'string' && msg ? msg : 'Comptes mis à jour.')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Comptes LES / LCE</SheetTitle>
          <SheetDescription className="font-mono text-xs">{numero}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-700">{success}</p> : null}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <>
              {prefix ? (
                <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <div>Préfixes client : {prefix.compteClient_prefix ?? '—'}</div>
                  <div>LES : {prefix.compteLES_prefix ?? '—'} · LCE : {prefix.compteLCE_prefix ?? '—'}</div>
                  <div>
                    LES (N) : {prefix.compteLES_N_prefix ?? '—'} · LCE (N) : {prefix.compteLCE_N_prefix ?? '—'}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Compte LES actuel</Label>
                  <Input value={compteLES} onChange={(e) => setCompteLES(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Compte LCE actuel</Label>
                  <Input value={compteLCE} onChange={(e) => setCompteLCE(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nouveau LES</Label>
                  <Input value={compteLESnouveau} onChange={(e) => setCompteLESnouveau(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Nouveau LCE</Label>
                  <Input value={compteLCEnouveau} onChange={(e) => setCompteLCEnouveau(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Code client</Label>
                  <Input value={codeClient} onChange={(e) => setCodeClient(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Type client</Label>
                  <Input value={typeClient} onChange={(e) => setTypeClient(e.target.value)} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs">Statut</Label>
                  <Input value={statut} onChange={(e) => setStatut(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border">
          <Button type="button" variant="success" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button type="button" variant="default" disabled={isLoading || isSaving || !numero} onClick={() => void handleSave()}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
