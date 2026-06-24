'use client'

import type { Job } from '@prisma/client'
import { useState, useRef, useEffect } from 'react'
import { MapPin, Clock, Bookmark, ExternalLink, Loader2, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils/cn'
import { useRouter } from 'next/navigation'

type Props = { job: Job; isSaved: boolean }

export function JobCard({ job, isSaved: initialSaved }: Props) {
  const [saved, setSaved] = useState(initialSaved)
  const [saving, setSaving] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const applyRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (applyRef.current && !applyRef.current.contains(e.target as Node)) {
        setApplyOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSave() {
    if (saved) return
    setSaving(true)
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id }),
    })
    if (res.ok) setSaved(true)
    setSaving(false)
  }

  // REQ-019: LinkedIn Assisted — save then navigate to application detail
  async function handleLinkedInAssisted() {
    setApplyOpen(false)
    setApplying(true)
    try {
      // Ensure application row exists first
      let applicationId: string | null = null
      const saveRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      if (saveRes.ok) {
        const data = await saveRes.json() as { application?: { id?: string } }
        applicationId = data.application?.id ?? null
        setSaved(true)
      } else if (saveRes.status === 409) {
        // Already saved — fetch existing application id
        const listRes = await fetch(`/api/applications?jobId=${job.id}`)
        if (listRes.ok) {
          const data = await listRes.json() as { applications?: { id?: string }[] }
          applicationId = data.applications?.[0]?.id ?? null
        }
      }
      if (applicationId) {
        router.push(`/applications/${applicationId}?openLinkedIn=1`)
      }
    } finally {
      setApplying(false)
    }
  }

  // REQ-019: Naukri Auto-Apply — POST to apply/naukri
  async function handleNaukriApply() {
    if (!job.jobProfileId) {
      alert('This job is not linked to a Job Profile. Run discovery from a specific profile to enable auto-apply.')
      return
    }
    setApplyOpen(false)
    setApplying(true)
    try {
      const res = await fetch('/api/apply/naukri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, profileId: job.jobProfileId }),
      })
      const data = await res.json() as { status?: string; error?: string }
      if (res.ok) {
        setSaved(true)
        if (data.status === 'queued') {
          alert('Auto-apply queued. Check Applications for progress.')
        } else {
          alert('Application submitted for your approval. Check Applications → Awaiting Approval.')
        }
      } else {
        alert(data.error ?? 'Failed to queue apply job.')
      }
    } finally {
      setApplying(false)
    }
  }

  const score = job.matchScore ? Math.round(job.matchScore) : null
  const scoreColor = score == null ? '' : score >= 80 ? 'text-profit' : score >= 60 ? 'text-yellow-400' : 'text-muted-foreground'

  const isLinkedIn = job.platform === 'LINKEDIN'
  const isNaukri = job.platform === 'NAUKRI'
  const showApplyDropdown = isLinkedIn || isNaukri

  return (
    <div className={cn(
      'bg-card border rounded-lg p-4 flex gap-4 hover:border-indigo-600/30 transition-colors',
      saved ? 'border-indigo-600/30' : 'border-border'
    )}>
      {/* Score */}
      {score != null && (
        <div className="shrink-0 w-14 flex flex-col items-center justify-center">
          <span className={`text-2xl font-chivo font-bold numeric ${scoreColor}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground">match</span>
        </div>
      )}

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-chivo font-bold text-foreground text-sm leading-tight">{job.title}</h3>
            <p className="text-muted-foreground text-xs mt-0.5">{job.company}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {job.platform}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {job.location && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <MapPin className="w-3 h-3" />
              <span>{job.location}</span>
            </div>
          )}
          {job.remoteType && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-medium',
              job.remoteType === 'REMOTE' ? 'bg-profit/10 text-profit' : 'bg-muted text-muted-foreground'
            )}>
              {job.remoteType}
            </span>
          )}
          {job.salaryMin && job.salaryMax && (
            <span className="text-xs font-mono numeric text-muted-foreground">
              ₹{(job.salaryMin / 100000).toFixed(0)}–{(job.salaryMax / 100000).toFixed(0)}L
            </span>
          )}
          <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{formatDistanceToNow(job.discoveredAt, { addSuffix: true })}</span>
          </div>
        </div>

        {job.matchReasoning && (
          <p className="text-muted-foreground text-xs mt-2 line-clamp-2 leading-relaxed">
            {job.matchReasoning}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col gap-1.5">
        {/* REQ-019: Apply button — platform-conditional */}
        {showApplyDropdown ? (
          <div className="relative" ref={applyRef}>
            <button
              onClick={() => setApplyOpen(prev => !prev)}
              disabled={applying}
              className="flex items-center gap-0.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded transition-colors disabled:opacity-60"
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {applyOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 w-44 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                {isLinkedIn && (
                  <button
                    onClick={handleLinkedInAssisted}
                    className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-accent/50 transition-colors"
                  >
                    LinkedIn Assisted
                  </button>
                )}
                {isNaukri && (
                  <button
                    onClick={handleNaukriApply}
                    className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-accent/50 transition-colors"
                  >
                    Auto-Apply Naukri
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          // REQ-019: For non-LinkedIn/Naukri platforms, show Visit Job link
          (job.url || job.jobUrl) && (
            <a
              href={job.url || job.jobUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-border text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded transition-colors"
            >
              Visit Job
            </a>
          )
        )}

        {/* External link for all platforms */}
        {(job.jobUrl || job.url) && (
          <a
            href={job.jobUrl ?? job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-indigo-600/30 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={cn(
            'p-1.5 rounded border transition-colors',
            saved
              ? 'border-indigo-600/40 text-indigo-400 bg-indigo-600/10'
              : 'border-border text-muted-foreground hover:text-indigo-400 hover:border-indigo-600/30'
          )}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
