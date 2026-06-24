import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileText, Upload } from 'lucide-react'
import Link from 'next/link'

export default async function ResumePage() {
  const user = await requireUser()

  type ResumeRaw = {
    id: string; version: number; label: string | null; isActive: boolean
    jobProfileId: string | null; createdAt: Date
    jobProfile: { name: string } | null
    _count: { variants: number }
  }
  type VariantRaw = {
    id: string; version: number; status: string; atsScore: number | null
    createdAt: Date; job: { title: string; company: string }
  }
  type ProfileItem = { id: string; name: string }

  const [baseResumes, recentVariants, profiles] = await Promise.all([
    prisma.baseResume.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { version: 'desc' },
      include: {
        jobProfile: { select: { name: true } },
        _count: { select: { variants: true } },
      },
    }) as Promise<ResumeRaw[]>,
    prisma.resumeVariant.findMany({
      where: { userId: user.id },
      include: { job: { select: { title: true, company: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }) as Promise<VariantRaw[]>,
    prisma.jobProfile.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<ProfileItem[]>,
  ])

  type ResumeGroup = { label: string; profileId: string | null; resumes: ResumeRaw[] }

  const groups: ResumeGroup[] = [
    { label: 'General', profileId: null, resumes: baseResumes.filter(r => !r.jobProfileId) },
    ...profiles.map((p: ProfileItem) => ({
      label: p.name,
      profileId: p.id,
      resumes: baseResumes.filter(r => r.jobProfileId === p.id),
    })).filter((g: ResumeGroup) => g.resumes.length > 0),
  ]

  return (
    <div>
      <PageHeader
        title="Resume Intelligence"
        subtitle={`${baseResumes.length} base resume${baseResumes.length !== 1 ? 's' : ''} · ${recentVariants.length} tailored variants`}
        action={
          <Link href="/vault"
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md">
            <Upload className="w-3.5 h-3.5" />
            Upload Resume
          </Link>
        }
      />

      {baseResumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No base resume yet"
          description="Upload your resume to the Career Vault. You can upload multiple resumes — one per target role profile."
          action={<Link href="/vault" className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md">Go to Career Vault</Link>}
        />
      ) : (
        <div className="p-6 space-y-6">
          {/* Base resumes grouped by profile */}
          {groups.filter(g => g.resumes.length > 0).map(group => (
            <div key={group.profileId ?? 'general'}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-chivo font-bold text-sm text-foreground">{group.label}</h3>
                {!group.profileId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Available to all profiles
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.resumes.map(resume => (
                  <div key={resume.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium text-sm truncate">
                          {resume.label ?? `Base Resume v${resume.version}`}
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          v{resume.version} · {new Date(resume.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2">
                        {resume._count.variants} variants
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/resume/${resume.id}/tailor`}
                         className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded transition-colors">
                        Tailor for job
                      </Link>
                      <Link href={`/resume/${resume.id}`}
                         className="text-xs border border-border text-muted-foreground hover:text-foreground px-2.5 py-1 rounded transition-colors">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tailored variants */}
          {recentVariants.length > 0 && (
            <div>
              <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Recent Tailored Variants</h3>
              <div className="space-y-2">
                {recentVariants.map(variant => (
                  <div key={variant.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">{variant.job.title}</p>
                      <p className="text-muted-foreground text-xs">{variant.job.company} · v{variant.version}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-lg font-chivo font-bold font-mono ${
                        (variant.atsScore ?? 0) >= 80 ? 'text-profit' :
                        (variant.atsScore ?? 0) >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}>
                        {variant.atsScore ? Math.round(variant.atsScore) : '—'}
                      </span>
                      <p className="text-muted-foreground text-[10px]">ATS</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      variant.status === 'USED' ? 'bg-profit/10 text-profit' : 'bg-muted text-muted-foreground'
                    }`}>
                      {variant.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
