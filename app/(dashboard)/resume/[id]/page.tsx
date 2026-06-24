import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { ResumeTailorPanel } from '@/components/resume/ResumeTailorPanel'
import { ResumeVariantList } from '@/components/resume/ResumeVariantList'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const [baseResume, recentJobs] = await Promise.all([
    prisma.baseResume.findFirst({
      where: { id, userId: user.id },
      include: {
        variants: {
          orderBy: { createdAt: 'desc' },
          include: { job: { select: { title: true, company: true } } },
        },
      },
    }),
    prisma.job.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { discoveredAt: 'desc' },
      take: 30,
      select: { id: true, title: true, company: true, location: true, matchScore: true },
    }),
  ])

  if (!baseResume) notFound()

  const content = baseResume.content as Record<string, unknown>

  return (
    <div>
      <PageHeader
        title={baseResume.label ?? `Resume v${baseResume.version}`}
        subtitle={`Created ${format(baseResume.createdAt, 'MMM d, yyyy')} · ${baseResume.variants.length} variant${baseResume.variants.length !== 1 ? 's' : ''} generated`}
        action={
          <Link href="/resume" className="text-xs border border-border px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: base resume preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-chivo font-bold text-sm text-foreground">Base Resume Content</h2>
              {baseResume.filePath && (
                <a href={baseResume.filePath}
                   className="text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-md transition-colors">
                  Download original
                </a>
              )}
            </div>

            {baseResume.rawText ? (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {baseResume.rawText}
              </pre>
            ) : (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {JSON.stringify(content, null, 2)}
              </pre>
            )}
          </div>

          {/* Variants */}
          <ResumeVariantList variants={baseResume.variants} />
        </div>

        {/* Right: tailor panel */}
        <div>
          <ResumeTailorPanel baseResumeId={id} recentJobs={recentJobs} />
        </div>
      </div>
    </div>
  )
}
