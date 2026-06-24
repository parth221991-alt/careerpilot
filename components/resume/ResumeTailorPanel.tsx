'use client'

import { useState } from 'react'
import { Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Job = {
  id: string
  title: string
  company: string
  location: string | null
  matchScore: number | null
}

type Props = {
  baseResumeId: string
  recentJobs: Job[]
}

type TailorResult = {
  variantId: string
  atsScore: number
  keywordCoverage: number
  injectedKeywords: string[]
  missingKeywords: string[]
  reasoning: string
}

type Mode = 'job' | 'jd'

export function ResumeTailorPanel({ baseResumeId, recentJobs }: Props) {
  const [mode, setMode] = useState<Mode>('job')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [rawJD, setRawJD] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TailorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function tailor() {
    if (loading) return
    if (mode === 'job' && !selectedJobId) return
    if (mode === 'jd' && (!rawJD.trim() || !jobTitle.trim())) return

    setLoading(true)
    setError(null)
    setResult(null)

    const body = mode === 'job'
      ? { baseResumeId, jobId: selectedJobId }
      : { baseResumeId, rawJD, jobTitle, company }

    const res = await fetch('/api/resume/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setResult(await res.json())
    } else {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      setError(data.error ?? 'Request failed')
    }
    setLoading(false)
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="font-chivo font-bold text-sm text-foreground">Tailor Resume</h3>
        </div>
        <p className="text-muted-foreground text-[10px] mt-0.5">
          Claude rewrites bullets to match the target role
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode tabs */}
        <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
          {(['job', 'jd'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 text-xs py-1.5 rounded transition-colors font-medium',
                mode === m
                  ? 'bg-card text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'job' ? 'From saved job' : 'Paste JD'}
            </button>
          ))}
        </div>

        {mode === 'job' ? (
          <div className="relative">
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="w-full appearance-none bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-8"
            >
              <option value="">Select a job...</option>
              {recentJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company}
                  {j.matchScore ? ` (${Math.round(j.matchScore)}%)` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="Job title *"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Company name"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={rawJD}
              onChange={e => setRawJD(e.target.value)}
              placeholder="Paste the full job description here *"
              rows={8}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        )}

        <button
          onClick={tailor}
          disabled={loading || (mode === 'job' ? !selectedJobId : !rawJD.trim() || !jobTitle.trim())}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Tailoring with Claude...' : 'Generate Tailored Resume'}
        </button>

        {error && (
          <p className="text-loss text-xs">{error}</p>
        )}

        {result && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/40 rounded p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ATS Score</p>
                <p className={`text-lg font-chivo font-bold numeric mt-0.5 ${
                  result.atsScore >= 80 ? 'text-profit' : result.atsScore >= 60 ? 'text-yellow-400' : 'text-loss'
                }`}>
                  {Math.round(result.atsScore)}
                </p>
              </div>
              <div className="bg-muted/40 rounded p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Keyword Coverage</p>
                <p className={`text-lg font-chivo font-bold numeric mt-0.5 ${
                  result.keywordCoverage >= 80 ? 'text-profit' : result.keywordCoverage >= 60 ? 'text-yellow-400' : 'text-loss'
                }`}>
                  {Math.round(result.keywordCoverage)}%
                </p>
              </div>
            </div>

            {result.injectedKeywords.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Added keywords</p>
                <div className="flex flex-wrap gap-1">
                  {result.injectedKeywords.map(k => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 bg-profit/10 border border-profit/20 text-profit rounded">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.missingKeywords.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Still missing</p>
                <div className="flex flex-wrap gap-1">
                  {result.missingKeywords.slice(0, 8).map(k => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 bg-loss/10 border border-loss/20 text-loss rounded">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <a
              href={`/api/resume/${result.variantId}/pdf`}
              className="block text-center text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-2 rounded-md transition-colors"
            >
              Download PDF
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
