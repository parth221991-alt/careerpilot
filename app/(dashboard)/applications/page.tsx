import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { KanbanBoard } from '@/components/applications/KanbanBoard'
import { ApprovalQueue } from '@/components/applications/ApprovalQueue'
import { ClipboardList, LayoutGrid, Clock } from 'lucide-react'
import Link from 'next/link'
import type { AppStatus } from '@prisma/client'

const PIPELINE_STAGES: AppStatus[] = [
  'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
  'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER',
]

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; status?: string }>
}) {
  const user = await requireUser()
  const sp = await searchParams

  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: {
      job: true,
      approvalGates: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const pendingApprovals = applications.filter(a => a.approvalGates.length > 0)

  const grouped = PIPELINE_STAGES.reduce((acc, status) => {
    acc[status] = applications.filter(a => a.status === status)
    return acc
  }, {} as Record<AppStatus, typeof applications>)

  if (applications.length === 0) {
    return (
      <div>
        <PageHeader title="Applications" subtitle="Track every application in your pipeline" />
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Save a job from the Job Discovery page to start your pipeline."
          action={<a href="/jobs" className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md">Browse Jobs</a>}
        />
      </div>
    )
  }

  const activeTab = sp.filter === 'approvals' ? 'approvals' : 'pipeline'

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={`${applications.length} total · ${pendingApprovals.length} pending approval`}
      />

      {/* REQ-021: Tab navigation — Pipeline | Awaiting Approval */}
      <div className="border-b border-border px-6">
        <div className="flex gap-0">
          <Link
            href="/applications"
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'pipeline'
                ? 'border-indigo-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Pipeline
          </Link>
          <Link
            href="/applications?filter=approvals"
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'approvals'
                ? 'border-indigo-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Awaiting Approval
            {pendingApprovals.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === 'approvals'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-yellow-400/20 text-yellow-400'
              }`}>
                {pendingApprovals.length}
              </span>
            )}
          </Link>
        </div>
      </div>

      {activeTab === 'approvals' ? (
        <div className="p-6">
          {pendingApprovals.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No pending approvals"
              description="Auto-apply jobs awaiting your review will appear here."
            />
          ) : (
            <ApprovalQueue applications={pendingApprovals} />
          )}
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {pendingApprovals.length > 0 && (
            <ApprovalQueue applications={pendingApprovals} />
          )}
          <KanbanBoard grouped={grouped} stages={PIPELINE_STAGES} />
        </div>
      )}
    </div>
  )
}
