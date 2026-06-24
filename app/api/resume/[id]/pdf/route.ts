import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { generateResumePDF, type ResumeData } from '@/lib/utils/pdf-generator'
import { format } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const variant = await prisma.resumeVariant.findFirst({
    where: { id, userId },
    include: {
      baseResume: {
        include: {
          careerProfile: {
            include: {
              user: true,
              experiences: { orderBy: { startDate: 'desc' } },
              skills: { orderBy: { yearsUsed: 'desc' } },
              certifications: { orderBy: { issuedAt: 'desc' } },
            },
          },
        },
      },
      job: true,
    },
  })

  if (!variant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { careerProfile } = variant.baseResume
  const tailored = variant.tailoredContent as Record<string, unknown> | null

  const resolvedBullets = (experiences: typeof careerProfile.experiences) =>
    experiences.map(exp => ({
      title: exp.title,
      company: exp.company,
      location: exp.location ?? undefined,
      startDate: format(exp.startDate, 'MMM yyyy'),
      endDate: exp.endDate ? format(exp.endDate, 'MMM yyyy') : undefined,
      isCurrent: exp.isCurrent,
      bullets: exp.bullets,
    }))

  const resumeData: ResumeData = {
    name: careerProfile.user.name,
    headline: (tailored?.headline as string | undefined) ?? careerProfile.headline,
    email: careerProfile.user.email,
    location: careerProfile.targetLocations[0],
    linkedin: careerProfile.linkedinUrl ?? undefined,
    summary: (tailored?.summary as string | undefined) ?? careerProfile.summary ?? undefined,
    experiences: tailored?.experiences
      ? (tailored.experiences as typeof resumeData.experiences)
      : resolvedBullets(careerProfile.experiences),
    skills: careerProfile.skills.map(sk => ({ name: sk.name, category: sk.category })),
    certifications: careerProfile.certifications.map(c => ({
      name: c.name,
      issuer: c.issuer,
      year: format(c.issuedAt, 'yyyy'),
    })),
  }

  const pdfBuffer = await generateResumePDF(resumeData)

  const filename = [
    careerProfile.user.name.replace(/\s+/g, '_'),
    variant.job.company.replace(/\s+/g, '_'),
    `v${variant.version}`,
  ].join('_') + '.pdf'

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
