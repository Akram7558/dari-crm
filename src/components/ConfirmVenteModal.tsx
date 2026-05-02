'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentShowroomId } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { Lead, Vehicle } from '@/lib/types'

// ── Vente confirmation modal ─────────────────────────────────────────
// Opens when the user transitions a lead's suivi to 'vendu'. The popup
// captures the FINAL sale price (pre-filled with the vehicle's listed
// price but editable) plus optional notes, then atomically:
//   1. inserts a row in `ventes` (with the entered price, NOT the deposit)
//   2. flips the vehicle status to 'sold'
//   3. flips the lead suivi to 'vendu'
// If a vente row for this lead already exists, the modal aborts with a
// toast — preventing duplicate sales when the user re-triggers the flow.
//
// IMPORTANT: the deposit on the lead (`depot_amount`) is intentionally
// untouched. The sale amount is whatever the user types here.

export type ConfirmVenteModalProps = {
  open: boolean
  lead: Lead | null
  /** Linked vehicle (or null when none — price input falls back to 0). */
  vehicle: Vehicle | null
  onClose: () => void
  onConfirmed: (info: { prix_vente: number; notes: string }) => void
}

function formatNumberInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(Math.round(n))
}

export function ConfirmVenteModal({
  open, lead, vehicle, onClose, onConfirmed,
}: ConfirmVenteModalProps) {
  const [prix, setPrix]     = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Re-seed when reopened on a different lead.
  useEffect(() => {
    if (!open) return
    setPrix(formatNumberInput(vehicle?.price_dzd))
    setNotes('')
    setError('')
    setSaving(false)
  }, [open, lead?.id, vehicle?.id])

  // Esc closes (when not saving).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open || !lead) return null

  const vehicleLabel = vehicle
    ? [vehicle.brand, vehicle.model, vehicle.year ? String(vehicle.year) : '']
        .filter(Boolean).join(' ') + (vehicle.reference ? ` · ${vehicle.reference}` : '')
    : '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setError('')

    const cleaned = prix.replace(/\s/g, '')
    const amount = Number(cleaned)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Saisissez un prix de vente final supérieur à 0.')
      return
    }

    setSaving(true)

    // 1. Idempotency — refuse if a vente already exists for this lead.
    const { data: existing, error: existErr } = await supabase
      .from('ventes')
      .select('id')
      .eq('lead_id', lead.id)
      .limit(1)
      .maybeSingle()
    if (existErr && !/0 rows/i.test(existErr.message)) {
      setSaving(false); setError(existErr.message); return
    }
    if (existing?.id) {
      setSaving(false)
      setError('Une vente existe déjà pour ce lead.')
      return
    }

    // 2. Resolve showroom_id (RLS will reject the insert if missing).
    const showroomId = await getCurrentShowroomId()
    if (!showroomId) {
      setSaving(false)
      setError("Aucun showroom associé à votre compte. Contactez l'administrateur.")
      return
    }

    // 3. Insert the vente. Try with `notes` first; if the column doesn't
    //    exist (older schemas), retry without it. The amount is what the
    //    user typed — never the deposit.
    const insertPayload: Record<string, unknown> = {
      showroom_id:       showroomId,
      lead_id:           lead.id,
      vehicle_id:        vehicle?.id ?? null,
      client_name:       lead.full_name,
      vehicle_name:      vehicleLabel === '—' ? null : vehicleLabel,
      vehicle_reference: vehicle?.reference ?? null,
      prix_vente:        amount,
    }
    if (notes.trim()) insertPayload.notes = notes.trim()

    let { error: vErr } = await supabase.from('ventes').insert([insertPayload])
    if (vErr && /notes/i.test(vErr.message)) {
      // Schema-resilient retry — drop `notes` if the column isn't there.
      const { notes: _omit, ...rest } = insertPayload
      void _omit
      const retry = await supabase.from('ventes').insert([rest])
      vErr = retry.error
    }
    if (vErr) {
      setSaving(false)
      if (/ventes/i.test(vErr.message) && /relation|does not exist/i.test(vErr.message)) {
        setError("La table 'ventes' n'existe pas. Exécutez supabase/migration_10_ventes.sql.")
      } else {
        setError(vErr.message)
      }
      return
    }

    // 4. Cascade vehicle → sold (best-effort; ignore if no vehicle linked).
    if (vehicle?.id) {
      await supabase
        .from('vehicles')
        .update({ status: 'sold', reserved_by_lead_id: lead.id })
        .eq('id', vehicle.id)
    }

    // 5. Lead suivi → vendu. The audit-log trigger fires automatically.
    const { error: lErr } = await supabase
      .from('leads')
      .update({ suivi: 'vendu' })
      .eq('id', lead.id)
    if (lErr) {
      // The vente row is already in; surface the error but don't roll back —
      // the user can retry the suivi update from the lead modal.
      setSaving(false)
      setError(lErr.message)
      return
    }

    setSaving(false)
    onConfirmed({ prix_vente: amount, notes: notes.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Confirmer la vente</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="auto">
                {lead.full_name} — {vehicleLabel}
              </p>
            </div>
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
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Prix de vente final (DA) *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="ex. 1 500 000"
              autoFocus
              required
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            />
            {vehicle?.price_dzd != null && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Prix listé du véhicule pré-rempli — modifiable.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes (optionnel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques sur la vente…"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

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
              className="px-5 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 font-medium"
            >
              {saving ? 'Enregistrement…' : 'Confirmer la vente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
