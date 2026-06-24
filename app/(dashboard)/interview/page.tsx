import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { InterviewPrepCard } from '@/components/interview/InterviewPrepCard'
import { MessageSquare } from 'lucide-react'

export default async function InterviewPage() {
  const user = await requireUser()

  const preps = await prisma.interviewPrep.findMany({
    where: { userId: user.id },
    include: {
      application: { include: { job: true } },
    },
    orderBy: { generatedAt: 'desc' },
  })

  const activeInterviews = await prisma.application.findMany({
    where: {
      userId: user.id,
      status: { in: ['HR_ROUND', 'TECHNICAL_ROUND', 'MANAGER_ROUND'] },
    },
    include: { job: true },
  })

  return (
    <div>
      <PageHeader
        title="Interview OS"
        subtitle={`${activeInterviews.length} active interviews · ${preps.length} prep sessions`}
      />

      {activeInterviews.length === 0 && preps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-chivo font-bold text-foreground text-base">No interviews yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Interview prep is generated automatically when an application moves to interview stage.</p>
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {activeInterviews.length > 0 && (
            <div>
              <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Active Interviews</h3>
              <div className="space-y-3">
                {activeInterviews.map(app => {
                  const prep = preps.find(p => p.applicationId === app.id)
                  return (
                    <div key={app.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-foreground font-medium text-sm">{app.job.title}</p>
                        <p className="text-muted-foreground text-xs">{app.job.company} · {app.status.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="shrink-0">
                        {prep ? (
                          <a href={`/interview/${prep.id}`}
                             className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-600/30 px-2.5 py-1 rounded transition-colors">
                            View Prep
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">No prep yet</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {preps.length > 0 && (
            <div>
              <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Prep Sessions</h3>
              <div className="space-y-4">
                {preps.map(prep => (
                  <InterviewPrepCard key={prep.id} prep={prep} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
