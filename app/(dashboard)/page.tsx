import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { LayoutDashboard, Briefcase, ClipboardList, Mail, TrendingUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { AppStatus } from '@prisma/client'

const STATUS_COLORS: Record<AppStatus, string> = {
  SAVED:            'text-muted-foreground bg-muted',
  APPROVAL_PENDING: 'text-yellow-400 bg-yellow-400/10',
  APPLIED:          'text-blue-400 bg-blue-400/10',
  HR_ROUND:         'text-indigo-400 bg-indigo-400/10',
  TECHNICAL_ROUND:  'text-violet-400 bg-violet-400/10',
  MANAGER_ROUND:    'text-purple-400 bg-purple-400/10',
  OFFER:            'text-profit bg-profit/10',
  ACCEPTED:         'text-profit bg-profit/10',
  REJECTED:         'text-loss bg-loss/10',
  WITHDRAWN:        'text-muted-foreground bg-muted',
}

export default async function DashboardPage() {
  const user = await requireUser()

  const [
    appCounts,
    pendingApprovals,
    recentApplications,
    unreadEmails,
    recentJobs,
    careerProfile,
  ] = await Promise.all([
    prisma.application.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),
    prisma.approvalGate.count({
      where: { userId: user.id, status: 'PENDING' },
    }),
    prisma.application.findMany({
      where: { userId: user.id },
      include: { job: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.emailThread.count({
      where: { userId: user.id, isRead: false },
    }),
    prisma.job.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { discoveredAt: 'desc' },
      take: 5,
    }),
    prisma.careerProfile.findUnique({ where: { userId: user.id } }),
  ])

  const totalApps = appCounts.reduce((s, r) => s + r._count, 0)
  const interviews = appCounts
    .filter(r => ['HR_ROUND', 'TECHNICAL_ROUND', 'MANAGER_ROUND'].includes(r.status))
    .reduce((s, r) => s + r._count, 0)
  const offers = appCounts.filter(r => r.status === 'OFFER').reduce((s, r) => s + r._count, 0)

  const stats = [
    { label: 'Total Applications', value: totalApps, icon: ClipboardList, href: '/applications', color: 'text-blue-400' },
    { label: 'Active Interviews', value: interviews, icon: Briefcase, href: '/applications?status=HR_ROUND', color: 'text-indigo-400' },
    { label: 'Offers', value: offers, icon: TrendingUp, href: '/applications?status=OFFER', color: 'text-profit' },
    { label: 'Unread Emails', value: unreadEmails, icon: Mail, href: '/email', color: 'text-yellow-400' },
  ]

  return (
    <div>
      <PageHeader
        title={`Good morning, ${user.name.split(' ')[0]}`}
        subtitle="Here's your career pipeline at a glance"
      />

      <div className="p-6 space-y-6">
        {/* Approval alert */}
        {pendingApprovals > 0 && (
          <Link href="/applications?filter=approvals">
            <div className="flex items-center gap-3 p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-lg hover:border-yellow-400/40 transition-colors cursor-pointer">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-yellow-400 font-medium text-sm">
                  {pendingApprovals} application{pendingApprovals > 1 ? 's' : ''} awaiting your approval
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">Review and approve before automation proceeds</p>
              </div>
            </div>
          </Link>
        )}

        {/* No career profile warning */}
        {!careerProfile && (
          <Link href="/vault">
            <div className="flex items-center gap-3 p-4 bg-indigo-600/5 border border-indigo-600/20 rounded-lg hover:border-indigo-600/40 transition-colors cursor-pointer">
              <LayoutDashboard className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <p className="text-indigo-400 font-medium text-sm">Set up your Career Vault to get started</p>
                <p className="text-muted-foreground text-xs mt-0.5">Upload your resume to power all AI features</p>
              </div>
            </div>
          </Link>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <div className="bg-card border border-border rounded-lg p-4 hover:border-indigo-600/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-chivo font-bold numeric ${color}`}>{value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Two columns: recent apps + recent jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent applications */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-chivo font-bold text-sm text-foreground">Recent Applications</h3>
              <Link href="/applications" className="text-xs text-indigo-400 hover:text-indigo-300">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {recentApplications.length === 0 ? (
                <p className="text-muted-foreground text-sm px-4 py-6 text-center">No applications yet</p>
              ) : recentApplications.map(app => (
                <div key={app.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{app.job.title}</p>
                    <p className="text-muted-foreground text-xs truncate">{app.job.company}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[app.status]}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                    <p className="text-muted-foreground text-[10px] mt-1">
                      {formatDistanceToNow(app.updatedAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent job discoveries */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-chivo font-bold text-sm text-foreground">New Job Matches</h3>
              <Link href="/jobs" className="text-xs text-indigo-400 hover:text-indigo-300">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {recentJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm px-4 py-6 text-center">
                  No jobs discovered yet — trigger a discovery run from the Jobs page
                </p>
              ) : recentJobs.map(job => (
                <div key={job.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{job.title}</p>
                    <p className="text-muted-foreground text-xs truncate">{job.company} · {job.location ?? 'Remote'}</p>
                  </div>
                  {job.matchScore != null && (
                    <div className="shrink-0 text-right">
                      <span className={`text-sm font-bold font-mono numeric ${
                        job.matchScore >= 80 ? 'text-profit' : job.matchScore >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}>
                        {Math.round(job.matchScore)}%
                      </span>
                      <p className="text-muted-foreground text-[10px]">match</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
