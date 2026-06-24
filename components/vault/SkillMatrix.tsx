import type { Skill, SkillCat } from '@prisma/client'

type Props = { skills: Skill[] }

const CAT_LABELS: Record<SkillCat, string> = {
  LANGUAGE:    'Languages',
  FRAMEWORK:   'Frameworks',
  CLOUD:       'Cloud',
  DATABASE:    'Databases',
  TOOL:        'Tools',
  METHODOLOGY: 'Methodology',
  SOFT:        'Soft Skills',
}

const PROFICIENCY_WIDTH: Record<string, string> = {
  BEGINNER:     'w-1/4',
  INTERMEDIATE: 'w-1/2',
  ADVANCED:     'w-3/4',
  EXPERT:       'w-full',
}

const PROFICIENCY_COLOR: Record<string, string> = {
  BEGINNER:     'bg-muted-foreground',
  INTERMEDIATE: 'bg-yellow-500',
  ADVANCED:     'bg-indigo-500',
  EXPERT:       'bg-profit',
}

export function SkillMatrix({ skills }: Props) {
  const byCategory = skills.reduce((acc, skill) => {
    const cat = skill.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(skill)
    return acc
  }, {} as Record<SkillCat, Skill[]>)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(Object.entries(byCategory) as [SkillCat, Skill[]][]).map(([cat, catSkills]) => (
        <div key={cat} className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-3">
            {CAT_LABELS[cat]}
          </p>
          <div className="space-y-2.5">
            {catSkills.map(skill => (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-foreground text-xs">{skill.name}</span>
                  {skill.yearsUsed && (
                    <span className="text-muted-foreground text-[10px] font-mono numeric">{skill.yearsUsed}y</span>
                  )}
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${PROFICIENCY_WIDTH[skill.proficiency]} ${PROFICIENCY_COLOR[skill.proficiency]}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
