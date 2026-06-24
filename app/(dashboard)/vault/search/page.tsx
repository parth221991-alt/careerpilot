'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import Link from 'next/link'

type SearchResult = {
  id: string
  score: number
  type: 'experience' | 'project' | 'achievement'
  title: string
  subtitle: string
  snippet: string
}

type SearchResponse = {
  results: SearchResult[]
  query: string
}

export default function VaultSearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState('')

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || loading) return

    setLoading(true)
    const res = await fetch(`/api/vault/search?q=${encodeURIComponent(query)}`)
    if (res.ok) {
      const data: SearchResponse = await res.json()
      setResults(data.results)
      setLastQuery(data.query)
    }
    setLoading(false)
  }

  const EXAMPLE_QUERIES = [
    'Azure Data Factory pipeline experience',
    'Python ETL automation projects',
    'cost optimization achievements',
    'Databricks certification',
    'team lead or management experience',
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-chivo font-bold text-2xl text-foreground">Vault Search</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Semantic search across your entire career history. Ask in plain English.
        </p>
      </div>

      <form onSubmit={search} className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Azure Data Lake pipeline experience"
            autoFocus
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Search
        </button>
      </form>

      {results === null && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-3">Try asking</p>
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => { setQuery(q); }}
              className="block text-left w-full px-3 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {results !== null && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground text-xs">
              {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{lastQuery}&rdquo;
            </p>
            <button
              onClick={() => setResults(null)}
              className="text-muted-foreground text-xs hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No matching career history found.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Try a different phrase, or upload more content to your vault.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(r => (
                <div key={r.id}
                     className="bg-card border border-border rounded-lg p-4 hover:border-muted-foreground transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide border border-border px-1.5 py-0.5 rounded mr-2">
                        {r.type}
                      </span>
                      <span className="text-foreground font-medium text-sm">{r.title}</span>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${
                      r.score >= 0.85 ? 'text-profit' : r.score >= 0.7 ? 'text-yellow-400' : 'text-muted-foreground'
                    }`}>
                      {Math.round(r.score * 100)}%
                    </span>
                  </div>
                  {r.subtitle && (
                    <p className="text-muted-foreground text-xs mb-1.5">{r.subtitle}</p>
                  )}
                  {r.snippet && (
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                      {r.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <Link href="/vault" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Career Vault
        </Link>
      </div>
    </div>
  )
}
