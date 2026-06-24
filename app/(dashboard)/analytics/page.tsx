import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { BarChart3 } from 'lucide-react'

export default async function AnalyticsPage() {
  const user = await requireUser()

  const [appsByStatus, appsByPlatform, avgAts, totalApps] = await Promise.all([
    prisma.application.groupBy({ by: ['status'], where: { userId: user.id }, _count: true }),
    prisma.job.groupBy({ by: ['platform'], where: { userId: user.id }, _count: true }),
    prisma.resumeVariant.aggregate({
      where: { userId: user.id, atsScore: { not: null } },
      _avg: { atsScore: true },
    }),
    prisma.application.count({ where: { userId: user.id } }),
  ])

  const interviews = appsByStatus
    .filter(s => ['HR_ROUND', 'TECHNICAL_ROUND', 'MANAGER_ROUND'].includes(s.status))
    .reduce((sum, s) => sum + s._count, 0)

  const offers = appsByStatus.filter(s => s.status === 'OFFER' || s.status === 'ACCEPTED').reduce((sum, s) => sum + s._count, 0)

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Career pipeline performance metrics" />

      <div className="p-6 space-y-6">
        {/* Funnel */}
        <div>
          <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Pipeline Funnel</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Applications', value: totalApps, color: 'text-blue-400' },
              { label: 'Interviews', value: interviews, color: 'text-indigo-400' },
              { label: 'Offers', value: offers, color: 'text-profit' },
              { label: 'Avg ATS Score', value: avgAts._avg.atsScore ? `${Math.round(avgAts._avg.atsScore)}%` : '—', color: 'text-yellow-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-4">
                <p className="text-muted-foreground text-xs mb-2">{label}</p>
                <p className={`text-2xl font-chivo font-bold numeric ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* By platform */}
        {appsByPlatform.length > 0 && (
          <div>
            <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Jobs by Platform</h3>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              {appsByPlatform.sort((a, b) => b._count - a._count).map(row => {
                const pct = Math.round((row._count / (appsByPlatform.reduce((s, r) => s + r._count, 0) || 1)) * 100)
                return (
                  <div key={row.platform}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-foreground text-xs">{row.platform}</span>
                      <span className="text-muted-foreground text-xs font-mono numeric">{row._count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Conversion rates */}
        {totalApps > 0 && (
          <div>
            <h3 className="font-chivo font-bold text-sm text-foreground mb-3">Conversion Rates</h3>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {[
                { label: 'Application → Interview', value: totalApps > 0 ? `${Math.round((interviews / totalApps) * 100)}%` : '—' },
                { label: 'Application → Offer', value: totalApps > 0 ? `${Math.round((offers / totalApps) * 100)}%` : '—' },
                { label: 'Interview → Offer', value: interviews > 0 ? `${Math.round((offers / interviews) * 100)}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">{label}</span>
                  <span className="text-foreground font-mono font-bold text-sm numeric">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
