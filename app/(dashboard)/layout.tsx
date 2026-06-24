import { requireUser } from '@/lib/utils/tenant'
import Sidebar from '@/components/shared/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
