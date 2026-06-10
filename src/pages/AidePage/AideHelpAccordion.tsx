import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/animate-ui/components/radix/accordion'

type AideHelpAccordionProps = {
  titles: string[]
}

const triggerClassName =
  'justify-center bg-transparent px-4 py-3 text-center text-sm font-normal text-foreground underline decoration-foreground/70 underline-offset-2 hover:bg-transparent [&>span]:text-center'

export function AideHelpAccordion({ titles }: AideHelpAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full divide-y-0 space-y-2">
      {titles.map((title, idx) => (
        <AccordionItem key={title} value={`help-title-${idx}`} className="border-0">
          <AccordionTrigger showArrow={false} className={triggerClassName}>
            {title}
          </AccordionTrigger>
          <AccordionContent keepRendered={false} className="pt-3 text-center text-foreground">
            <div className="flex justify-center">
              <Button type="button" disabled className="w-full sm:w-auto">
                Ouvrir
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
