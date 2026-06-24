/**
 * LinkedIn Playwright scraper — uses a saved browser session (cookie file) so
 * we never send credentials at runtime.
 *
 * First-time setup:
 *   npx tsx workers/scrapers/linkedin-login.ts
 * This opens a real browser for manual login, then saves cookies to
 * playwright-sessions/linkedin.json so all subsequent scrapes reuse the session.
 */

import { chromium, type BrowserContext } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import type { ScrapeJob } from '../../lib/redis/queue'
import { createLogger } from '../../lib/utils/logger'

const logger = createLogger('scraper-linkedin')

const SESSION_FILE = path.join(process.cwd(), 'playwright-sessions', 'linkedin.json')
const JOBS_SEARCH_URL = 'https://www.linkedin.com/jobs/search'

export type RawJob = {
  platformJobId: string
  title: string
  company: string
  location: string | null
  remoteType: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE' | null
  jobUrl: string
  rawDescription: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function randomDelay(minMs = 1500, maxMs = 3500) {
  return sleep(Math.floor(Math.random() * (maxMs - minMs)) + minMs)
}

async function loadSession(): Promise<object[]> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(
      `LinkedIn session not found at ${SESSION_FILE}.\n` +
      `Run: npx tsx workers/scrapers/linkedin-login.ts to create it.`
    )
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
}

function parseJobId(url: string): string {
  const m = url.match(/\/jobs\/view\/(\d+)/)
  return m ? m[1] : url.split('?')[0].split('/').filter(Boolean).pop() ?? url
}

function parseRemoteType(text: string): RawJob['remoteType'] {
  const t = text.toLowerCase()
  if (t.includes('remote')) return 'REMOTE'
  if (t.includes('hybrid')) return 'HYBRID'
  if (t.includes('on-site') || t.includes('onsite') || t.includes('in-office')) return 'ONSITE'
  return null
}

async function scrapeQuery(
  context: BrowserContext,
  query: string,
  location: string,
  maxJobs: number,
): Promise<RawJob[]> {
  const page = await context.newPage()
  const collected: RawJob[] = []

  try {
    const searchUrl = new URL(JOBS_SEARCH_URL)
    searchUrl.searchParams.set('keywords', query)
    searchUrl.searchParams.set('location', location)
    searchUrl.searchParams.set('f_TPR', 'r604800') // past 7 days
    searchUrl.searchParams.set('sortBy', 'DD') // date

    logger.info('Navigating to LinkedIn Jobs', { query, location })
    await page.goto(searchUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await sleep(2000)

    // Check if we're logged in — LinkedIn redirects to login if not
    if (page.url().includes('/login') || page.url().includes('/authwall')) {
      throw new Error('LinkedIn session expired. Re-run linkedin-login.ts')
    }

    // Scroll and collect job cards
    let attempts = 0
    while (collected.length < maxJobs && attempts < 10) {
      attempts++

      const cards = await page.locator('[data-job-id]').all()

      for (const card of cards) {
        if (collected.length >= maxJobs) break

        try {
          const jobId = await card.getAttribute('data-job-id')
          if (!jobId) continue

          if (collected.some(j => j.platformJobId === jobId)) continue

          await card.click()
          await sleep(1200)

          const titleEl = await page.locator('.job-details-jobs-unified-top-card__job-title').first()
          const companyEl = await page.locator('.job-details-jobs-unified-top-card__company-name').first()
          const locationEl = await page.locator('.job-details-jobs-unified-top-card__primary-description-container').first()
          const descEl = await page.locator('.jobs-description__content').first()

          const title = (await titleEl.textContent({ timeout: 3000 }))?.trim() ?? ''
          const company = (await companyEl.textContent({ timeout: 3000 }))?.trim() ?? ''
          const locationText = (await locationEl.textContent({ timeout: 3000 }))?.trim() ?? ''
          const description = (await descEl.textContent({ timeout: 5000 }))?.trim() ?? ''

          if (!title || !company) continue

          const jobUrl = `https://www.linkedin.com/jobs/view/${jobId}`

          collected.push({
            platformJobId: jobId,
            title,
            company,
            location: locationText.split('·')[0]?.trim() ?? null,
            remoteType: parseRemoteType(locationText),
            jobUrl,
            rawDescription: description,
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
          })

          logger.info('Collected job', { title, company, jobId })
          await randomDelay(800, 2000)
        } catch {
          // Skip individual card errors — continue to next
        }
      }

      if (collected.length < maxJobs) {
        // Try to load more jobs
        const nextBtn = page.locator('button[aria-label*="next"]').first()
        const hasNext = await nextBtn.count() > 0
        if (!hasNext) break

        await nextBtn.click()
        await sleep(2500)
      }
    }
  } finally {
    await page.close()
  }

  return collected
}

export async function scrapeLinkedin(job: ScrapeJob): Promise<RawJob[]> {
  const cookies = await loadSession()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  })
  await context.addCookies(cookies as Parameters<typeof context.addCookies>[0])

  const allJobs: RawJob[] = []
  const perQueryMax = Math.ceil(job.maxJobs / job.queries.length)

  try {
    for (const query of job.queries) {
      const jobs = await scrapeQuery(context, query, 'India', perQueryMax)
      allJobs.push(...jobs)
      await randomDelay(3000, 6000) // be polite between queries
    }
  } finally {
    await browser.close()
  }

  // Deduplicate by platformJobId
  return Array.from(new Map(allJobs.map(j => [j.platformJobId, j])).values())
}
