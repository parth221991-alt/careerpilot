'use client'

import { useState } from 'react'
import { Search, Loader2, X } from 'lucide-react'

type Props = { hasProfile: boolean; profileId?: string }

export function DiscoverTrigger({ hasProfile, profileId }: Props) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<'LINKEDIN' | 'NAUKRI' | 'INDEED' | 'WELLFOUND'>('LINKEDIN')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDiscover() {
    setLoading(true)

    // Profile-based discovery path (no manual query required)
    if (profileId) {
      const res = await fetch('/api/jobs/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      setLoading(false)
      if (res.ok) { setDone(true); setTimeout(() => { setDone(false); window.location.reload() }, 3000) }
      return
    }

    if (!query.trim()) { setLoading(false); return }

    const res = await fetch('/api/jobs/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        queries: query.split(',').map(q => q.trim()).filter(Boolean),
        maxJobs: 50,
        lookbackDays: 7,
      }),
    })

    setLoading(false)
    if (res.ok) {
      setDone(true)
      setOpen(false)
      setTimeout(() => { setDone(false); window.location.reload() }, 3000)
    }
  }

  if (!hasProfile) {
    return (
      <span className="text-xs text-muted-foreground px-3 py-1.5 border border-border rounded-md">
        Upload resume first
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => profileId ? handleDiscover() : setOpen(true)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md transition-colors"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        {profileId ? 'Discover' : 'Discover Jobs'}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-chivo font-bold text-foreground">Discover Jobs</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide block mb-1.5">Platform</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['LINKEDIN', 'NAUKRI', 'INDEED', 'WELLFOUND'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`py-1.5 rounded text-xs font-medium transition-colors ${
                        platform === p
                          ? 'bg-indigo-600 text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p === 'WELLFOUND' ? 'WF' : p === 'LINKEDIN' ? 'LI' : p === 'NAUKRI' ? 'NK' : 'IN'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide block mb-1.5">
                  Job titles (comma-separated)
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Data Engineer, Azure Data Engineer, Databricks..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <button
                onClick={handleDiscover}
                disabled={loading || !query.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Queuing discovery...' : 'Start Discovery'}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Discovery runs in the background. Jobs appear in 2–5 minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed bottom-6 right-6 bg-profit/10 border border-profit/30 text-profit text-sm px-4 py-3 rounded-lg">
          Discovery queued! Jobs will appear shortly.
        </div>
      )}
    </>
  )
}
