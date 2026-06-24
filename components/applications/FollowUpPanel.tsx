'use client'

import { useState } from 'react'
import { Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Props = {
  applicationId: string
  ghostedAt: Date
}

export function FollowUpPanel({ applicationId, ghostedAt }: Props) {
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/email/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const data = await res.json() as { draft?: string; subject?: string; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to generate draft'); return }
      setDraft(data.draft ?? null)
      setSubject(data.subject ?? null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 text-xs font-medium">No reply detected</p>
          <p className="text-muted-foreground text-[10px] mt-0.5">
            Ghosted {formatDistanceToNow(new Date(ghostedAt), { addSuffix: true })} — send a follow-up?
          </p>
        </div>
      </div>

      {error && (
        <p className="text-loss text-xs">{error}</p>
      )}

      {!draft ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-3 py-1.5 rounded-md transition-colors disabled:opacity-60"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Send className="w-3.5 h-3.5" />}
          Generate Follow-up Draft
        </button>
      ) : (
        <div className="space-y-2">
          {subject && (
            <p className="text-[10px] text-muted-foreground">
              Subject: <span className="text-foreground">{subject}</span>
            </p>
          )}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            className="w-full bg-muted border border-border rounded-md p-3 text-xs text-foreground leading-relaxed resize-none focus:outline-none focus:border-amber-500/50"
          />
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground flex-1">
              Review, edit, then send manually from your email client.
            </p>
            <button
              onClick={() => void navigator.clipboard.writeText(draft)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
