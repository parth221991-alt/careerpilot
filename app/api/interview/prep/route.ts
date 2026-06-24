import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { generateInterviewPrep } from '@/lib/claude/agents/InterviewAgent'
import { createLogger } from '@/lib/utils/logger'
import { z } from 'zod'

const logger = createLogger('interview-prep')

const PrepSchema = z.object({ applicationId: z.string().uuid() })

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = PrepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { applicationId } = parsed.data

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { job: true },
  })

  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const profile = await prisma.careerProfile.findUnique({ where: { userId } })

  try {
    logger.info('Running InterviewAgent', { userId, applicationId })

    const output = await generateInterviewPrep(
      userId,
      application.job.title,
      application.job.company,
      application.job.rawDescription ?? application.job.description ?? '',
      profile?.yearsOfExperience ?? 0,
      profile?.targetSalaryMin ?? null,
      profile?.targetSalaryMax ?? null,
      application.job.location ?? 'India',
    )

    const prep = output.result

    const saved = await prisma.interviewPrep.create({
      data: {
        applicationId,
        userId,
        companyBrief: prep.company_brief as object,
        techQuestions: prep.tech_questions as object,
        behavioralStories: prep.behavioral_stories as object,
        salaryStrategy: prep.salary_strategy as object,
      },
    })

    logger.info('Interview prep created', { userId, prepId: saved.id })

    return NextResponse.json({ prepId: saved.id, prep })
  } catch (err) {
    logger.error('InterviewAgent failed', { userId, err: String(err) })
    return NextResponse.json({ error: 'AI prep generation failed — please try again' }, { status: 500 })
  }
}
