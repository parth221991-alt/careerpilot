import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusTimeline } from '@/components/applications/StatusTimeline'
import { StatusMover } from '@/components/applications/StatusMover'
import { InterviewPrepTrigger } from '@/components/applications/InterviewPrepTrigger'
import { LinkedInApplyPanel } from '@/components/applications/LinkedInApplyPanel'
import { ApplyProgressPanel } from '@/components/applications/ApplyProgressPanel'
import { ReasoningPanel } from '@/components/shared/ReasoningPanel'
import { formatDistanceToNow, format } from 'date-fns'
import type { AppStatus } from '@prisma/client'
import Link from 'next/link'
import { ExternalLink, Briefcase, MapPin, Calendar } from 'lucide-react'
import { FollowUpPanel } from '@/components/applications/FollowUpPanel'

const STATUS_BADGE: Record<AppStatus, string> = {
  SAVED:            'text-muted-foreground bg-muted border-border',
  APPROVAL_PENDING: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  APPLIED:          'text-blue-400 bg-blue-400/10 border-blue-400/30',
  HR_ROUND:         'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',
  TECHNICAL_ROUND:  'text-violet-400 bg-violet-400/10 border-violet-400/30',
  MANAGER_ROUND:    'text-purple-400 bg-purple-400/10 border-purple-400/30',
  OFFER:            'text-profit bg-profit/10 border-profit/30',
  ACCEPTED:         'text-profit bg-profit/10 border-profit/30',
  REJECTED:         'text-loss bg-loss/10 border-loss/30',
  WITHDRAWN:        'text-muted-foreground bg-muted border-border',
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const application = await prisma.application.findFirst({
    where: { id, userId: user.id },
    include: {
      job: true,
      resumeVariant: { include: { baseResume: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      approvalGates: { orderBy: { createdAt: 'desc' }, take: 3 },
      emailThreads: { orderBy: { lastEmailAt: 'desc' }, take: 10 },
      interviewPrep: true,
      offer: true,
    },
  })

  if (!application) notFound()

  const { job } = application
  const pendingGate = application.approvalGates.find(g => g.status === 'PENDING')

  return (
    <div>
      <PageHeader
        title={`${job.title} — ${job.company}`}
        subtitle={`Applied via ${job.platform} · ${formatDistanceToNow(application.updatedAt, { addSuffix: true })}`}
        action={
          <div className="flex items-center gap-2">
            {job.jobUrl && (
              <a href={job.jobUrl} target="_blank"
                 className="flex items-center gap-1 text-xs border border-border px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                View Job
              </a>
            )}
            {(application.status === 'SAVED' || application.status === 'APPROVAL_PENDING') && (
              <LinkedInApplyPanel
                jobId={job.id}
                applicationId={application.id}
                platform={job.platform}
                jobUrl={job.jobUrl ?? job.url ?? undefined}
              />
            )}
            <Link href="/applications"
                  className="text-xs border border-border px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </Link>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job card */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-chivo font-bold text-lg text-foreground">{job.title}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.company}</span>
                  {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                  {job.remoteType && <span className="capitalize">{job.remoteType.toLowerCase()}</span>}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-md border font-medium ${STATUS_BADGE[application.status]}`}>
                {application.status.replace(/_/g, ' ')}
              </span>
            </div>

            {(job.salaryMin || job.salaryMax) && (
              <div className="flex gap-4 mb-4">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Salary Range</p>
                  <p className="text-foreground text-sm font-mono font-bold numeric mt-0.5">
                    ₹{job.salaryMin ? (job.salaryMin / 100000).toFixed(0) : '?'}–{job.salaryMax ? (job.salaryMax / 100000).toFixed(0) : '?'}L
                  </p>
                </div>
                {job.matchScore && (
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Match Score</p>
                    <p className={`text-sm font-mono font-bold numeric mt-0.5 ${
                      job.matchScore >= 80 ? 'text-profit' : job.matchScore >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                    }`}>
                      {Math.round(job.matchScore)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {job.matchReasoning && (
              <ReasoningPanel reasoning={job.matchReasoning} model="claude-haiku" />
            )}

            {(job.rawDescription || job.description) && (
              <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                  View job description
                </summary>
                <div className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                  {job.rawDescription ?? job.description}
                </div>
              </details>
            )}
          </div>

          {/* Pending approval gate */}
          {pendingGate && (
            <div className="bg-yellow-400/5 border border-yellow-400/30 rounded-lg p-4">
              <p className="text-yellow-400 font-medium text-sm mb-1">Action required</p>
              <p className="text-muted-foreground text-xs">
                {pendingGate.actionType.replace(/_/g, ' ')} is waiting for your approval.
                {pendingGate.expiresAt && (
                  <span> Expires {format(pendingGate.expiresAt, 'MMM d, yyyy')}.</span>
                )}
              </p>
              <div className="flex gap-2 mt-3">
                <form action={`/api/applications/${id}/approve`} method="POST">
                  <button type="submit"
                          className="text-xs bg-profit/10 border border-profit/30 text-profit hover:bg-profit/20 px-3 py-1.5 rounded-md transition-colors">
                    Approve
                  </button>
                </form>
                <form action={`/api/applications/${id}/approve`} method="DELETE">
                  <button type="submit"
                          className="text-xs border border-loss/30 text-loss hover:bg-loss/10 px-3 py-1.5 rounded-md transition-colors">
                    Decline
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Resume variant */}
          {application.resumeVariant && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Resume Used</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm">v{application.resumeVariant.version} — Tailored variant</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {application.resumeVariant.atsScore
                      ? `ATS score: ${Math.round(application.resumeVariant.atsScore)}`
                      : 'ATS not scored'}
                  </p>
                </div>
                {application.resumeVariant.pdfPath && (
                  <a href={`/api/resume/${application.resumeVariant.id}/pdf`}
                     className="text-xs border border-border px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                    Download PDF
                  </a>
                )}
              </div>
              {application.resumeVariant.atsBreakdown && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(
                    (application.resumeVariant.atsBreakdown as Record<string, Record<string, number>>).component_scores ?? {}
                  ).map(([key, val]) => (
                    <div key={key} className="bg-muted/30 rounded p-2">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className={`text-sm font-bold font-mono numeric mt-0.5 ${
                        val >= 80 ? 'text-profit' : val >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}>
                        {Math.round(val)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Email threads */}
          {application.emailThreads.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-chivo font-bold text-sm text-foreground">
                  Emails ({application.emailThreads.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {application.emailThreads.map(thread => (
                  <div key={thread.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground text-sm flex-1 truncate">{thread.subject}</p>
                      {thread.classification && (
                        <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded shrink-0">
                          {thread.classification.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {thread.summary && (
                      <p className="text-muted-foreground text-xs mt-1">{thread.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offer details */}
          {application.offer && (
            <div className="bg-card border border-profit/20 rounded-lg p-5">
              <h3 className="font-chivo font-bold text-sm text-profit mb-4">Offer Details</h3>
              <div className="grid grid-cols-3 gap-4">
                {application.offer.baseSalary && (
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Base Salary</p>
                    <p className="text-foreground text-lg font-chivo font-bold numeric mt-1">
                      ₹{(application.offer.baseSalary / 100000).toFixed(1)}L
                    </p>
                  </div>
                )}
                {application.offer.bonusAmount && (
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Bonus</p>
                    <p className="text-profit text-lg font-chivo font-bold numeric mt-1">
                      ₹{(application.offer.bonusAmount / 100000).toFixed(1)}L
                    </p>
                  </div>
                )}
                {application.offer.totalComp && (
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Total Comp</p>
                    <p className="text-foreground text-lg font-chivo font-bold numeric mt-1">
                      ₹{(application.offer.totalComp / 100000).toFixed(1)}L
                    </p>
                  </div>
                )}
              </div>
              {application.offer.joiningDate && (
                <p className="text-muted-foreground text-xs mt-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Joining: {format(application.offer.joiningDate, 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column — actions */}
        <div className="space-y-4">
          {/* Status mover */}
          <StatusMover
            applicationId={id}
            currentStatus={application.status}
          />

          {/* Interview prep */}
          <InterviewPrepTrigger
            applicationId={id}
            hasPrep={!!application.interviewPrep}
            status={application.status}
          />

          {/* REQ-020: Apply Progress — polling client component for real-time status */}
          {(application.isAutoApplied || application.status === 'APPROVAL_PENDING') && (
            <ApplyProgressPanel
              applicationId={application.id}
              initialStatus={application.status}
              supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}
            />
          )}

          {/* REQ-016 (email spec): Send Follow-up — only shown when application is ghosted */}
          {application.ghostedAt && (
            <FollowUpPanel
              applicationId={application.id}
              ghostedAt={application.ghostedAt}
              recipientEmail={application.emailThreads[0]?.fromEmail ?? undefined}
            />
          )}

          {/* Notes */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Notes</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {application.notes ?? 'No notes yet.'}
            </p>
          </div>

          {/* Required skills */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Required Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((skill: string) => (
                  <span key={skill} className="text-[10px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status timeline */}
      <div className="px-6 pb-6">
        <StatusTimeline history={application.statusHistory} />
      </div>
    </div>
  )
}
