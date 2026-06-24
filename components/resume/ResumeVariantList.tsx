import { format } from 'date-fns'

type Variant = {
  id: string
  version: number
  status: string
  atsScore: number | null
  keywordCoverage: number | null
  injectedKeywords: string[]
  missingKeywords: string[]
  pdfPath: string | null
  createdAt: Date
  job: { title: string; company: string } | null
}

type Props = { variants: Variant[] }

export function ResumeVariantList({ variants }: Props) {
  if (variants.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-lg p-6 text-center">
        <p className="text-muted-foreground text-sm">No tailored variants yet.</p>
        <p className="text-muted-foreground text-xs mt-1">
          Use the Tailor Resume panel to generate your first variant.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-chivo font-bold text-sm text-foreground">
          Tailored Variants ({variants.length})
        </h3>
      </div>
      <div className="divide-y divide-border">
        {variants.map(v => (
          <div key={v.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium truncate">
                  v{v.version}{v.job ? ` — ${v.job.title} @ ${v.job.company}` : ''}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {format(v.createdAt, 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {v.atsScore !== null && (
                  <span className={`text-xs font-mono numeric ${
                    v.atsScore >= 80 ? 'text-profit' : v.atsScore >= 60 ? 'text-yellow-400' : 'text-muted-foreground'
                  }`}>
                    ATS {Math.round(v.atsScore)}
                  </span>
                )}
                {v.pdfPath && (
                  <a href={`/api/resume/${v.id}/pdf`}
                     className="text-[10px] border border-border px-2 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                    PDF
                  </a>
                )}
              </div>
            </div>
            {v.injectedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {v.injectedKeywords.slice(0, 6).map(k => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 bg-profit/10 border border-profit/20 text-profit rounded">
                    +{k}
                  </span>
                ))}
                {v.injectedKeywords.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">+{v.injectedKeywords.length - 6} more</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
