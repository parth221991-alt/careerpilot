import type { Experience } from '@prisma/client'
import { format } from 'date-fns'
import { Briefcase, MapPin, Calendar } from 'lucide-react'

type Props = { experience: Experience }

export function ExperienceCard({ experience }: Props) {
  const bullets = Array.isArray(experience.bullets) ? experience.bullets as string[] : []
  const techStack = Array.isArray(experience.techStack) ? experience.techStack as string[] : []

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-chivo font-bold text-foreground text-base">{experience.title}</h4>
            {experience.isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-profit/10 text-profit font-medium">Current</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Briefcase className="w-3 h-3" />
              <span>{experience.company}</span>
            </div>
            {experience.location && (
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <MapPin className="w-3 h-3" />
                <span>{experience.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground text-xs font-mono numeric">
              <Calendar className="w-3 h-3" />
              <span>
                {format(experience.startDate, 'MMM yyyy')} –{' '}
                {experience.isCurrent ? 'Present' : experience.endDate ? format(experience.endDate, 'MMM yyyy') : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-muted-foreground text-xs leading-relaxed">
              <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-indigo-400" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {techStack.map((tech) => (
            <span key={tech} className="text-[10px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
              {tech}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
