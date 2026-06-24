import type { StatusHistory, AppStatus } from '@prisma/client'
import { format } from 'date-fns'
import { CheckCircle, Clock } from 'lucide-react'

type Props = { history: StatusHistory[] }

const STATUS_COLORS: Record<AppStatus, string> = {
  SAVED:            'border-muted-foreground text-muted-foreground',
  APPROVAL_PENDING: 'border-yellow-400 text-yellow-400',
  APPLIED:          'border-blue-400 text-blue-400',
  HR_ROUND:         'border-indigo-400 text-indigo-400',
  TECHNICAL_ROUND:  'border-violet-400 text-violet-400',
  MANAGER_ROUND:    'border-purple-400 text-purple-400',
  OFFER:            'border-profit text-profit',
  ACCEPTED:         'border-profit text-profit',
  REJECTED:         'border-loss text-loss',
  WITHDRAWN:        'border-muted-foreground text-muted-foreground',
}

export function StatusTimeline({ history }: Props) {
  if (history.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-chivo font-bold text-sm text-foreground mb-4">Status Timeline</h3>
      <div className="relative">
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {history.map((h, i) => (
            <div key={h.id} className="flex items-start gap-4 relative">
              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 bg-card z-10 ${STATUS_COLORS[h.toStatus]}`}>
                {i === history.length - 1
                  ? <Clock className="w-3 h-3" />
                  : <CheckCircle className="w-3 h-3" />
                }
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2">
                  <p className="text-foreground text-sm font-medium">
                    {h.toStatus.replace(/_/g, ' ')}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    by {h.triggeredBy === 'USER' ? 'you' : h.triggeredBy.toLowerCase().replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {format(h.createdAt, 'MMM d, yyyy · h:mm a')}
                </p>
                {h.note && <p className="text-muted-foreground text-xs mt-1 italic">{h.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
