'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LayoutDashboard, BookOpen, Briefcase,
  ClipboardList, FileText, Mail, Users,
  MessageSquare, Gift, TrendingUp, BarChart3,
  LogOut, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'

type NavItem = { href: string; label: string; icon: React.FC<{ className?: string }> }

const NAV: NavItem[] = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/profiles',       label: 'Job Profiles',  icon: Layers },
  { href: '/vault',          label: 'Career Vault',  icon: BookOpen },
  { href: '/jobs',           label: 'Job Discovery', icon: Briefcase },
  { href: '/applications',   label: 'Applications',  icon: ClipboardList },
  { href: '/resume',         label: 'Resume Intel',  icon: FileText },
  { href: '/email',          label: 'Gmail Intel',   icon: Mail },
  { href: '/recruiters',     label: 'Recruiter CRM', icon: Users },
  { href: '/interview',      label: 'Interview OS',  icon: MessageSquare },
  { href: '/offers',         label: 'Offer Intel',   icon: Gift },
  { href: '/market',         label: 'Market Intel',  icon: TrendingUp },
  { href: '/analytics',      label: 'Analytics',     icon: BarChart3 },
]

type Props = {
  user: { name: string; email: string; avatarUrl: string | null }
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="w-60 shrink-0 bg-card border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-chivo font-bold text-sm leading-none">CareerPilot</p>
            <p className="text-muted-foreground text-[10px] mt-0.5 truncate">Career OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <ul className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-600/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* User footer */}
      <div className="px-2 py-3 border-t border-border space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-400 text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-xs font-medium truncate">{user.name}</p>
            <p className="text-muted-foreground text-[10px] truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  )
}
