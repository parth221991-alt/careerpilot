'use client'

import type { InterviewPrep, Application, Job } from '@prisma/client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type PrepWithRelations = InterviewPrep & {
  application: (Application & { job: Job }) | null
}

type Props = { prep: PrepWithRelations }

type TechQuestion = { question: string; difficulty: string; guidance: string }
type BehavioralStory = { theme: string; situation: string; task: string; action: string; result: string }

export function InterviewPrepCard({ prep }: Props) {
  const [section, setSection] = useState<'tech' | 'behavioral' | 'salary' | null>(null)

  const tech = prep.techQuestions as TechQuestion[] ?? []
  const behavioral = prep.behavioralStories as BehavioralStory[] ?? []
  const salary = prep.salaryStrategy as Record<string, string> ?? {}
  const brief = prep.companyBrief as Record<string, string> ?? {}

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-foreground font-chivo font-bold text-sm">
          {prep.application?.job.title ?? 'Interview Prep'}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {prep.application?.job.company} · {tech.length} tech questions · {behavioral.length} STAR stories
        </p>
      </div>

      {/* Company brief */}
      {brief.mission && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">{brief.mission}</p>
        </div>
      )}

      {/* Sections */}
      <div className="divide-y divide-border">
        {/* Tech questions */}
        <div>
          <button onClick={() => setSection(section === 'tech' ? null : 'tech')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors">
            <span className="text-sm font-medium text-foreground">Technical Questions ({tech.length})</span>
            {section === 'tech' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {section === 'tech' && (
            <div className="px-4 pb-4 space-y-4">
              {tech.map((q, i) => (
                <div key={i}>
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${
                      q.difficulty === 'advanced' ? 'bg-loss/10 text-loss' :
                      q.difficulty === 'intermediate' ? 'bg-yellow-400/10 text-yellow-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {q.difficulty}
                    </span>
                    <p className="text-foreground text-sm">{q.question}</p>
                  </div>
                  {q.guidance && (
                    <p className="text-muted-foreground text-xs mt-1.5 ml-12 leading-relaxed">{q.guidance}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Behavioral stories */}
        <div>
          <button onClick={() => setSection(section === 'behavioral' ? null : 'behavioral')}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors">
            <span className="text-sm font-medium text-foreground">STAR Stories ({behavioral.length})</span>
            {section === 'behavioral' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {section === 'behavioral' && (
            <div className="px-4 pb-4 space-y-4">
              {behavioral.map((story, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">{story.theme}</p>
                  <div className="space-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">S:</span> <span className="text-foreground">{story.situation}</span></div>
                    <div><span className="text-muted-foreground">T:</span> <span className="text-foreground">{story.task}</span></div>
                    <div><span className="text-muted-foreground">A:</span> <span className="text-foreground">{story.action}</span></div>
                    <div><span className="text-muted-foreground">R:</span> <span className="text-foreground">{story.result}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Salary */}
        {Object.keys(salary).length > 0 && (
          <div>
            <button onClick={() => setSection(section === 'salary' ? null : 'salary')}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors">
              <span className="text-sm font-medium text-foreground">Salary Strategy</span>
              {section === 'salary' ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {section === 'salary' && (
              <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                {salary.target_range && (
                  <div className="bg-muted/30 rounded p-3 text-center">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Target</p>
                    <p className="text-foreground font-mono text-sm font-bold mt-1">{salary.target_range}</p>
                  </div>
                )}
                {salary.opening_ask && (
                  <div className="bg-muted/30 rounded p-3 text-center">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Ask</p>
                    <p className="text-profit font-mono text-sm font-bold mt-1">{salary.opening_ask}</p>
                  </div>
                )}
                {salary.minimum_acceptable && (
                  <div className="bg-muted/30 rounded p-3 text-center">
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Floor</p>
                    <p className="text-muted-foreground font-mono text-sm font-bold mt-1">{salary.minimum_acceptable}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
