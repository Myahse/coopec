import { AideHelpAccordion } from './AideHelpAccordion'
import { AIDE_ATTRIBUTION_COMPTE_LES_LCE_TITLES } from './aide-help-items'
import { AidePageShell } from './AidePageShell'

export function AttributionCompteLesLcePage() {
  return (
    <AidePageShell title="Attribution de compte LES et LCE">
      <AideHelpAccordion titles={[...AIDE_ATTRIBUTION_COMPTE_LES_LCE_TITLES]} />
    </AidePageShell>
  )
}
