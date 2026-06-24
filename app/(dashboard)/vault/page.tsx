import { requireUser } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { VaultUploader } from '@/components/vault/VaultUploader'
import { ExperienceCard } from '@/components/vault/ExperienceCard'
import { SkillMatrix } from '@/components/vault/SkillMatrix'
import { BookOpen, Upload } from 'lucide-react'
import Link from 'next/link'

export default async function VaultPage() {
  const user = await requireUser()

  const careerProfile = await prisma.careerProfile.findUnique({
    where: { userId: user.id },
    include: {
      experiences: { orderBy: { startDate: 'desc' } },
      projects: { orderBy: { createdAt: 'desc' } },
      skills: { orderBy: [{ category: 'asc' }, { proficiency: 'desc' }] },
      certifications: { orderBy: { issuedAt: 'desc' } },
      achievements: { orderBy: { date: 'desc' } },
      baseResumes: { orderBy: { version: 'desc' }, take: 5 },
    },
  })

  return (
    <div>
      <PageHeader
        title="Career Vault"
        subtitle="Your complete career history — the foundation for all AI actions"
        action={
          <div className="flex gap-2">
            <Link
              href="/vault/search"
              className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              Search vault
            </Link>
            <VaultUploader userId={user.id} />
          </div>
        }
      />

      {!careerProfile ? (
        <EmptyState
          icon={BookOpen}
          title="Your Career Vault is empty"
          description="Upload your resume to extract your career history, skills, and achievements. This powers every AI feature in CareerPilot."
          action={<VaultUploader userId={user.id} large />}
        />
      ) : (
        <div className="p-6 space-y-8">
          {/* Profile summary */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-chivo font-bold text-lg text-foreground">{careerProfile.headline}</h2>
                {careerProfile.summary && (
                  <p className="text-muted-foreground text-sm mt-2 max-w-2xl leading-relaxed">
                    {careerProfile.summary}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-chivo font-bold text-indigo-400 numeric">
                  {careerProfile.yearsOfExperience}
                </p>
                <p className="text-muted-foreground text-xs">years exp.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              {careerProfile.linkedinUrl && (
                <a href={careerProfile.linkedinUrl} target="_blank" className="text-indigo-400 hover:text-indigo-300">
                  LinkedIn ↗
                </a>
              )}
              {careerProfile.githubUrl && (
                <a href={careerProfile.githubUrl} target="_blank" className="text-indigo-400 hover:text-indigo-300">
                  GitHub ↗
                </a>
              )}
              <span>{careerProfile.experiences.length} positions</span>
              <span>{careerProfile.projects.length} projects</span>
              <span>{careerProfile.certifications.length} certifications</span>
            </div>
          </div>

          {/* Skills matrix */}
          {careerProfile.skills.length > 0 && (
            <section>
              <h3 className="font-chivo font-bold text-base text-foreground mb-4">Skills</h3>
              <SkillMatrix skills={careerProfile.skills} />
            </section>
          )}

          {/* Experience */}
          {careerProfile.experiences.length > 0 && (
            <section>
              <h3 className="font-chivo font-bold text-base text-foreground mb-4">Experience</h3>
              <div className="space-y-4">
                {careerProfile.experiences.map(exp => (
                  <ExperienceCard key={exp.id} experience={exp} />
                ))}
              </div>
            </section>
          )}

          {/* Certifications */}
          {careerProfile.certifications.length > 0 && (
            <section>
              <h3 className="font-chivo font-bold text-base text-foreground mb-4">Certifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {careerProfile.certifications.map(cert => (
                  <div key={cert.id} className="bg-card border border-border rounded-lg p-4">
                    <p className="text-foreground font-medium text-sm">{cert.name}</p>
                    <p className="text-muted-foreground text-xs mt-1">{cert.issuer}</p>
                    <p className="text-muted-foreground text-xs mt-1 font-mono numeric">
                      {new Date(cert.issuedAt).getFullYear()}
                      {cert.expiresAt ? ` – ${new Date(cert.expiresAt).getFullYear()}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
