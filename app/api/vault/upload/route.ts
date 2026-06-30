import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { runVaultAgent } from '@/lib/claude/agents/VaultAgent'
import { embedBatch } from '@/lib/embedding/voyage'
import { upsertPoints } from '@/lib/qdrant/search'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('vault-upload')

const VALID_SKILL_CATS = new Set(['LANGUAGE', 'FRAMEWORK', 'CLOUD', 'DATABASE', 'TOOL', 'METHODOLOGY', 'SOFT'])
const SKILL_CAT_ALIASES: Record<string, string> = {
  PROGRAMMING: 'LANGUAGE', PROGRAMMING_LANGUAGE: 'LANGUAGE', SCRIPTING: 'LANGUAGE', MARKUP: 'LANGUAGE',
  LIBRARY: 'FRAMEWORK', LIBRARIES: 'FRAMEWORK', RUNTIME: 'FRAMEWORK', PLATFORM: 'FRAMEWORK',
  DEVOPS: 'TOOL', CI_CD: 'TOOL', TESTING: 'TOOL', TOOL_AND_TECHNOLOGY: 'TOOL', TOOLS: 'TOOL',
  INFRASTRUCTURE: 'CLOUD', AWS: 'CLOUD', AZURE: 'CLOUD', GCP: 'CLOUD',
  DATABASES: 'DATABASE', DATA: 'DATABASE', STORAGE: 'DATABASE',
  PROCESS: 'METHODOLOGY', AGILE: 'METHODOLOGY', MANAGEMENT: 'METHODOLOGY',
  INTERPERSONAL: 'SOFT', COMMUNICATION: 'SOFT', LEADERSHIP: 'SOFT',
}
function normalizeSkillCat(raw: string): string {
  const upper = raw?.toUpperCase().replace(/[^A-Z_]/g, '_') ?? 'TOOL'
  if (VALID_SKILL_CATS.has(upper)) return upper
  return SKILL_CAT_ALIASES[upper] ?? 'TOOL'
}

