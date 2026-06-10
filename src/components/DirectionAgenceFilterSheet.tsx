import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DirectionAgenceFiltersState } from '@/hooks/use-direction-agence-filters'

type DirectionAgenceFilterButtonProps = {
  filters: DirectionAgenceFiltersState
  className?: string
  showSummary?: boolean
}

export function DirectionAgenceFilterButton({
  filters,
  className,
  showSummary = false,
}: DirectionAgenceFilterButtonProps) {
  const button = (
    <Button type="button" size="sm" variant="outline" onClick={() => filters.setIsFilterOpen(true)}>
      Filtre
    </Button>
  )

  if (!showSummary) {
    return className ? <div className={className}>{button}</div> : button
  }

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {button}
      {filters.hasScope ? (
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{filters.selectedDirectionLabel}</span>
          <span className="mx-1">·</span>
          <span className="font-medium text-foreground">{filters.selectedAgencyLabel}</span>
        </span>
      ) : null}
    </div>
  )
}

type DirectionAgenceFilterSheetProps = {
  filters: DirectionAgenceFiltersState
}

export function DirectionAgenceFilterSheet({ filters }: DirectionAgenceFilterSheetProps) {
  const agencyPlaceholder = !filters.filterDirection
    ? 'Choisir une direction d’abord'
    : filters.isLoadingAgencies
      ? 'Chargement…'
      : 'Choisir une agence'

  return (
    <Sheet open={filters.isFilterOpen} onOpenChange={filters.setIsFilterOpen}>
      <SheetContent side="right" className="w-[92vw] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Filtres</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <div className="grid gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Direction régionale</Label>
              <Select
                value={filters.filterDirection || undefined}
                onValueChange={(v) => v && filters.setFilterDirection(v)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir une direction">
                    {filters.filterDirection ? filters.selectedDirectionLabel : 'Choisir une direction'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filters.directionChoices.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agence</Label>
              <Select
                value={filters.filterAgence || undefined}
                onValueChange={(v) => v && filters.setFilterAgence(v)}
                disabled={!filters.filterDirection || filters.isLoadingAgencies}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={agencyPlaceholder}>
                    {filters.filterAgence ? filters.selectedAgencyLabel : agencyPlaceholder}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filters.agenceSelectOptions.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.filterDirection ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {filters.isLoadingAgencies
                    ? 'Chargement des agences liées à cette direction…'
                    : 'Seules les agences rattachées à cette direction sont proposées.'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button type="button" variant="secondary" onClick={filters.resetFilters}>
            Réinitialiser
          </Button>
          <Button type="button" onClick={() => filters.setIsFilterOpen(false)}>
            Appliquer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** Bouton + tiroir direction / agence (même UX que Gestion des utilisateurs). */
export function DirectionAgenceFilterControls({
  filters,
  showSummary = false,
  className,
}: DirectionAgenceFilterSheetProps & {
  showSummary?: boolean
  className?: string
}) {
  return (
    <>
      <DirectionAgenceFilterButton filters={filters} showSummary={showSummary} className={className} />
      <DirectionAgenceFilterSheet filters={filters} />
    </>
  )
}
