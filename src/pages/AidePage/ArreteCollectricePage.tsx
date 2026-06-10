import { AideHelpAccordion } from './AideHelpAccordion'
import { AIDE_ARRETE_COLLECTRICE_TITLES } from './aide-help-items'
import { AidePageShell } from './AidePageShell'

export function ArreteCollectricePage() {
  return (
    <AidePageShell title="Arrêté de la collectrice">
      <AideHelpAccordion titles={[...AIDE_ARRETE_COLLECTRICE_TITLES]} />
    </AidePageShell>
  )
}
