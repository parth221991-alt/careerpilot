import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

type MarketConfig = {
  skill_gap_threshold_pct: number
  cache_ttl_seconds: number
  heat_window_days: number
  min_jobs_for_insights: number
  salary_sample_min: number
}

type CareerPilotConfig = {
  market_intelligence: MarketConfig
}

let _config: CareerPilotConfig | null = null

export function getCareerPilotConfig(): CareerPilotConfig {
  if (_config) return _config
  const raw = readFileSync(join(process.cwd(), 'config', 'careerpilot.yaml'), 'utf-8')
  _config = parse(raw) as CareerPilotConfig
  return _config
}
