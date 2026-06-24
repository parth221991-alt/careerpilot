import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { Gift } from 'lucide-react'

export default async function OffersPage() {
  const user = await requireUser()

  // Get all applications in OFFER or ACCEPTED status for this user
  const applications = await prisma.application.findMany({
    where: { userId: user.id, status: { in: ['OFFER', 'ACCEPTED'] } },
    include: { job: true, offer: true },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div>
      <PageHeader
        title="Offer Intelligence"
        subtitle={`${applications.length} offer${applications.length !== 1 ? 's' : ''} tracked`}
      />

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Gift className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-chivo font-bold text-foreground text-base">No offers yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Offers are recorded when an application reaches OFFER status.</p>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {applications.map(app => {
            const offer = app.offer
            return (
              <div key={app.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-chivo font-bold text-foreground">{app.job.title}</h3>
                    <p className="text-muted-foreground text-sm mt-0.5">{app.job.company}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    offer?.outcome === 'ACCEPTED' ? 'bg-profit/10 text-profit' :
                    offer?.outcome === 'DECLINED' ? 'bg-loss/10 text-loss' :
                    offer?.outcome === 'NEGOTIATING' ? 'bg-yellow-400/10 text-yellow-400' :
                    'bg-yellow-400/10 text-yellow-400'
                  }`}>
                    {offer?.outcome ?? 'PENDING'}
                  </span>
                </div>
                {offer && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {offer.baseSalary && (
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Base</p>
                        <p className="text-foreground font-mono text-sm font-bold numeric mt-1">
                          ₹{(offer.baseSalary / 100000).toFixed(1)}L
                        </p>
                      </div>
                    )}
                    {offer.bonusAmount && (
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Bonus</p>
                        <p className="text-profit font-mono text-sm font-bold numeric mt-1">
                          ₹{(offer.bonusAmount / 100000).toFixed(1)}L
                        </p>
                      </div>
                    )}
                    {offer.equityValue && (
                      <div>
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Equity</p>
                        <p className="text-indigo-400 font-mono text-sm font-bold numeric mt-1">
                          ₹{(offer.equityValue / 100000).toFixed(1)}L
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
