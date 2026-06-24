'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, CheckCircle } from 'lucide-react'
import type { AppStatus } from '@prisma/client'
import Link from 'next/link'

type Props = {
  applicationId: string
  hasPrep: boolean
  status: AppStatus
}

const INTERVIEW_STAGES: AppStatus[] = ['HR_ROUND', 'TECHNICAL_ROUND', 'MANAGER_ROUND']

export function InterviewPrepTrigger({ applicationId, hasPrep, status }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(hasPrep)
  const [prepId, setPrepId] = useState<string | null>(null)

  const isInterviewStage = INTERVIEW_STAGES.includes(status)
  if (!isInterviewStage) return null

  async function generate() {
    setLoading(true)
    const res = await fetch('/api/interview/prep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId }),
    })
    if (res.ok) {
      const data = await res.json()
      setPrepId(data.prepId)
      setDone(true)
    }
    setLoading(false)
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <h3 className="font-chivo font-bold text-sm text-foreground">Interview Prep</h3>
      </div>

      {done ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-profit text-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Prep ready</span>
          </div>
          {prepId && (
            <Link href={`/interview/${prepId}`}
                  className="block text-center text-xs border border-indigo-600/30 text-indigo-400 hover:bg-indigo-600/10 px-3 py-1.5 rounded-md transition-colors">
              View Prep
            </Link>
          )}
          <button onClick={generate} disabled={loading}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1 disabled:opacity-50">
            Regenerate
          </button>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md transition-colors"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Generating...' : 'Generate Interview Prep'}
        </button>
      )}
      <p className="text-muted-foreground text-[10px] mt-2 text-center">
        AI-generated from your Career Vault + JD
      </p>
    </div>
  )
}
