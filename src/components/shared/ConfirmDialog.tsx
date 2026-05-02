'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Generic confirmation modal. Click-outside and Escape both cancel
 * (unless `loading` is true). Matches the rest of the AutoDex modal
 * shells: rounded-2xl border + bg-card + small header strip.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel  = 'Annuler',
  variant      = 'default',
  loading      = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (loading) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter')  onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel, onConfirm])

  if (!open) return null

  return (
    <div
      onClick={() => { if (!loading) onCancel() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60',
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700',
            )}
          >
            {loading ? 'Enregistrement…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
