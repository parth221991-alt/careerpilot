/**
 * BullMQ worker for auto-apply via Playwright (Naukri only).
 * Start with: npx tsx workers/apply.ts
 *
 * Rate limits and delays are configurable via env vars:
 *   NAUKRI_MIN_DELAY_MS (default: 180000 = 3 min)
 *   NAUKRI_MAX_DELAY_MS (default: 480000 = 8 min)
 */

import { Worker, type Job as BullJob } from 'bullmq'
import { chromium, type BrowserContext } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../lib/db/prisma'
import { redis } from '../lib/redis/client'
import { createLogger } from '../lib/utils/logger'
import type { ApplyJob } from '../lib/redis/queue'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const logger = createLogger('apply-worker')

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}
const MIN_DELAY = Number(process.env.NAUKRI_MIN_DELAY_MS ?? 180_000)
const MAX_DELAY = Number(process.env.NAUKRI_MAX_DELAY_MS ?? 480_000)

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function getDailyKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD IST approximation
  return `naukri:daily:${userId}:${today}`
}

async function getDailyLimit(applicantData: Record<string, string>): Promise<number> {
  if (applicantData.profileId) {
    try {
      const profile = await prisma.jobProfile.findUnique({
        where: { id: applicantData.profileId },
        select: { dailyApplyLimit: true },
      })
      return profile?.dailyApplyLimit ?? 10
    } catch {
      return 10
    }
  }
  return 10
}

async function checkDailyLimit(userId: string, limit: number): Promise<boolean> {
  const key = getDailyKey(userId)
  const count = await redis.get(key)
  return Number(count ?? 0) < limit
}

async function incrementDailyCount(userId: string): Promise<void> {
  const key = getDailyKey(userId)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  const ttl = Math.floor((endOfDay.getTime() - Date.now()) / 1000)
  await redis.multi().incr(key).expire(key, ttl).exec()
}

// REQ-017: Load Naukri session from Supabase Storage (not local file)
async function loadNaukriSession(userId: string): Promise<{ cookies: Record<string, string>[] } | null> {
  try {
    const supabase = getSupabaseClient()
    const storagePath = `naukri/${userId}/session.json`
    const { data, error } = await supabase.storage.from('sessions').download(storagePath)
    if (error || !data) return null
    const json = await data.text()
    return JSON.parse(json) as { cookies: Record<string, string>[] }
  } catch {
    return null
  }
}

async function detectAndHandleCaptcha(context: BrowserContext, userId: string): Promise<boolean> {
  const page = context.pages()[0]
  if (!page) return false

  const hasCaptcha = await page.evaluate(() => {
    return !!(
      document.querySelector('iframe[src*="captcha"]') ||
      document.querySelector('.h-captcha') ||
      document.querySelector('#captcha') ||
      document.querySelector('[data-hcaptcha-widget-id]')
    )
  })

  if (!hasCaptcha) return false

  logger.warn('CAPTCHA detected — notifying user', { userId })

  await prisma.notification.create({
    data: {
      userId,
      type: 'CAPTCHA_REQUIRED',
      title: 'CAPTCHA required for Naukri apply',
      body: 'CareerPilot detected a CAPTCHA on Naukri. Please solve it in the browser window, then the apply will resume automatically.',
      extra: {},
    },
  })

  // Wait up to 5 minutes for user to solve
  const maxWait = 300_000
  const pollInterval = 5_000
  let waited = 0

  while (waited < maxWait) {
    await sleep(pollInterval)
    waited += pollInterval

    const stillHasCaptcha = await page.evaluate(() => {
      return !!(
        document.querySelector('iframe[src*="captcha"]') ||
        document.querySelector('.h-captcha') ||
        document.querySelector('#captcha')
      )
    }).catch(() => false)

    if (!stillHasCaptcha) {
      logger.info('CAPTCHA resolved', { userId })
      return true
    }
  }

  logger.warn('CAPTCHA not resolved within timeout', { userId })
  return false
}

