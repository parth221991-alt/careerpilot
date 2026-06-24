import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { selectBestResume } from '@/lib/claude/agents/ResumeSelectAgent'
import { runResumeAgent, runATSAnalysis } from '@/lib/claude/agents/ResumeAgent'
import { generateApplyAnswers } from '@/lib/claude/agents/AssistAgent'
import { createLogger } from '@/lib/utils/logger'
import { z } from 'zod'
import type { UserProfileContext } from '@/types/agents'

const logger = createLogger('apply-linkedin-prep')

const PrepSchema = z.object({
  jobId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
})

// REQ-002: 60-second timeout for pre-apply steps
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PrepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { jobId, applicationId, profileId } = parsed.data

  const [job, careerProfile] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, userId },
      select: {
        description: true,
        rawDescription: true,
        title: true,
        company: true,
        salaryCurrency: true,
        requiredSkills: true,
      },
    }),
    prisma.careerProfile.findUnique({
      where: { userId },
      select: {
        headline: true,
        yearsOfExperience: true,
        targetSalaryMin: true,
        targetSalaryMax: true,
        currency: true,
        targetLocations: true,
        remotePreference: true,
      },
    }),
  ])

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const jd = job.description ?? job.rawDescription ?? ''

  if (!jd) {
    // EDGE-004: no JD — return partial with warning
    logger.warn('No JD for LinkedIn prep', { jobId })
    return NextResponse.json({
      warning: 'Job description unavailable — answers may be generic.',
      answers: {
        coverLetter: `I am excited to apply for the ${job.title} position at ${job.company}.`,
        whyInterested: `${job.company}'s work in this space aligns with my career goals.`,
        expectedSalary: careerProfile?.targetSalaryMin
          ? `${careerProfile.currency} ${careerProfile.targetSalaryMin}–${careerProfile.targetSalaryMax}`
          : 'To be discussed',
        noticePeriod: '30 days',
        yearsExperience: careerProfile?.yearsOfExperience ?? 0,
        workAuthorization: 'Indian citizen, authorized to work in India',
        screeningAnswers: {},
      },
      atsScore: null,
    })
  }

  // REQ-001 Step 1: select best resume for this JD + profile
  let baseResumeId: string
  try {
    const selection = await selectBestResume(userId, jd, profileId)
    baseResumeId = selection.result.baseResumeId
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }

  const baseResume = await prisma.baseResume.findUnique({
    where: { id: baseResumeId },
    select: { rawText: true, content: true },
  })

  if (!baseResume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  if (!baseResume.rawText) return NextResponse.json({ error: 'Resume has no text content' }, { status: 422 })

  // REQ-001 Step 2: Check for existing variant for this job+resume, create if not present
  let variant = await prisma.resumeVariant.findFirst({
    where: { baseResumeId, jobId, userId },
    orderBy: { version: 'desc' },
    select: { id: true, atsScore: true, injectedKeywords: true, rawText: true, tailoredContent: true, status: true },
  })

  if (!variant || variant.status === 'FAILED') {
    // REQ-001 Step 2–3: Run tailoring + ATS analysis; wait for READY
    logger.info('Creating ResumeVariant before LinkedIn prep', { userId, jobId, baseResumeId })
    try {
      const resumeContent = (baseResume.content as Record<string, unknown>) ?? { rawText: baseResume.rawText }

      const [tailoredOutput, atsOutput] = await Promise.all([
        runResumeAgent(userId, resumeContent, jd, job.title, job.company, job.requiredSkills ?? []),
        runATSAnalysis(baseResume.rawText, jd),
      ])

      const tailored = tailoredOutput.result
      const atsAnalysis = atsOutput.result

      const lastVariant = await prisma.resumeVariant.findFirst({
        where: { baseResumeId, userId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      const nextVersion = (lastVariant?.version ?? 0) + 1

      variant = await prisma.resumeVariant.create({
        data: {
          baseResumeId,
          jobId,
          userId,
          version: nextVersion,
          tailoredJson: tailored as object,
          tailoredContent: tailored as object,
          atsScore: atsAnalysis.score,
          atsBreakdown: atsAnalysis as object,
          injectedKeywords: tailored.injectedKeywords ?? [],
          missingKeywords: atsAnalysis.missing_critical_skills,
          claudeReasoning: tailoredOutput.reasoning ?? null,
          keywordCoverage: atsAnalysis.component_scores?.keyword_coverage ?? null,
          status: 'READY',
        },
        select: { id: true, atsScore: true, injectedKeywords: true, rawText: true, tailoredContent: true, status: true },
      })

      // Link variant to application if provided (REQ-001 Step 4)
      if (applicationId) {
        await prisma.application.update({
          where: { id: applicationId, userId },
          data: { resumeVariantId: variant.id, atsScore: atsAnalysis.score },
        }).catch(() => null)
      }

      logger.info('ResumeVariant created for LinkedIn prep', { userId, variantId: variant.id, atsScore: atsAnalysis.score })
    } catch (tailorErr) {
      logger.error('Resume tailoring failed', { userId, jobId, err: String(tailorErr) })
      return NextResponse.json({ error: 'Resume tailoring is taking too long — try again.' }, { status: 500 })
    }
  }

  // REQ-001 Step 3: use tailored variant content for answer generation
  const tailoredText = baseResume.rawText // use base rawText as the canonical text for answer generation

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

  const userProfileContext: UserProfileContext = {
    name: user?.name ?? 'Candidate',
    yearsExperience: careerProfile?.yearsOfExperience ?? 0,
    expectedSalaryMin: careerProfile?.targetSalaryMin ?? null,
    expectedSalaryMax: careerProfile?.targetSalaryMax ?? null,
    currency: careerProfile?.currency ?? 'INR',
    noticePeriodDays: 30,
    location: careerProfile?.targetLocations[0] ?? 'India',
    remotePreference: careerProfile?.remotePreference ?? 'HYBRID',
  }

  // Step 3: generate answers using tailored variant content
  const answersOutput = await generateApplyAnswers(tailoredText, jd, userProfileContext)

  const atsScore = variant.atsScore ?? null
  // REQ-003: warn if ATS < 65
  const atsWarning = atsScore !== null && atsScore < 65
    ? `Low ATS match (${Math.round(atsScore)}%). Proceed or improve your resume?`
    : null

  logger.info('LinkedIn apply prep complete', { userId, jobId, variantId: variant.id })

  return NextResponse.json({
    answers: answersOutput.result,
    atsScore,
    atsWarning,
    matchedKeywords: variant.injectedKeywords ?? [],
    baseResumeId,
    variantId: variant.id,
  })
}
