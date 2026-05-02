'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  CalendarClock,
  Phone,
  MessageCircle,
  Search,
  Car as CarIcon,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getCurrentShowroomId } from '@/lib/auth'
import { ConfirmVenteModal } from '@/components/ConfirmVenteModal'
import type { Lead, Vehicle } from '@/lib/types'
import { format, isPast, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

// Phone → +213 / wa.me digits.
function formatPhoneIntl(raw: string | null | undefined): { tel: string; wa: string } | null {
  if (!raw) return null
  let s = raw.trim().replace(/[^\d+]/g, '')
  if (!s) return null
  if (s.startsWith('+')) {
    const digits = s.slice(1)
    if (!digits) return null
    return { tel: `+${digits}`, wa: digits }
  }
  if (s.startsWith('00')) s = s.slice(2)
  if (s.startsWith('0'))  s = s.slice(1)
  const digits = s.startsWith('213') ? s : `213${s}`
  return { tel: `+${digits}`, wa: digits }
}

type RowState = 'today' | 'future' | 'overdue'

function classifyRdv(iso: string): RowState {
  const d = new Date(iso)
  if (isToday(d)) return 'today'
  if (isPast(d))  return 'overdue'
  return 'future'
}

const ROW_STYLES: Record<RowState, string> = {
  today:   'bg-indigo-50/70 dark:bg-indigo-500/10 border-l-4 border-l-indigo-500',
  future:  'bg-emerald-50/50 dark:bg-emerald-500/5 border-l-4 border-l-emerald-500',
  overdue: 'bg-amber-50/60 dark:bg-amber-500/5 border-l-4 border-l-amber-500',
}

const BADGE_STYLES: Record<RowState, string> = {
  today:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-500/30',
  future:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-500/30',
  overdue: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200/60 dark:border-amber-500/30',
}

const BADGE_LABEL: Record<RowState, string> = {
  today:   "Aujourd'hui",
  future:  'À venir',
  overdue: 'En retard',
}

// Per-row action selector. "En attente" is the default; "Réservé" is set
// manually by the user. Both are local-only (no DB action).
type RdvAction = 'attente' | 'reserve' | 'vendu' | 'annule' | 'reporter'

function formatDzd(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(n)
}

const RDV_ACTION_BADGE: Record<RdvAction, string> = {
  attente:  'bg-yellow-300 text-yellow-900 border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950 dark:border-yellow-500',
  reserve:  'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30',
  vendu:    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  annule:   'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
  reporter: 'bg-orange-700 text-white border-orange-800 dark:bg-orange-700 dark:text-white dark:border-orange-800',
}

export function RendezVousView() {
  const [leads, setLeads]       = useState<Lead[]>([])
  const [vehiclesById, setVbi]  = useState<Record<string, Vehicle>>({})
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [migrationMissing, setMigrationMissing] = useState(false)
  // Per-row local statut (not persisted). Defaults to 'attente' on first
  // render — "Réservé" must be set manually. Once a row has a depot_amount
  // saved, we render it as 'reserve' instead of 'attente'.
  const [statutByLead, setStatutByLead] = useState<Record<string, RdvAction>>({})
  // Pending deposit modal state — shown when user picks "Réservé".
  const [depositModal, setDepositModal] = useState<{ lead: Lead; amount: string } | null>(null)
  // Vente confirmation modal — opened when the row Statut dropdown picks "Vendu".
  const [venteTarget, setVenteTarget] = useState<
    { lead: Lead; vehicle: Vehicle | null; vehicleName: string } | null
  >(null)
  // Toast for "Vente enregistrée — X DA" / sale-related notifications.
  const [toast, setToast] = useState<string | null>(null)
  function flashToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500) }

  async function fetchAll() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('suivi', 'rdv_planifie')
      .not('rdv_date', 'is', null)
      .order('rdv_date', { ascending: true })
    if (error) {
      if (/suivi|rdv_date/i.test(error.message)) {
        setMigrationMissing(true)
      } else {
        console.warn('[RendezVousView] failed to load:', error.message)
      }
      setLeads([])
    } else {
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)

    const { data: vdata } = await supabase.from('vehicles').select('*')
    const map: Record<string, Vehicle> = {}
    for (const v of (vdata ?? []) as Vehicle[]) map[v.id] = v
    setVbi(map)
  }

  useEffect(() => { fetchAll() }, [])

  // ── Action handlers ────────────────────────────────────────────────
  async function handleAction(lead: Lead, action: RdvAction) {
    const v = lead.vehicle_id ? vehiclesById[lead.vehicle_id] : null
    const vehicleName = v
      ? [v.brand, v.model, v.year ? String(v.year) : ''].filter(Boolean).join(' ')
      : '—'

    // Local-only statuses — no DB action.
    if (action === 'attente' || action === 'reserve') return

    if (action === 'annule') {
      if (!confirm('Êtes-vous sûr de vouloir annuler ce RDV ? Le prospect sera supprimé définitivement.')) return
      // Release vehicle if reserved by this lead.
      if (v && v.reserved_by_lead_id === lead.id &&
          (v.status === 'reserved' || v.status === 'sold')) {
        await supabase
          .from('vehicles')
          .update({ status: 'available', reserved_by_lead_id: null })
          .eq('id', v.id)
      }
      const { error } = await supabase.from('leads').delete().eq('id', lead.id)
      if (error) { alert(error.message); return }
      fetchAll()
      return
    }

    if (action === 'reporter') {
      if (!confirm('Reporter ce RDV ? Le prospect sera marqué comme Reporter dans Prospects.')) return
      // Release vehicle.
      if (v && v.reserved_by_lead_id === lead.id &&
          (v.status === 'reserved' || v.status === 'sold')) {
        await supabase
          .from('vehicles')
          .update({ status: 'available', reserved_by_lead_id: null })
          .eq('id', v.id)
      }
      const { error } = await supabase
        .from('leads')
        .update({ suivi: 'reporter', rdv_date: null })
        .eq('id', lead.id)
      if (error) { alert(error.message); return }
      fetchAll()
      return
    }

    if (action === 'vendu') {
      // Hand off to the ConfirmVenteModal: it captures the FINAL sale
      // price (pre-filled with the vehicle's listed price but editable)
      // and atomically performs the vente insert + vehicle status flip
      // + lead suivi update. The dropdown stays on its previous value
      // until the modal completes.
      setVenteTarget({ lead, vehicle: v ?? null, vehicleName })
      return
    }
  }

  // Audit trail for completed ventes — fired after the modal confirms.
  async function logVenteActivity(args: { lead: Lead; vehicleName: string }) {
    const showroomId = await getCurrentShowroomId()
    if (!showroomId) return
    await supabase.from('activities').insert([{
      showroom_id: showroomId,
      lead_id:     args.lead.id,
      type:        'status_change',
      title:       `Vente conclue : ${args.vehicleName}`,
      body:        `${args.lead.full_name} · ${args.vehicleName}`,
      done:        true,
    }])
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leads
      .filter((l) => l.rdv_date)
      .filter((l) => {
        if (!term) return true
        const v = l.vehicle_id ? vehiclesById[l.vehicle_id] : null
        const carText = v ? `${v.brand} ${v.model} ${v.year ?? ''}` : ''
        return (
          l.full_name.toLowerCase().includes(term) ||
          (l.phone ?? '').toLowerCase().includes(term) ||
          carText.toLowerCase().includes(term)
        )
      })
      .map((l) => {
        const v = l.vehicle_id ? vehiclesById[l.vehicle_id] : null
        const carLabel = v
          ? [v.brand, v.model, v.year ? String(v.year) : ''].filter(Boolean).join(' ')
          : '—'
        const state = classifyRdv(l.rdv_date!)
        const date  = new Date(l.rdv_date!)
        return {
          id:       l.id,
          lead:     l,
          name:     l.full_name,
          phone:    l.phone,
          carLabel,
          rdvDate:  date,
          state,
        }
      })
  }, [leads, vehiclesById, search])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50"
          >
            Rendez-vous
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 mt-1"
          >
            Tous les RDV planifiés avec vos prospects, classés par date.
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"
        >
          <CalendarClock className="w-4 h-4" />
          {rows.length} rendez-vous
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden"
      >
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client, un véhicule…"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-slate-100 placeholder:text-slate-400 shadow-sm"
            />
            <Search className="absolute left-4 top-3.5 text-slate-400 w-5 h-5 pointer-events-none" />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />À venir</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Aujourd&apos;hui</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />En retard</span>
          </div>
        </div>

        {migrationMissing && (
          <div className="px-6 py-4 text-sm font-bold text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 border-b border-amber-200/60 dark:border-amber-500/30">
            Exécutez les migrations <code>migration_07_leads_suivi.sql</code> et{' '}
            <code>migration_08_leads_rdv_date.sql</code> dans Supabase pour activer cette page.
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                <th className="pb-4 pt-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Date &amp; heure</th>
                <th className="pb-4 pt-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Client</th>
                <th className="pb-4 pt-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Véhicule</th>
                <th className="pb-4 pt-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Statut</th>
                <th className="pb-4 pt-4 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rows.map((r, idx) => {
                const intl = formatPhoneIntl(r.phone)
                const hasPhone = !!intl
                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + idx * 0.04 }}
                    key={r.id}
                    className={cn('transition-colors', ROW_STYLES[r.state])}
                  >
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {format(r.rdvDate, "EEE d MMM yyyy", { locale: fr })}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {format(r.rdvDate, 'HH:mm', { locale: fr })}
                        </span>
                        <span className={cn(
                          'mt-1 inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border',
                          BADGE_STYLES[r.state]
                        )}>
                          {BADGE_LABEL[r.state]}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.name}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{r.phone ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                        <CarIcon className="w-4 h-4 text-slate-400" />
                        {r.carLabel}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        // If a deposit is recorded, the row is implicitly "Réservé"
                        // unless the user has manually picked another local status.
                        const explicit = statutByLead[r.id]
                        const hasDeposit = r.lead.depot_amount != null
                        const current: RdvAction = explicit ?? (hasDeposit ? 'reserve' : 'attente')
                        const reserveLabel = (current === 'reserve' && hasDeposit)
                          ? `Réservé · ${formatDzd(r.lead.depot_amount)} DZD`
                          : 'Réservé'
                        return (
                          <select
                            value={current}
                            onChange={async (e) => {
                              const next = e.target.value as RdvAction
                              if (next === current) return
                              if (next === 'attente') {
                                if (!confirm('Êtes-vous sûr de vouloir remettre ce RDV en attente ?')) return
                                // Going back to "attente" clears any deposit recorded.
                                if (hasDeposit) {
                                  const { error } = await supabase
                                    .from('leads')
                                    .update({ depot_amount: null })
                                    .eq('id', r.lead.id)
                                  if (error) {
                                    if (/depot_amount/i.test(error.message)) {
                                      alert("La colonne 'depot_amount' n'existe pas. Exécutez supabase/migration_11_leads_depot.sql.")
                                    } else {
                                      alert(error.message)
                                    }
                                    return
                                  }
                                }
                                setStatutByLead((prev) => ({ ...prev, [r.id]: 'attente' }))
                                fetchAll()
                                return
                              }
                              if (next === 'reserve') {
                                // Open deposit modal with any existing amount pre-filled.
                                setDepositModal({
                                  lead:   r.lead,
                                  amount: r.lead.depot_amount != null ? String(r.lead.depot_amount) : '',
                                })
                                return
                              }
                              // vendu / annule / reporter — existing flows.
                              handleAction(r.lead, next)
                            }}
                            className={cn(
                              'appearance-none cursor-pointer pl-3 pr-7 py-1 rounded-full text-xs font-black uppercase tracking-widest border focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
                              RDV_ACTION_BADGE[current]
                            )}
                          >
                            <option value="attente">En attente</option>
                            <option value="reserve">{reserveLabel}</option>
                            <option value="vendu">Vendu</option>
                            <option value="annule">Annulé</option>
                            <option value="reporter">Reporter</option>
                          </select>
                        )
                      })()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={hasPhone ? `tel:${intl!.tel}` : undefined}
                          aria-disabled={!hasPhone}
                          onClick={(e) => { if (!hasPhone) e.preventDefault() }}
                          className={cn(
                            'p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl transition-colors shadow-sm inline-flex items-center justify-center',
                            !hasPhone && 'opacity-40 cursor-not-allowed'
                          )}
                          title={hasPhone ? `Appeler ${r.phone}` : 'Pas de numéro'}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={hasPhone ? `https://wa.me/${intl!.wa}` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-disabled={!hasPhone}
                          onClick={(e) => { if (!hasPhone) e.preventDefault() }}
                          className={cn(
                            'p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-colors shadow-sm inline-flex items-center justify-center',
                            !hasPhone && 'opacity-40 cursor-not-allowed'
                          )}
                          title={hasPhone ? `WhatsApp ${r.phone}` : 'Pas de numéro'}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>

          {!loading && rows.length === 0 && !migrationMissing && (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun rendez-vous planifié pour le moment.
            </div>
          )}
        </div>
      </motion.div>

      {/* Deposit confirmation modal — shown when picking "Réservé" */}
      {depositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Confirmer la réservation</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{depositModal.lead.full_name}</p>
              </div>
              <button
                onClick={() => setDepositModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const lead = depositModal.lead
                const raw = depositModal.amount.replace(/\s/g, '')
                const amount = raw === '' ? null : Number(raw)
                if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
                  alert('Montant invalide.')
                  return
                }
                const { error } = await supabase
                  .from('leads')
                  .update({ depot_amount: amount })
                  .eq('id', lead.id)
                if (error) {
                  if (/depot_amount/i.test(error.message)) {
                    alert("La colonne 'depot_amount' n'existe pas. Exécutez supabase/migration_11_leads_depot.sql.")
                  } else {
                    alert(error.message)
                  }
                  return
                }
                setStatutByLead((prev) => ({ ...prev, [lead.id]: 'reserve' }))
                setDepositModal(null)
                fetchAll()
              }}
              className="px-6 py-5 space-y-4"
            >
              <p className="text-sm text-foreground">
                Montant du dépôt reçu de <span className="font-bold">{depositModal.lead.full_name}</span> ?
              </p>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Montant (DZD)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  autoFocus
                  value={depositModal.amount}
                  onChange={(e) =>
                    setDepositModal((m) => (m ? { ...m, amount: e.target.value } : m))
                  }
                  placeholder="ex. 50000"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositModal(null)}
                  className="px-4 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vente confirmation — opened by the row "Vendu" action */}
      {venteTarget && (
        <ConfirmVenteModal
          open={true}
          lead={venteTarget.lead}
          vehicle={venteTarget.vehicle}
          onClose={() => setVenteTarget(null)}
          onConfirmed={({ prix_vente }) => {
            const fmt = new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(prix_vente)
            flashToast(`Vente enregistrée — ${fmt} DA`)
            // Audit trail (best-effort, fire-and-forget).
            void logVenteActivity({ lead: venteTarget.lead, vehicleName: venteTarget.vehicleName })
            fetchAll()
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}
