import { XMLParser } from 'fast-xml-parser'
import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-weworkremotely')

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  allowBooleanAttributes: true,
})

interface WwrItem {
  title?: string | { __cdata?: string }
  link?: string
  pubDate?: string
  description?: string | { __cdata?: string }
  'dc:company'?: string | { __cdata?: string }
  'dc:region'?: string | { __cdata?: string }
}

function getText(field: string | { __cdata?: string } | undefined): string | undefined {
  if (!field) return undefined
  if (typeof field === 'string') return field.trim()
  return field.__cdata?.trim()
}

function parseRssXml(xml: string): RawJob[] {
  let parsed: { rss?: { channel?: { item?: WwrItem | WwrItem[] } } }

  try {
    parsed = XML_PARSER.parse(xml) as typeof parsed
  } catch (err) {
    logger.warn('fast-xml-parser failed', { err: String(err) })
    return []
  }

  const items = parsed?.rss?.channel?.item
  if (!items) return []

  const list: WwrItem[] = Array.isArray(items) ? items : [items]

  return list.flatMap((item): RawJob[] => {
    const title = getText(item.title)
    const link = getText(item.link as string | undefined)
    if (!title || !link) return []

    const company =
      getText(item['dc:company']) ??
      (/ at (.+)$/.exec(title)?.[1]?.trim()) ??
      'Unknown'

    const regionText = getText(item['dc:region']) ?? 'Worldwide'
    const slug = link.split('/').filter(Boolean).pop() ?? link
    const description = getText(item.description) ?? ''

    return [{
      platformJobId: slug,
      title: title.replace(/ at .+$/, '').trim(),
      company,
      location: regionText,
      isRemote: true,
      remoteType: 'REMOTE',
      description,
      url: link,
      salaryMin: null,
      salaryMax: null,
      postedAt: item.pubDate ? new Date(item.pubDate) : null,
      source: 'WEWORKREMOTELY',
    }]
  })
}

const RSS_FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss',
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-data-science-jobs.rss',
]

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  const targetRolesLower = profile.targetRoles.map(r => r.toLowerCase())
  const allJobs: RawJob[] = []

  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'CareerPilot/1.0' },
      })

      if (!res.ok) {
        logger.warn('WWR RSS non-200', { status: res.status, feedUrl })
        continue
      }

      const xml = await res.text()
      const parsed = parseRssXml(xml)

      const filtered = targetRolesLower.length === 0
        ? parsed
        : parsed.filter(j => {
            const titleLower = j.title.toLowerCase()
            return targetRolesLower.some(role =>
              role.split(/\s+/).some(word => titleLower.includes(word))
            )
          })

      allJobs.push(...filtered)
    } catch (err) {
      logger.error('WWR RSS fetch error', { feedUrl, err: String(err) })
    }
  }

  return Array.from(new Map(allJobs.map(j => [j.platformJobId, j])).values())
}
