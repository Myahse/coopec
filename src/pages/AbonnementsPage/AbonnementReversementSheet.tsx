import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { abonnementNumero, reversementAbonnement } from '@/services/abonnement'
import type { WAbonnement } from '@/services/openapi-components'
import { getConnectedUserLogin } from '@/utils/connected-user-login'
import { extractDataFromApiEnvelope } from '@/utils/api-envelope'

type Props = {
  row: WAbonnement | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

export function AbonnementReversementSheet({ row, open, onOpenChange, onDone }: Props) {
  const numero = row ? abonnementNumero(row) : ''
  const [motif, setMotif] = useState('Reversement abonnement')
  const [login, setLogin] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLogin(getConnectedUserLogin())
      setMotif('Reversement abonnement')
      setError(null)
      setSuccess(null)
    }
  }, [open])

  async function handleSubmit() {
    if (!numero) return
    const l = login.trim()
    if (!l) {
      setError('Identifiant de connexion requis.')
      return
    }
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const env = await reversementAbonnement({
        numeroAbonnement: numero,
        motif: motif.trim() || 'Reversement abonnement',
        login: l,
      })
      const msg = extractDataFromApiEnvelope<string>(env)
      setSuccess(typeof msg === 'string' && msg ? msg : 'Reversement effectué.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reversement impossible')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Reversement abonnement</SheetTitle>
          <SheetDescription>
            Carte pleine — <span className="font-mono text-xs">{numero}</span>
            {row?.nomClient ? ` · ${row.nomClient}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-green-700">{success}</p> : null}
          <div className="grid gap-1.5">
            <Label className="text-xs">Motif</Label>
            <Input value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Login</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} />
          </div>
        </div>

        <SheetFooter className="border-t border-border">
          <Button type="button" variant="success" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button type="button" variant="warning" disabled={isSaving || !numero} onClick={() => void handleSubmit()}>
            {isSaving ? 'Traitement…' : 'Confirmer le reversement'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
