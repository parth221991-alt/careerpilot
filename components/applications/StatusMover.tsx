'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AppStatus } from '@prisma/client'
import { cn } from '@/lib/utils/cn'

type Props = {
  applicationId: string
  currentStatus: AppStatus
}

const NEXT_STAGES: Partial<Record<AppStatus, AppStatus[]>> = {
  APPLIED:  ['HR_ROUND', 'REJECTED', 'WITHDRAWN'],
  HR_ROUND: ['TECHNICAL_ROUND', 'REJECTED', 'WITHDRAWN'],
  TECHNICAL_ROUND: ['MANAGER_ROUND', 'REJECTED', 'WITHDRAWN'],
  MANAGER_ROUND: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER:    ['ACCEPTED', 'REJECTED'],
  SAVED:    ['WITHDRAWN'],
}

const STAGE_LABELS: Partial<Record<AppStatus, string>> = {
  HR_ROUND:        'HR Round',
  TECHNICAL_ROUND: 'Technical',
  MANAGER_ROUND:   'Manager Round',
  OFFER:           'Offer',
  ACCEPTED:        'Accept Offer',
  REJECTED:        'Mark Rejected',
  WITHDRAWN:       'Withdraw',
}

const STAGE_STYLE: Partial<Record<AppStatus, string>> = {
  ACCEPTED: 'bg-profit/10 border-profit/30 text-profit hover:bg-profit/20',
  REJECTED: 'border-loss/30 text-loss hover:bg-loss/10',
  WITHDRAWN: 'text-muted-foreground hover:bg-muted',
}

export function StatusMover({ applicationId, currentStatus }: Props) {
  const [loading, setLoading] = useState<AppStatus | null>(null)
  const [current, setCurrent] = useState(currentStatus)
  const [note, setNote] = useState('')

  const nextStages = NEXT_STAGES[current] ?? []

  async function move(toStatus: AppStatus) {
    setLoading(toStatus)
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus, notes: note || undefined }),
    })
    if (res.ok) {
      setCurrent(toStatus)
      setNote('')
    }
    setLoading(null)
  }

  if (nextStages.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-chivo font-bold text-sm text-foreground mb-2">Status</h3>
        <p className="text-muted-foreground text-xs">This application is {current.replace(/_/g, ' ').toLowerCase()}.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-chivo font-bold text-sm text-foreground">Move Stage</h3>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Optional note (e.g. interviewer name, date)"
        rows={2}
        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <div className="grid grid-cols-1 gap-1.5">
        {nextStages.map(stage => (
          <button
            key={stage}
            onClick={() => move(stage)}
            disabled={!!loading}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors disabled:opacity-50',
              STAGE_STYLE[stage] ?? 'border-border text-foreground hover:bg-accent'
            )}
          >
            {loading === stage && <Loader2 className="w-3 h-3 animate-spin" />}
            {STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}
