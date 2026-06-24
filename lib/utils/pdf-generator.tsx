/**
 * Server-side PDF generation for resume variants using @react-pdf/renderer.
 * Called from API routes only — never imported by client components.
 */
import React from 'react'
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font, type DocumentProps } from '@react-pdf/renderer'

Font.register({
  family: 'IBM Plex Sans',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKtd_uFg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjXr8AIxsdO_b.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjQ76BIxsdO_b.ttf', fontWeight: 700 },
  ],
})

const s = StyleSheet.create({
  page: {
    fontFamily: 'IBM Plex Sans',
    fontSize: 9,
    color: '#0f172a',
    paddingTop: 36,
    paddingHorizontal: 48,
    paddingBottom: 36,
    lineHeight: 1.4,
  },
  name: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 2,
  },
  headline: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    fontSize: 8,
    color: '#64748b',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#4f46e5',
    marginBottom: 4,
    marginTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  jobTitle: {
    fontWeight: 600,
    fontSize: 9,
  },
  company: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 3,
  },
  dateRange: {
    fontSize: 8,
    color: '#94a3b8',
  },
  bullet: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  bulletDot: {
    width: 8,
    color: '#4f46e5',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    color: '#334155',
  },
  skillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  skillPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    color: '#334155',
  },
})

type ResumeData = {
  name: string
  headline: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  summary?: string
  experiences: Array<{
    title: string
    company: string
    location?: string
    startDate: string
    endDate?: string
    isCurrent?: boolean
    bullets: string[]
  }>
  skills: Array<{ name: string; category: string }>
  certifications?: Array<{ name: string; issuer: string; year?: string }>
  education?: Array<{ degree: string; school: string; year?: string }>
}

function ResumeDocument({ data }: { data: ResumeData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.name}>{data.name}</Text>
        <Text style={s.headline}>{data.headline}</Text>
        <View style={s.contactRow}>
          <Text>{data.email}</Text>
          {data.phone && <Text>{data.phone}</Text>}
          {data.location && <Text>{data.location}</Text>}
          {data.linkedin && <Text>{data.linkedin}</Text>}
        </View>

        {/* Summary */}
        {data.summary && (
          <>
            <Text style={s.sectionTitle}>Professional Summary</Text>
            <Text style={{ fontSize: 8.5, color: '#334155', lineHeight: 1.5, marginTop: 4 }}>
              {data.summary}
            </Text>
          </>
        )}

        {/* Experience */}
        {data.experiences.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Experience</Text>
            {data.experiences.map((exp, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={s.experienceHeader}>
                  <Text style={s.jobTitle}>{exp.title}</Text>
                  <Text style={s.dateRange}>
                    {exp.startDate} — {exp.isCurrent ? 'Present' : (exp.endDate ?? '')}
                  </Text>
                </View>
                <Text style={s.company}>
                  {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                </Text>
                {exp.bullets.map((b, j) => (
                  <View key={j} style={s.bullet}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Technical Skills</Text>
            <View style={s.skillRow}>
              {data.skills.map((sk, i) => (
                <Text key={i} style={s.skillPill}>{sk.name}</Text>
              ))}
            </View>
          </>
        )}

        {/* Certifications */}
        {data.certifications && data.certifications.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Certifications</Text>
            {data.certifications.map((c, i) => (
              <Text key={i} style={{ fontSize: 8.5, color: '#334155', marginBottom: 2 }}>
                {c.name} — {c.issuer}{c.year ? ` (${c.year})` : ''}
              </Text>
            ))}
          </>
        )}

        {/* Education */}
        {data.education && data.education.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Education</Text>
            {data.education.map((e, i) => (
              <View key={i} style={s.experienceHeader}>
                <Text style={s.jobTitle}>{e.degree}</Text>
                <Text style={s.dateRange}>{e.year}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  )
}

export async function generateResumePDF(data: ResumeData): Promise<Buffer> {
  const element = React.createElement(ResumeDocument, { data }) as React.ReactElement<DocumentProps>
  return renderToBuffer(element)
}

export type { ResumeData }
