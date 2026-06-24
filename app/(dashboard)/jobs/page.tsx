import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { JobCard } from '@/components/jobs/JobCard'
import { DiscoverTrigger } from '@/components/jobs/DiscoverTrigger'
import { Briefcase } from 'lucide-react'
import Link from 'next/link'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; minScore?: string; remote?: string; platform?: string; profileId?: string }>
}) {
  const user = await requireUser()
  const sp = await searchParams

  const page = Number(sp.page ?? 1)
  const minScore = Number(sp.minScore ?? 0)
  const limit = 20

  type ProfileItem = { id: string; name: string }
  const [profiles, hasProfile] = await Promise.all([
    prisma.jobProfile.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<ProfileItem[]>,
    prisma.careerProfile.findUnique({ where: { userId: user.id } }).then(Boolean),
  ])

  const activeProfileId = sp.profileId ?? undefined

  const where = {
    userId: user.id,
    isActive: true,
    ...(minScore > 0 ? { matchScore: { gte: minScore } } : {}),
    ...(sp.platform ? { platform: sp.platform as 'LINKEDIN' } : {}),
    ...(sp.remote === 'true' ? { remoteType: { in: ['REMOTE', 'HYBRID'] } } : {}),
    ...(activeProfileId ? { jobProfileId: activeProfileId } : {}),
  }

  const [jobs, total, savedJobIds] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { discoveredAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where }),
    prisma.application.findMany({
      where: { userId: user.id },
      select: { jobId: true },
    }).then(apps => new Set(apps.map(a => a.jobId))),
  ])

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const base: Record<string, string> = { page: '1' }
    if (activeProfileId) base.profileId = activeProfileId
    if (minScore > 0) base.minScore = String(minScore)
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== '') base[k] = String(v)
      else delete base[k]
    }
    return `?${new URLSearchParams(base).toString()}`
  }

  return (
    <div>
      <PageHeader
        title="Job Discovery"
        subtitle={`${total} jobs matched${activeProfileId ? ' to this profile' : ''}`}
        action={<DiscoverTrigger hasProfile={hasProfile as boolean} profileId={activeProfileId} />}
      />

      {/* Profile switcher */}
      {profiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-6 py-3 border-b border-border">
          <Link
            href={buildHref({ profileId: '' })}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              !activeProfileId
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Profiles
          </Link>
          {profiles.map(p => (
            <Link
              key={p.id}
              href={buildHref({ profileId: p.id })}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                activeProfileId === p.id
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description={
            !hasProfile
              ? "Upload your resume to the Career Vault first, then trigger a discovery run."
              : activeProfileId
              ? "No jobs for this profile yet. Click 'Discover' to fetch."
              : "Click 'Discover Jobs' to search all configured sources."
          }
          action={<DiscoverTrigger hasProfile={hasProfile as boolean} profileId={activeProfileId} />}
        />
      ) : (
        <div className="p-6">
          <div className="space-y-3">
            {jobs.map(job => (
              <JobCard key={job.id} job={job} isSaved={savedJobIds.has(job.id)} />
            ))}
          </div>
          {total > limit && (
            <div className="mt-6 flex items-center justify-center gap-4">
              {page > 1 && (
                <a href={buildHref({ page: page - 1 })}
                   className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground">
                  Previous
                </a>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                {page} / {Math.ceil(total / limit)}
              </span>
              {page < Math.ceil(total / limit) && (
                <a href={buildHref({ page: page + 1 })}
                   className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground">
                  Next
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
