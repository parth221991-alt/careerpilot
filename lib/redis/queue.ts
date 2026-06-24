import { Queue, Worker, type Job } from 'bullmq'
import { redis } from './client'

const connection = { host: 'localhost', port: 6379 }

// ── Queue definitions ─────────────────────────────────────────────────────────

export const scraperQueue = new Queue('scraper', { connection })
export const applyQueue = new Queue('apply', { connection })
export const emailQueue = new Queue('email', { connection })
export const discoverQueue = new Queue('discover', { connection })

// ── Job types ─────────────────────────────────────────────────────────────────

export type ScrapeJob = {
  userId: string
  platform: 'LINKEDIN' | 'NAUKRI' | 'INDEED' | 'WELLFOUND'
  queries: string[]
  maxJobs: number
  lookbackDays: number
}

export type DiscoverJob = {
  userId: string
  jobProfileId: string
  candidateProfileText: string
}

export type ApplyJob = {
  userId: string
  applicationId: string
  jobUrl: string
  platform: string
  resumePdfPath: string
  applicantData: Record<string, string>
}

export type EmailPollJob = {
  userId: string
  gmailToken: Record<string, string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function enqueueScrape(data: ScrapeJob) {
  return scraperQueue.add('scrape', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  })
}

export async function enqueueApply(data: ApplyJob) {
  return applyQueue.add('apply', data, {
    attempts: 3,
    backoff: { type: 'fixed', delay: 60_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  })
}

export async function enqueueDiscover(data: DiscoverJob) {
  return discoverQueue.add('discover', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 50 },
  })
}

// ── Cache helpers (job dedup) ─────────────────────────────────────────────────

const JOB_DEDUP_TTL = 604800 // 7 days

export async function isJobSeen(userId: string, platformJobId: string): Promise<boolean> {
  const key = `job_seen:${userId}:${platformJobId}`
  return (await redis.exists(key)) === 1
}

export async function markJobSeen(userId: string, platformJobId: string): Promise<void> {
  const key = `job_seen:${userId}:${platformJobId}`
  await redis.setex(key, JOB_DEDUP_TTL, '1')
}
