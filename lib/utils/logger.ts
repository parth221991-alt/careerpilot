import fs from 'fs'
import path from 'path'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

type LogEntry = {
  ts: string
  level: LogLevel
  service: string
  msg: string
  [key: string]: unknown
}

const LOG_DIR = path.join(process.cwd(), 'logs')

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
}

function writeLog(entry: LogEntry) {
  if (process.env.NODE_ENV === 'test') return
  ensureLogDir()
  const date = new Date().toISOString().slice(0, 10)
  const file = path.join(LOG_DIR, `careerpilot-${date}.jsonl`)
  fs.appendFileSync(file, JSON.stringify(entry) + '\n')
}

export function createLogger(service: string) {
  return {
    info: (msg: string, meta?: Record<string, unknown>) => {
      const entry: LogEntry = { ts: new Date().toISOString(), level: 'info', service, msg, ...meta }
      console.log(`[${service}] ${msg}`, meta ?? '')
      writeLog(entry)
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
      const entry: LogEntry = { ts: new Date().toISOString(), level: 'warn', service, msg, ...meta }
      console.warn(`[${service}] WARN: ${msg}`, meta ?? '')
      writeLog(entry)
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
      const entry: LogEntry = { ts: new Date().toISOString(), level: 'error', service, msg, ...meta }
      console.error(`[${service}] ERROR: ${msg}`, meta ?? '')
      writeLog(entry)
    },
    debug: (msg: string, meta?: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== 'development') return
      const entry: LogEntry = { ts: new Date().toISOString(), level: 'debug', service, msg, ...meta }
      console.debug(`[${service}] DEBUG: ${msg}`, meta ?? '')
      writeLog(entry)
    },
  }
}
