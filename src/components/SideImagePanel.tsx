type SideImagePanelProps = {
  imageSrc: string
  imageAlt: string
  caption: string
  className?: string
}

export function SideImagePanel({ imageSrc, imageAlt, caption, className }: SideImagePanelProps) {
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-background/40 to-muted/80" />
      <img className="h-full w-full object-cover" alt={imageAlt} src={imageSrc} />
      <div className="absolute inset-0 ring-1 ring-border/50" />
      <div className="absolute bottom-10 left-10 right-10 rounded-2xl bg-background/75 p-6 text-sm text-foreground ring-1 ring-border backdrop-blur">
        {caption}
      </div>
    </div>
  )
}

