import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { KanbanBoard } from '@/components/applications/KanbanBoard'
import { ApprovalQueue } from '@/components/applications/ApprovalQueue'
import { ClipboardList } from 'lucide-react'
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

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={`${applications.length} total · ${pendingApprovals.length} pending approval`}
      />

      {sp.filter === 'approvals' || pendingApprovals.length > 0 ? (
        <div className="p-6 space-y-6">
          {pendingApprovals.length > 0 && (
            <ApprovalQueue applications={pendingApprovals} />
          )}
          {sp.filter !== 'approvals' && (
            <KanbanBoard grouped={grouped} stages={PIPELINE_STAGES} />
          )}
        </div>
      ) : (
        <div className="p-6">
          <KanbanBoard grouped={grouped} stages={PIPELINE_STAGES} />
        </div>
      )}
    </div>
  )
}
