import { cn } from '@/lib/utils/cn'

type Props = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, className }: Props) {
  return (
    <div className={cn('flex items-start justify-between px-6 py-5 border-b border-border', className)}>
      <div>
        <h1 className="font-chivo font-bold text-xl text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
