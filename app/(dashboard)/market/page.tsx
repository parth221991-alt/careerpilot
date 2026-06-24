'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { TrendingUp, RefreshCw, Briefcase, Users, Globe, AlertTriangle, Activity, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import type { MarketIntelligence, MarketSignal } from '@/types/agents'

const SIGNAL_ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Globe: <Globe className="w-4 h-4" />,
}

const COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export default function MarketPage() {
  const [data, setData] = useState<MarketIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [cached, setCached] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [insights, setInsights] = useState<MarketSignal[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  async function loadInsights(bust = false) {
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const res = await fetch(bust ? '/api/market/insights?bust=1' : '/api/market/insights')
      if (res.ok) {
        const json = await res.json() as { insights: MarketSignal[]; error?: string }
        if (json.insights.length > 0) {
          setInsights(json.insights)
        } else {
          setInsights(null)
          setInsightsError(json.error ?? 'Insights unavailable')
        }
      }
    } catch {
      setInsightsError('Insights unavailable')
    } finally {
      setInsightsLoading(false)
    }
  }

  async function load(bustCache = false) {
    setLoading(true)
    const url = bustCache ? '/api/market?bust=1' : '/api/market'
    try {
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json() as { intelligence: MarketIntelligence; cached: boolean }
        setData(json.intelligence)
        setCached(json.cached)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
    await loadInsights(bustCache)
  }

  useEffect(() => { void load() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await load(true)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Market Intelligence" subtitle="Salary benchmarks and hiring trend analysis" />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Computing market intelligence...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Market Intelligence" subtitle="Salary benchmarks and hiring trend analysis" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-chivo font-bold text-foreground text-base">Not enough data yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Discover at least 5 jobs to populate market intelligence. Run a discovery from the Profiles page.
          </p>
        </div>
      </div>
    )
  }

  // salary chart — use medianMin/medianMax per type
  const salaryChartData = data.salaryByRole.map(r => ({
    name: r.role.length > 18 ? r.role.slice(0, 15) + '…' : r.role,
    medianMin: Math.round(r.medianMin / 1000),
    medianMax: Math.round(r.medianMax / 1000),
    count: r.sampleSize,
  }))

  // remote chart
  const remoteChartData = data.remoteBySource.map(r => ({
    name: r.platform,
    value: r.remotePercent,
  }))

  return (
    <div>
      <PageHeader
        title="Market Intelligence"
        subtitle={`${data.salaryByRole.length} roles · ${data.topSkills.length} skills${cached ? ' · cached' : ''}`}
        action={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {data.dataQualityWarning && (
        <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-xs">
          {data.dataQualityWarning}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* REQ-006 + EDGE-004: Market Signal insights grid */}
        {(insightsLoading || insights || insightsError) && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="font-chivo font-bold text-foreground text-sm">Market Signals</h3>
              {insightsLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin ml-1" />}
            </div>
            {insightsLoading && !insights ? (
              <p className="text-muted-foreground text-xs">Computing signals…</p>
            ) : insights === null && insightsError ? (
              <p className="text-muted-foreground text-xs">Market signals unavailable — refresh to retry.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(insights ?? []).map(signal => (
                  <div key={signal.type} className="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-md">
                    <span className="text-indigo-400 mt-0.5 shrink-0">
                      {SIGNAL_ICONS[signal.icon] ?? <TrendingUp className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{signal.label}</p>
                      <p className="text-xs text-foreground leading-snug">{signal.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Summary counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs">Fresh Jobs Today</p>
            <p className="font-chivo font-bold text-foreground text-2xl font-mono text-right mt-1">
              {data.freshJobsToday}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs">Roles Tracked</p>
            <p className="font-chivo font-bold text-foreground text-2xl font-mono text-right mt-1">
              {data.salaryByRole.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs">Unique Skills</p>
            <p className="font-chivo font-bold text-foreground text-2xl font-mono text-right mt-1">
              {data.topSkills.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-xs">Active Hiring Companies</p>
            <p className="font-chivo font-bold text-foreground text-2xl font-mono text-right mt-1">
              {data.companyHiringVelocity.length}
            </p>
          </div>
        </div>

        {/* Salary by Role */}
        {salaryChartData.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h3 className="font-chivo font-bold text-foreground text-sm">Salary Bands by Role (₹K)</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={salaryChartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6 }}
                  labelStyle={{ color: '#e2e8f0', fontSize: 11 }}
                  itemStyle={{ color: '#94a3b8', fontSize: 11 }}
                  formatter={(v: number) => `₹${v}K`}
                />
                <Bar dataKey="medianMin" fill="#1e293b" name="Min (Median)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="medianMax" fill="#6366f1" name="Max (Median)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />Median Max</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#1e293b] border border-border inline-block" />Median Min</span>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Top Skills */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-chivo font-bold text-foreground text-sm mb-4">Top In-Demand Skills</h3>
            <div className="space-y-2">
              {data.topSkills.slice(0, 12).map((skill, i) => (
                <div key={skill.skill} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-4 text-right font-mono">{i + 1}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, (skill.count / (data.topSkills[0]?.count ?? 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-foreground w-28 truncate">{skill.skill}</span>
                  <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{skill.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Remote by Source */}
          {remoteChartData.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-indigo-400" />
                <h3 className="font-chivo font-bold text-foreground text-sm">Remote % by Source</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={remoteChartData}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    dataKey="value"
                    nameKey="name"
                  >
                    {remoteChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 6 }}
                    formatter={(v: number) => `${Math.round(v)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {remoteChartData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {d.name} {Math.round(d.value)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Company Hiring Velocity */}
        {data.companyHiringVelocity.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="font-chivo font-bold text-foreground text-sm">Active Hiring Companies (30 days)</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {data.companyHiringVelocity.map(c => (
                <div key={c.company} className="border border-border rounded-md p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Briefcase className="w-3 h-3 text-muted-foreground shrink-0" />
                    <p className="text-xs font-medium text-foreground truncate">{c.company}</p>
                  </div>
                  <p className="font-mono text-sm text-indigo-400 text-right">{c.jobCount}</p>
                  <p className="text-[10px] text-muted-foreground text-right">openings</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
