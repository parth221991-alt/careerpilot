import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function RecruitersPage() {
  const user = await requireUser()

  const recruiters = await prisma.recruiter.findMany({
    where: { userId: user.id },
    include: {
      interactions: { orderBy: { occurredAt: 'desc' }, take: 1 },
    },
    orderBy: { lastContactAt: 'desc' },
  })

  return (
    <div>
      <PageHeader
        title="Recruiter CRM"
        subtitle={`${recruiters.length} recruiter${recruiters.length !== 1 ? 's' : ''} tracked`}
      />

      {recruiters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-chivo font-bold text-foreground text-base">No recruiters tracked yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Recruiters are automatically extracted from your Gmail threads.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {recruiters.map(recruiter => (
            <div key={recruiter.id} className="px-6 py-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
              <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
                <span className="text-indigo-400 text-sm font-bold">
                  {(recruiter.name ?? recruiter.email ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium text-sm">{recruiter.name ?? recruiter.email}</p>
                <p className="text-muted-foreground text-xs">
                  {recruiter.company ?? 'Unknown company'}
                  {recruiter.email ? ` · ${recruiter.email}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {recruiter.lastContactAt && (
                  <p className="text-muted-foreground text-xs">
                    {formatDistanceToNow(recruiter.lastContactAt, { addSuffix: true })}
                  </p>
                )}
                <p className="text-muted-foreground text-[10px] mt-0.5">
                  {recruiter.interactions[0]?.channel ?? 'No contact'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
