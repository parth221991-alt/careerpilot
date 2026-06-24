import { cn } from '@/lib/utils/cn'

type Props = {
  icon: React.FC<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 px-6 text-center', className)}>
      <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-chivo font-bold text-foreground text-base mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