const VALID_PROFICIENCIES = new Set(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
function normalizeProficiency(raw: string): string {
  const upper = raw?.toUpperCase() ?? 'INTERMEDIATE'
  if (VALID_PROFICIENCIES.has(upper)) return upper
  if (upper.includes('BEGINNER') || upper.includes('BASIC') || upper.includes('JUNIOR')) return 'BEGINNER'
  if (upper.includes('EXPERT') || upper.includes('SENIOR') || upper.includes('MASTER')) return 'EXPERT'
  if (upper.includes('ADVANCED')) return 'ADVANCED'
  return 'INTERMEDIATE'
}

function safeDate(val: string | null | undefined, fallback?: Date): Date | null {
  if (!val) return fallback ?? null
  const d = new Date(val)
  return isNaN(d.getTime()) ? (fallback ?? null) : d
}

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  // REQ-006: optional profileId binds the uploaded resume to a specific job profile
  const profileId = (formData.get('profileId') as string | null) ?? null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Parse PDF text
  let resumeText: string
  try {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    resumeText = data.text
  } catch (err) {
    logger.error('PDF parse failed', { userId, err: String(err) })
    return NextResponse.json({ error: 'Could not parse PDF' }, { status: 422 })
  }

  if (resumeText.trim().length < 100) {
    return NextResponse.json({ error: 'PDF appears to be empty or image-only' }, { status: 422 })
  }

  try {
    logger.info('Running VaultAgent', { userId, chars: resumeText.length })
    const agentOutput = await runVaultAgent(userId, resumeText, crypto.randomUUID())
    const extraction = agentOutput.result

    // Upsert career profile
    const profile = await prisma.careerProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: extraction.headline,
        summary: extraction.summary,
        yearsOfExperience: extraction.experiences.reduce((max: number, e: { startDate: string; endDate?: string | null; isCurrent: boolean }) => {
          const start = new Date(e.startDate).getFullYear()
          const end = e.isCurrent ? new Date().getFullYear() : (e.endDate ? new Date(e.endDate).getFullYear() : start)
          return Math.max(max, end - start)
        }, 0),
        rawResumeText: resumeText,
        lastExtractedAt: new Date(),
      },
      update: {
        headline: extraction.headline,
        summary: extraction.summary,
        rawResumeText: resumeText,
        lastExtractedAt: new Date(),
      },
    })

    // Replace experiences
    await prisma.experience.deleteMany({ where: { careerProfileId: profile.id } })
    await prisma.experience.createMany({
      data: extraction.experiences.map(e => ({
        careerProfileId: profile.id,
        company: e.company,
        title: e.title,
        location: e.location,
        startDate: safeDate(e.startDate) ?? new Date('2000-01-01'),
        endDate: safeDate(e.endDate),
        isCurrent: e.isCurrent,
        description: e.description,
        bullets: e.bullets,
        techStack: e.techStack,
        impactMetrics: (e.impactMetrics ?? {}) as object,
      })),
    })

    // Replace projects
    await prisma.project.deleteMany({ where: { careerProfileId: profile.id } })
    await prisma.project.createMany({
      data: extraction.projects.map(p => ({
        careerProfileId: profile.id,
        name: p.name,
        description: p.description,
        techStack: p.techStack,
        outcomes: p.outcomes,
        url: p.url ?? null,
      })),
    })

    // Replace skills (use upsert for each due to @@unique constraint)
    await prisma.skill.deleteMany({ where: { careerProfileId: profile.id } })
    await prisma.skill.createMany({
      data: extraction.skills.map(s => ({
        careerProfileId: profile.id,
        name: s.name,
        category: normalizeSkillCat(s.category) as 'LANGUAGE' | 'FRAMEWORK' | 'CLOUD' | 'DATABASE' | 'TOOL' | 'METHODOLOGY' | 'SOFT',
        proficiency: normalizeProficiency(s.proficiency) as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT',
        yearsUsed: s.yearsUsed ?? null,
      })),
      skipDuplicates: true,
    })

    // Replace certifications
    await prisma.certification.deleteMany({ where: { careerProfileId: profile.id } })
    await prisma.certification.createMany({
      data: extraction.certifications.map(c => ({
        careerProfileId: profile.id,
        name: c.name,
        issuer: c.issuer,
        issuedAt: safeDate(c.issuedAt) ?? new Date(),
        expiresAt: safeDate(c.expiresAt),
        credentialUrl: c.credentialUrl ?? null,
      })),
    })

    // Replace achievements
    await prisma.achievement.deleteMany({ where: { careerProfileId: profile.id } })
    await prisma.achievement.createMany({
      data: extraction.achievements.map(a => ({
        careerProfileId: profile.id,
        title: a.title,
        description: a.description,
        impact: a.impact ?? null,
        date: safeDate(a.date) ?? new Date(),
      })),
    })

    // Embed experiences, projects, and achievements into Qdrant for semantic search
    try {
      const [dbExperiences, dbProjects, dbAchievements] = await Promise.all([
        prisma.experience.findMany({ where: { careerProfileId: profile.id } }),
        prisma.project.findMany({ where: { careerProfileId: profile.id } }),
        prisma.achievement.findMany({ where: { careerProfileId: profile.id } }),
      ])

      type VaultPoint = { id: string; text: string; type: string; title: string; subtitle: string; snippet: string }
      const points: VaultPoint[] = [
        ...dbExperiences.map(e => ({
          id: e.id,
          text: `${e.title} at ${e.company}: ${e.bullets.slice(0, 3).join(' ')} Tech: ${e.techStack.join(', ')}`,
          type: 'experience',
          title: e.title,
          subtitle: e.company,
          snippet: e.bullets[0] ?? e.description ?? '',
        })),
        ...dbProjects.map(p => ({
          id: p.id,
          text: `Project: ${p.name}. ${p.description} Stack: ${p.techStack.join(', ')} Outcomes: ${p.outcomes.join(', ')}`,
          type: 'project',
          title: p.name,
          subtitle: p.techStack.join(', '),
          snippet: p.description,
        })),
        ...dbAchievements.map(a => ({
          id: a.id,
          text: `Achievement: ${a.title}. ${a.description}${a.impact ? ' Impact: ' + a.impact : ''}`,
          type: 'achievement',
          title: a.title,
          subtitle: a.impact ?? '',
          snippet: a.description,
        })),
      ]

      if (points.length > 0) {
        const vectors = await embedBatch(points.map(p => p.text))
        await upsertPoints('career_vault', points.map((p, i) => ({
          id: p.id,
          vector: vectors[i],
          payload: { userId, type: p.type, title: p.title, subtitle: p.subtitle, snippet: p.snippet },
        })))
        logger.info('Vault embedded to Qdrant', { userId, pointCount: points.length })
      }
    } catch (embedErr) {
      logger.warn('Qdrant embedding failed (non-fatal)', { userId, err: String(embedErr) })
    }

    // REQ-006 + REQ-007: Enforce 10 active resume limit, then create BaseResume row
    const activeCount = await prisma.baseResume.count({ where: { userId, isActive: true } })
    if (activeCount >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active resumes allowed. Deactivate one first.' },
        { status: 422 }
      )
    }

    const resumeId = crypto.randomUUID()

    // Upload PDF to Supabase Storage bucket "resumes"
    let filePath: string | null = null
    try {
      const supabase = await createServiceClient()
      const storagePath = `${userId}/${resumeId}/${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('resumes')
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(storagePath)
        filePath = urlData?.publicUrl ?? null
      } else {
        logger.warn('Supabase Storage upload failed (non-fatal)', { userId, err: String(uploadErr) })
      }
    } catch (storageErr) {
      logger.warn('Supabase Storage unavailable (non-fatal)', { userId, err: String(storageErr) })
    }

    // Validate profileId belongs to this user if provided
    if (profileId) {
      const profileExists = await prisma.jobProfile.findFirst({
        where: { id: profileId, userId, isActive: true },
        select: { id: true },
      })
      if (!profileExists) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }
    }

    await prisma.baseResume.create({
      data: {
        id: resumeId,
        userId,
        careerProfileId: profile.id,
        label: `Resume ${new Date().toLocaleDateString('en-IN')}`,
        content: extraction as unknown as object,
        rawText: resumeText,
        filePath,
        fileName: file.name,
        isActive: true,
        jobProfileId: profileId,
      },
    })

    logger.info('VaultAgent complete', {
      userId,
      experiences: extraction.experiences?.length ?? 0,
      skills: extraction.skills?.length ?? 0,
      resumeId,
      jobProfileId: profileId,
    })

    return NextResponse.json({
      success: true,
      resumeId,
      experienceCount: extraction.experiences?.length ?? 0,
      skillCount: extraction.skills?.length ?? 0,
      projectCount: extraction.projects?.length ?? 0,
      certCount: extraction.certifications?.length ?? 0,
    })
  } catch (err) {
    logger.error('VaultAgent failed', { userId, err: String(err) })
    return NextResponse.json({ error: 'AI extraction failed — please try again' }, { status: 500 })
  }
}
