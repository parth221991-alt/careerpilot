import type { Application, Job, ApprovalGate, StatusHistory, AppStatus } from '@prisma/client'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from 'date-fns'
import { Ghost } from 'lucide-react'

type AppWithRelations = Application & {
  job: Job
  approvalGates: ApprovalGate[]
  statusHistory: StatusHistory[]
}

type Props = {
  grouped: Record<AppStatus, AppWithRelations[]>
  stages: AppStatus[]
}

const STAGE_LABELS: Partial<Record<AppStatus, string>> = {
  SAVED:            'Saved',
  APPROVAL_PENDING: 'Approval',
  APPLIED:          'Applied',
  HR_ROUND:         'HR Round',
  TECHNICAL_ROUND:  'Technical',
  MANAGER_ROUND:    'Manager',
  OFFER:            'Offer',
}

const STAGE_COLORS: Partial<Record<AppStatus, string>> = {
  SAVED:            'text-muted-foreground',
  APPROVAL_PENDING: 'text-yellow-400',
  APPLIED:          'text-blue-400',
  HR_ROUND:         'text-indigo-400',
  TECHNICAL_ROUND:  'text-violet-400',
  MANAGER_ROUND:    'text-purple-400',
  OFFER:            'text-profit',
}

export function KanbanBoard({ grouped, stages }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-4 min-w-max">
        {stages.map(stage => {
          const apps = grouped[stage] ?? []
          return (
            <div key={stage} className="w-56 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
                  {STAGE_LABELS[stage]}
                </h4>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-mono numeric">
                  {apps.length}
                </span>
              </div>
              <div className="space-y-2">
                {apps.map(app => (
                  <ApplicationCard key={app.id} app={app} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ApplicationCard({ app }: { app: AppWithRelations }) {
  const hasPendingGate = app.approvalGates.length > 0

  return (
    <a href={`/applications/${app.id}`}>
      <div className={cn(
        'bg-card border rounded-lg p-3 hover:border-indigo-600/30 transition-colors cursor-pointer',
        hasPendingGate ? 'border-yellow-400/30' : 'border-border'
      )}>
        <p className="text-foreground text-xs font-medium leading-tight line-clamp-2">{app.job.title}</p>
        <p className="text-muted-foreground text-[10px] mt-0.5">{app.job.company}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-muted-foreground text-[10px] font-mono">
            {formatDistanceToNow(app.updatedAt, { addSuffix: true })}
          </span>
          {hasPendingGate && (
            <span className="text-[10px] text-yellow-400 font-medium">! Approval</span>
          )}
        </div>
        {/* REQ-016: Ghost indicator — visible on list, full panel on detail page */}
        {app.ghostedAt && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 bg-amber-500/5">
            <Ghost className="w-2.5 h-2.5 shrink-0" />
            <span>Ghosted · Follow up needed</span>
          </div>
        )}
      </div>
    </a>
  )
}
