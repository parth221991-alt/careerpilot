import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { format } from 'date-fns'
import Link from 'next/link'
import { MessageSquare, Code2, Users, TrendingUp } from 'lucide-react'

type TechQuestion = {
  question: string
  expected_answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
}

type BehavioralStory = {
  competency: string
  story: string
  star_format: { situation: string; task: string; action: string; result: string }
}

type SalaryStrategy = {
  target_range: { min: number; max: number }
  anchoring_script: string
  counter_script: string
  walk_away_number: number
}

type CompanyBrief = {
  overview: string
  key_products: string[]
  tech_stack: string[]
  interview_style: string
  red_flags: string[]
  questions_to_ask: string[]
}

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const prep = await prisma.interviewPrep.findFirst({
    where: { id, userId: user.id },
    include: {
      application: {
        include: { job: true },
      },
    },
  })

  if (!prep) notFound()

  const { application } = prep
  const { job } = application
  const techQuestions = (prep.techQuestions as TechQuestion[] | null) ?? []
  const behavioralStories = (prep.behavioralStories as BehavioralStory[] | null) ?? []
  const salaryStrategy = prep.salaryStrategy as SalaryStrategy | null
  const companyBrief = prep.companyBrief as CompanyBrief | null

  const difficultyColor = {
    easy: 'text-profit border-profit/30 bg-profit/10',
    medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    hard: 'text-loss border-loss/30 bg-loss/10',
  }

  return (
    <div>
      <PageHeader
        title="Interview Prep"
        subtitle={`${job.title} at ${job.company} · Generated ${format(prep.generatedAt, 'MMM d, yyyy')}`}
        action={
          <Link href="/interview" className="text-xs border border-border px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Company brief */}
        {companyBrief && (
          <section className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-indigo-400" />
              <h2 className="font-chivo font-bold text-sm text-foreground">Company Brief — {job.company}</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{companyBrief.overview}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyBrief.tech_stack.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Their Stack</p>
                  <div className="flex flex-wrap gap-1">
                    {companyBrief.tech_stack.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted border border-border text-muted-foreground rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {companyBrief.interview_style && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Interview Style</p>
                  <p className="text-foreground text-xs">{companyBrief.interview_style}</p>
                </div>
              )}
              {companyBrief.questions_to_ask.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Questions to Ask Them</p>
                  <ul className="space-y-1">
                    {companyBrief.questions_to_ask.map((q, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">→</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Technical questions */}
        {techQuestions.length > 0 && (
          <section className="bg-card border border-border rounded-lg">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <h2 className="font-chivo font-bold text-sm text-foreground">
                Technical Questions ({techQuestions.length})
              </h2>
            </div>
            <div className="divide-y divide-border">
              {techQuestions.map((q, i) => (
                <details key={i} className="group px-5 py-4">
                  <summary className="flex items-center gap-3 cursor-pointer list-none">
                    <span className="text-muted-foreground text-xs font-mono w-5">{i + 1}.</span>
                    <span className="flex-1 text-foreground text-sm">{q.question}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${difficultyColor[q.difficulty] ?? 'text-muted-foreground border-border'}`}>
                      {q.difficulty}
                    </span>
                    <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded shrink-0">
                      {q.topic}
                    </span>
                  </summary>
                  <div className="mt-3 ml-8 p-3 bg-muted/30 rounded-md">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Expected Answer</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{q.expected_answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Behavioral stories */}
        {behavioralStories.length > 0 && (
          <section className="bg-card border border-border rounded-lg">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <h2 className="font-chivo font-bold text-sm text-foreground">
                STAR Stories ({behavioralStories.length})
              </h2>
            </div>
            <div className="divide-y divide-border">
              {behavioralStories.map((story, i) => (
                <details key={i} className="group px-5 py-4">
                  <summary className="flex items-center gap-3 cursor-pointer list-none">
                    <span className="text-muted-foreground text-xs font-mono w-5">{i + 1}.</span>
                    <span className="flex-1 text-foreground text-sm">{story.competency}</span>
                  </summary>
                  <div className="mt-3 ml-8 space-y-2">
                    {(['situation', 'task', 'action', 'result'] as const).map(k => (
                      <div key={k} className="p-3 bg-muted/30 rounded-md">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          {k}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {story.star_format[k]}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Salary strategy */}
        {salaryStrategy && (
          <section className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-profit" />
              <h2 className="font-chivo font-bold text-sm text-foreground">Salary Strategy</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/30 rounded p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Target Range</p>
                <p className="text-foreground font-chivo font-bold text-lg numeric">
                  ₹{(salaryStrategy.target_range.min / 100000).toFixed(0)}–{(salaryStrategy.target_range.max / 100000).toFixed(0)}L
                </p>
              </div>
              <div className="bg-loss/10 border border-loss/20 rounded p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Walk Away At</p>
                <p className="text-loss font-chivo font-bold text-lg numeric">
                  ₹{(salaryStrategy.walk_away_number / 100000).toFixed(0)}L
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Opening Script</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  &ldquo;{salaryStrategy.anchoring_script}&rdquo;
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">When They Counter-Offer</p>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  &ldquo;{salaryStrategy.counter_script}&rdquo;
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
