'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Props = {
  reasoning: string
  model?: string
  tokensUsed?: number
  cachedTokens?: number
  className?: string
}

export function ReasoningPanel({ reasoning, model, tokensUsed, cachedTokens, className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('border border-indigo-600/20 rounded-md bg-indigo-600/5', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-indigo-400">AI Reasoning</span>
          {model && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {model.split('-').slice(1, 3).join('-')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {tokensUsed && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {tokensUsed.toLocaleString()} tokens
              {cachedTokens ? ` · ${cachedTokens.toLocaleString()} cached` : ''}
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-indigo-600/10 pt-2">
          {reasoning}
        </div>
      )}
    </div>
  )
}
