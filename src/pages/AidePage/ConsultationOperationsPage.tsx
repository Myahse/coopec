import { AideHelpAccordion } from './AideHelpAccordion'
import { AIDE_CONSULTATION_OPERATIONS_TITLES } from './aide-help-items'
import { AidePageShell } from './AidePageShell'

export function ConsultationOperationsPage() {
  return (
    <AidePageShell title="Consultation des opérations">
      <AideHelpAccordion titles={[...AIDE_CONSULTATION_OPERATIONS_TITLES]} />
    </AidePageShell>
  )
}
