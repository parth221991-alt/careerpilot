'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type Props = { userId: string; large?: boolean }

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export function VaultUploader({ userId, large }: Props) {
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState('')

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setState('uploading')
    setMessage('Uploading...')

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('userId', userId)

      setState('processing')
      setMessage('Claude is extracting your career data...')

      const res = await fetch('/api/vault/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      setState('done')
      setMessage(`Extracted ${data.experienceCount} positions, ${data.skillCount} skills`)
      setTimeout(() => window.location.reload(), 2000)
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: state === 'uploading' || state === 'processing',
  })

  if (!large) {
    return (
      <button
        {...getRootProps()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
      >
        <input {...getInputProps()} />
        <Upload className="w-3.5 h-3.5" />
        Upload resume
      </button>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-indigo-400 bg-indigo-600/5' : 'border-border hover:border-indigo-600/50 hover:bg-indigo-600/5',
        (state === 'uploading' || state === 'processing') && 'pointer-events-none opacity-80'
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {state === 'uploading' || state === 'processing' ? (
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        ) : state === 'done' ? (
          <CheckCircle className="w-10 h-10 text-profit" />
        ) : state === 'error' ? (
          <XCircle className="w-10 h-10 text-loss" />
        ) : (
          <Upload className="w-10 h-10 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium text-foreground text-sm">
            {state === 'idle' ? 'Drop your resume PDF here' :
             state === 'uploading' ? 'Uploading...' :
             state === 'processing' ? 'Extracting career data...' :
             state === 'done' ? 'Done!' : 'Upload failed'}
          </p>
          {message && <p className="text-muted-foreground text-xs mt-1">{message}</p>}
          {state === 'idle' && (
            <p className="text-muted-foreground text-xs mt-1">PDF only · Max 10MB</p>
          )}
        </div>
      </div>
    </div>
  )
}