const worker = new Worker<ApplyJob>(
  'apply',
  async (job: BullJob<ApplyJob>) => {
    const { userId, applicationId, jobUrl, platform, applicantData } = job.data

    logger.info('Apply job started', { userId, applicationId, platform })

    if (platform !== 'NAUKRI') {
      logger.warn('Platform not supported for auto-apply', { platform })
      await prisma.application.update({
        where: { id: applicationId },
        data: { notes: `Auto-apply not supported for ${platform}. Apply manually at: ${jobUrl}` },
      })
      return
    }

    // Verify approval gate still approved
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId },
      include: { approvalGates: { where: { status: 'APPROVED' }, take: 1 } },
    })

    if (!application || application.approvalGates.length === 0) {
      throw new Error('No approved gate — aborting apply')
    }

    // Rate limit check
    const dailyLimit = await getDailyLimit(applicantData as Record<string, string>)
    const withinLimit = await checkDailyLimit(userId, dailyLimit)
    if (!withinLimit) {
      // REQ-009: Delay to next day 9:00 AM IST via BullMQ delay option (not a retry)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      logger.info('Daily apply limit reached — delaying job to 9AM IST', { userId, nextRun: tomorrow.toISOString() })
      await job.moveToDelayed(tomorrow.getTime(), job.token)
      return
    }

    // Load session (REQ-017: from Supabase Storage)
    const sessionData = await loadNaukriSession(userId)
    if (!sessionData) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'NO_SESSION',
          title: 'Naukri session not configured',
          body: 'Run: npx tsx workers/scrapers/naukri-login.ts to set up your Naukri session.',
          extra: {},
        },
      })
      throw new Error('NO_SESSION: Naukri session not found')
    }

    const isHeadless = process.env.NODE_ENV === 'production'
    const browser = await chromium.launch({ headless: isHeadless, slowMo: 100 })
    const context = await browser.newContext()

    try {
      await context.addCookies(sessionData.cookies as unknown as Parameters<typeof context.addCookies>[0])

      const page = await context.newPage()
      await page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 30_000 })

      // EDGE-001: Check for session expiry (redirect to login)
      if (page.url().includes('/login') || page.url().includes('/nlogin')) {
        await prisma.notification.create({
          data: {
            userId,
            type: 'SESSION_EXPIRED',
            title: 'Naukri session expired',
            body: 'Your Naukri session has expired. Run: npx tsx workers/scrapers/naukri-login.ts',
            extra: {},
          },
        })
        throw new Error('SESSION_EXPIRED')
      }

      // EDGE-002: Job no longer available
      const isJobClosed = await page.evaluate(() => {
        const text = document.body?.innerText?.toLowerCase() ?? ''
        return text.includes('job closed') || text.includes('no longer accepting')
      })

      if (isJobClosed || page.url().includes('404')) {
        await prisma.job.updateMany({ where: { url: jobUrl }, data: { isActive: false } })
        await prisma.application.update({
          where: { id: applicationId },
          data: { status: 'WITHDRAWN', notes: 'Job no longer available' },
        })
        logger.info('Job marked closed', { applicationId, jobUrl })
        await browser.close()
        return
      }

      // Check for CAPTCHA before clicking Apply
      await detectAndHandleCaptcha(context, userId)

      // Click Apply button
      const applyBtn = page.locator('button:has-text("Apply"), a:has-text("Apply Now"), [class*="apply"]').first()
      await applyBtn.waitFor({ timeout: 10_000 })
      await applyBtn.click()
      await page.waitForTimeout(3000)

      // Handle any CAPTCHA that appears after clicking
      const captchaCleared = await detectAndHandleCaptcha(context, userId)
      if (!captchaCleared) {
        const hasCaptchaNow = await page.evaluate(() =>
          !!(document.querySelector('iframe[src*="captcha"]') || document.querySelector('.h-captcha'))
        )
        if (hasCaptchaNow) throw new Error('CAPTCHA not resolved within timeout')
      }

      // Wait for application success confirmation
      await page.waitForTimeout(5000)

      // Capture screenshot — store in Supabase Storage bucket "screenshots" (REQ-008/STD-004)
      const screenshotBuffer = await page.screenshot()
      let screenshotPath = `${userId}/${applicationId}.png`
      try {
        const supabase = getSupabaseClient()
        const { error: screenshotErr } = await supabase.storage
          .from('screenshots')
          .upload(screenshotPath, screenshotBuffer, { contentType: 'image/png', upsert: true })
        if (screenshotErr) {
          logger.warn('Screenshot upload failed (non-fatal)', { applicationId, err: screenshotErr.message })
          screenshotPath = ''
        }
      } catch (screenshotUploadErr) {
        logger.warn('Supabase Storage unavailable for screenshot (non-fatal)', { err: String(screenshotUploadErr) })
        screenshotPath = ''
      }

      // Increment daily counter
      await incrementDailyCount(userId)

      // Mark application as APPLIED
      await prisma.$transaction([
        prisma.application.update({
          where: { id: applicationId },
          data: {
            status: 'APPLIED',
            isAutoApplied: true,
            appliedAt: new Date(),
            screenshotPath,
          },
        }),
        prisma.statusHistory.create({
          data: {
            applicationId,
            userId,
            fromStatus: 'APPROVAL_PENDING',
            toStatus: 'APPLIED',
            triggeredBy: 'AI_AGENT',
            note: 'Naukri auto-apply completed',
          },
        }),
      ])

      logger.info('Apply completed successfully', { userId, applicationId })

      // Human-like delay before next job
      const delay = randomBetween(MIN_DELAY, MAX_DELAY)
      logger.info('Waiting before next apply', { delayMs: delay })
      await sleep(delay)

    } finally {
      await browser.close()
    }
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 1, // REQ-023: always 1, mimic human behavior
  }
)

worker.on('failed', async (job, err) => {
  logger.error('Apply job failed', { jobId: job?.id, err: err.message })

  if (job?.data.applicationId) {
    try {
      // EDGE-007: On all retries exhausted, reset to APPROVAL_PENDING
      const attemptsMade = job.attemptsMade ?? 0
      const maxAttempts = 3

      if (attemptsMade >= maxAttempts) {
        await prisma.$transaction([
          prisma.application.update({
            where: { id: job.data.applicationId },
            data: {
              status: 'APPROVAL_PENDING',
              notes: `Auto-apply failed after ${maxAttempts} attempts: ${err.message}`,
            },
          }),
          prisma.notification.create({
            data: {
              userId: job.data.userId,
              type: 'APPLY_FAILED',
              title: 'Auto-apply failed',
              body: `Could not apply automatically. Please apply manually or try again.`,
              extra: { applicationId: job.data.applicationId, error: err.message },
            },
          }),
        ])
      }
    } catch (updateErr) {
      logger.error('Failed to reset application status', { err: String(updateErr) })
    }
  }
})

logger.info('Apply worker started', { minDelay: MIN_DELAY, maxDelay: MAX_DELAY })
