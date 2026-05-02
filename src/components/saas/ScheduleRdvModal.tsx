'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Sparkles, AlertTriangle } from 'lucide-react'
import {
  type SaasProspect, type SaasRdv, type SaasDistributionPreview,
} from '@/lib/types'
import { cn } from '@/lib/utils'

function tomorrowDateInput(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function todayDateInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ScheduleRdvModal({
  open,
  prospect,
  onClose,
  onScheduled,
}: {
  open: boolean
  prospect: SaasProspect
  onClose: () => void
  onScheduled: (rdv: SaasRdv, assigned: SaasDistributionPreview | null) => void
}) {
  const [date, setDate]     = useState('')
  const [time, setTime]     = useState('10:00')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [preview, setPreview] = useState<SaasDistributionPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(tomorrowDateInput())
    setTime('10:00')
    setNotes('')
    setError('')
    setSaving(false)
    setPreviewLoading(true)
    fetch('/api/saas-distribution/preview')
      .then(r => r.json())
      .then((j) => setPreview(j as SaasDistributionPreview))
      .catch(() => setPreview({ user_id: null, email: null, percentage: null }))
      .finally(() => setPreviewLoading(false))
  }, [open, prospect?.id])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) { setError('Date et heure requises.'); return }
    setSaving(true); setError('')
    const local = new Date(`${date}T${time}:00`)
    if (Number.isNaN(local.getTime())) {
      setSaving(false); setError('Date ou heure invalide.'); return
    }
    const res = await fetch(`/api/saas-prospects/${prospect.id}/schedule-rdv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at: local.toISOString(),
        notes:        notes.trim() || null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(json?.error ?? 'Erreur lors de la création du RDV.')
      return
    }
    // The server returns assigned info but not necessarily the email — fall
    // back to the preview email (which we showed to the user moments ago).
    const assignedFromServer = (json.assigned ?? null) as SaasDistributionPreview | null
    const assigned: SaasDistributionPreview | null = assignedFromServer
      ? { ...assignedFromServer, email: assignedFromServer.email ?? preview?.email ?? null }
      : null
    onScheduled(json.rdv as SaasRdv, assigned)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Planifier un RDV</h2>
            <p className="text-xs text-muted-foreground mt-0.5" dir="auto">
              {prospect.full_name} — {prospect.showroom_name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Date *</label>
              <input
                type="date"
                value={date}
                min={todayDateInput()}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Heure *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes pour le RDV…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* Preview block */}
          {previewLoading ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              Calcul de l&apos;assignation…
            </div>
          ) : preview?.user_id ? (
            <div className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-3 py-2.5 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-300 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-900 dark:text-blue-200">
                Sera assigné à : <span className="font-bold break-all">{preview.email ?? '—'}</span>
                {preview.percentage != null && (
                  <span className="text-blue-700 dark:text-blue-300"> ({preview.percentage}%)</span>
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Aucun commercial actif. Le RDV sera créé sans assignation.{' '}
                <Link
                  href="/dashboard/super-admin/parametres"
                  className="underline font-bold hover:text-amber-700 dark:hover:text-amber-100"
                >
                  Configurez la distribution
                </Link>.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cn(
                'px-4 py-2 rounded-lg text-sm text-foreground hover:bg-muted',
                saving && 'opacity-50',
              )}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 font-medium"
            >
              {saving ? 'Planification…' : 'Planifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
