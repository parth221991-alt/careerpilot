import type { Platform } from '@prisma/client'

export type RawJob = {
  platformJobId: string
  title: string
  company: string
  location: string | null
  isRemote: boolean
  remoteType: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE' | null
  description: string
  url: string
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string
  postedAt?: Date | null
  source: Platform
}

export type JobProfileConfig = {
  id: string
  userId: string
  targetRoles: string[]
  targetLocations: string[]
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  preferredSources: Platform[]
}
