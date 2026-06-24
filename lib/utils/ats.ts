// Fast lexical ATS pre-scorer — used for bulk job scoring before Claude semantic layer

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'our', 'you', 'your', 'will', 'have',
  'this', 'that', 'are', 'not', 'from', 'work', 'team', 'role', 'strong',
  'good', 'great', 'able', 'experience', 'skills', 'using', 'may', 'can',
  'use', 'etc', 'also', 'must', 'should', 'would',
])

const TECH_PHRASES = [
  'apache spark', 'azure data factory', 'azure synapse', 'azure databricks',
  'amazon s3', 'amazon redshift', 'google bigquery', 'apache kafka',
  'apache airflow', 'dbt core', 'delta lake', 'data lakehouse', 'data warehouse',
  'data lake', 'data pipeline', 'etl pipeline', 'elt pipeline',
  'real-time streaming', 'batch processing', 'machine learning', 'deep learning',
  'power bi', 'microsoft fabric', 'unity catalog', 'medallion architecture',
  'star schema', 'snowflake schema', 'ci/cd', 'infrastructure as code',
]

function extractKeywords(text: string): Set<string> {
  const lower = text.toLowerCase()
  const words = lower.match(/\b[a-z][a-z0-9+#.\-]{1,30}\b/g) ?? []
  return new Set(words.filter(w => !STOPWORDS.has(w) && w.length > 2))
}

function extractPhrases(text: string): Set<string> {
  const lower = text.toLowerCase()
  return new Set(TECH_PHRASES.filter(p => lower.includes(p)))
}

export type QuickATSResult = {
  score: number
  keywordCoverage: number
  matchedKeywords: string[]
  missingKeywords: string[]
}

export function quickATSScore(resumeText: string, jdText: string): QuickATSResult {
  const jdKw = extractKeywords(jdText)
  const jdPh = extractPhrases(jdText)
  const resumeKw = extractKeywords(resumeText)
  const resumePh = extractPhrases(resumeText)

  const allJD = new Set([...jdKw, ...jdPh])
  const allResume = new Set([...resumeKw, ...resumePh])

  const matched = [...allJD].filter(k => allResume.has(k))
  const missing = [...allJD].filter(k => !allResume.has(k))

  const coverage = allJD.size > 0 ? (matched.length / allJD.size) * 100 : 0
  const score = Math.min(100, Math.round(coverage))

  return {
    score,
    keywordCoverage: Math.round(coverage * 10) / 10,
    matchedKeywords: matched.slice(0, 30),
    missingKeywords: missing.slice(0, 20),
  }
}
