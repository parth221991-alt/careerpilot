'use client'

import { useState } from 'react'
import { Send, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Props = {
  applicationId: string
  ghostedAt: Date
  recipientEmail?: string
}

export function FollowUpPanel({ applicationId, ghostedAt, recipientEmail }: Props) {
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [reconnectNeeded, setReconnectNeeded] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/email/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const data = await res.json() as { draft?: string; subject?: string; threadId?: string | null; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to generate draft'); return }
      setDraft(data.draft ?? null)
      setSubject(data.subject ?? null)
      setThreadId(data.threadId ?? null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!draft || !recipientEmail || !subject) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          body: draft,
          applicationId,
          ...(threadId ? { threadId } : {}),
        }),
      })
      if (res.status === 401) {
        setReconnectNeeded(true)
        return
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Send failed — try again.')
        return
      }
      setSent(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-profit/5 border border-profit/20 rounded-lg p-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-profit shrink-0" />
        <p className="text-profit text-xs font-medium">Follow-up sent to {recipientEmail}</p>
      </div>
    )
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

      {error && <p className="text-loss text-xs">{error}</p>}

      {reconnectNeeded && (
        <div className="flex items-center gap-2 p-2 bg-loss/5 border border-loss/20 rounded">
          <p className="text-loss text-xs flex-1">Gmail session expired.</p>
          <a href="/api/email/oauth/start"
             className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            Reconnect Gmail
          </a>
        </div>
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
            <button
              onClick={() => void navigator.clipboard.writeText(draft)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Copy
            </button>
            {recipientEmail ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors"
              >
                {sending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Send className="w-3 h-3" />}
                {sending ? 'Sending...' : `Send to ${recipientEmail}`}
              </button>
            ) : (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                No recruiter email on file — copy and send manually.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
