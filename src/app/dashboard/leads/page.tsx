'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  type Lead,
} from '@/lib/types'
import { format, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Plus, Phone, MessageSquare, Eye,
  MessageCircle, Camera, Globe, User2, Users, Sparkles, Clock,
  ChevronDown, Inbox,
} from 'lucide-react'

// ── Source & status styles ───────────────────────────────────
function sourcePill(source: Lead['source']) {
  const map: Record<Lead['source'], string> = {
    'walk-in':  'bg-slate-500/15 text-slate-300',
    phone:      'bg-sky-500/15 text-sky-400',
    website:    'bg-slate-500/15 text-slate-300',
    referral:   'bg-indigo-500/15 text-indigo-400',
    social:     'bg-amber-500/15 text-amber-400',
    facebook:   'bg-blue-500/15 text-blue-400',
    instagram:  'bg-pink-500/15 text-pink-400',
    whatsapp:   'bg-emerald-500/15 text-emerald-400',
    telephone:  'bg-sky-500/15 text-sky-400',
  }
  return map[source] ?? 'bg-slate-500/15 text-slate-300'
}

function SourceIcon({ source }: { source: Lead['source'] }) {
  const common = 'w-3.5 h-3.5'
  if (source === 'whatsapp')  return <MessageCircle  className={`${common} text-emerald-400`} />
  if (source === 'facebook')  return <MessageSquare  className={`${common} text-blue-400`} />
  if (source === 'instagram') return <Camera         className={`${common} text-pink-400`} />
  if (source === 'website')   return <Globe          className={`${common} text-slate-300`} />
  if (source === 'phone' || source === 'telephone') return <Phone className={`${common} text-sky-400`} />
  return <User2 className={`${common} text-slate-300`} />
}

function statusPill(status: Lead['status']) {
  const map: Record<Lead['status'], string> = {
    new:       'bg-emerald-500/15 text-emerald-400',
    contacted: 'bg-amber-500/15 text-amber-400',
    qualified: 'bg-sky-500/15 text-sky-400',
    proposal:  'bg-rose-500/15 text-rose-400',
    won:       'bg-violet-500/15 text-violet-400',
    lost:      'bg-red-500/15 text-red-400',
  }
  return map[status] ?? 'bg-muted text-muted-foreground'
}

// ── Modal: Add Lead ──────────────────────────────────────────
function AddLeadModal({
  open, onClose, onSaved,
}: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', wilaya: '',
    source: 'walk-in' as Lead['source'],
    status: 'new' as Lead['status'],
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const wilayas = ['Alger', 'Oran', 'Constantine', 'Annaba', 'Sétif', 'Blida', 'Batna', 'Tizi Ouzou', 'Béjaïa', 'Autre']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Le nom est requis.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('leads').insert([{
      full_name: form.full_name.trim(),
      phone:     form.phone || null,
      email:     form.email || null,
      wilaya:    form.wilaya || null,
      source:    form.source,
      status:    form.status,
      notes:     form.notes || null,
    }])
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ full_name: '', phone: '', email: '', wilaya: '', source: 'walk-in', status: 'new', notes: '' })
    setError('')
    onSaved()
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Nouveau prospect</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nom complet *</label>
              <input
                dir="auto"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="ex. Karim Benali"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Téléphone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0555 XX XX XX"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.com"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Wilaya</label>
              <select
                value={form.wilaya}
                onChange={e => setForm(f => ({ ...f, wilaya: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">— Choisir —</option>
                {wilayas.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Source</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value as Lead['source'] }))}
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observations, budget, modèle souhaité…"
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
const PAGE_SIZE = 15

export default function LeadsPage() {
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [loading,     setLoading]     = useState(true)
  const [sourceFilter, setSourceFilter] = useState<Lead['source'] | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all')
  const [page, setPage]               = useState(1)
  const [modalOpen,   setModalOpen]   = useState(false)

  async function fetchLeads() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      return true
    })
  }, [leads, sourceFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, filtered.length)
  const pageRows = filtered.slice(start, end)

  // Summary stats
  const total = leads.length
  const newToday = leads.filter(l => {
    try { return isToday(new Date(l.created_at)) } catch { return false }
  }).length
  const enAttente = leads.filter(l => l.status === 'new' || l.status === 'contacted').length

  const stats = [
    { label: 'Total prospects',      value: total,     icon: Users,     color: 'text-indigo-400' },
    { label: 'Nouveaux aujourd\u2019hui', value: newToday, icon: Sparkles,  color: 'text-purple-400' },
    { label: 'En attente',           value: enAttente, icon: Clock,     color: 'text-amber-400' },
  ]

  function pageNumbers(): (number | 'gap')[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (safePage <= 3) return [1, 2, 3, 'gap', totalPages]
    if (safePage >= totalPages - 2) return [1, 'gap', totalPages - 2, totalPages - 1, totalPages]
    return [1, 'gap', safePage - 1, safePage, safePage + 1, 'gap', totalPages]
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Liste des Prospects</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2.5 font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Nouveau Prospect
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-muted/50 flex items-center justify-center">
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
                <p className="text-3xl md:text-4xl font-bold text-foreground mt-1 leading-none tracking-tight">{s.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Filters row */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-b border-border flex-wrap">
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value as Lead['source'] | 'all'); setPage(1) }}
              className="appearance-none h-9 pl-4 pr-9 rounded-full bg-muted/40 border border-border text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="all">Source : Toutes</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as Lead['status'] | 'all'); setPage(1) }}
              className="appearance-none h-9 pl-4 pr-9 rounded-full bg-muted/40 border border-border text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="all">Statut : Tous</option>
              {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Prospect</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Téléphone</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Wilaya</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Source</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-3 rounded-lg border-2 border-dashed border-border py-10 px-6 mx-auto max-w-md">
                      <Inbox className="w-10 h-10 text-muted-foreground/60" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Aucun prospect</p>
                        <p className="text-xs text-muted-foreground mt-1">Aucun résultat ne correspond à vos filtres.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map(lead => (
                  <tr key={lead.id} className="group border-b border-border/60 hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <p dir="auto" className="font-medium text-foreground leading-tight">{lead.full_name}</p>
                      {lead.email && <p className="text-xs text-muted-foreground mt-0.5">{lead.email}</p>}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">{lead.phone ?? '—'}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{lead.wilaya ?? '—'}</td>
                    <td className="px-6 py-3.5">
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                        <SourceIcon source={lead.source} />
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPill(lead.status)}`}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground text-xs">
                      {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="hidden group-hover:flex gap-2 justify-end">
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="w-8 h-8 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            title="Appeler"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          className="w-8 h-8 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Message"
                          type="button"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Voir"
                          type="button"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-wrap gap-3">
            <p className="text-xs text-muted-foreground">
              Affichage de {start + 1} à {end} sur {filtered.length} prospects
            </p>
            <div className="flex items-center gap-1">
              {pageNumbers().map((n, i) => n === 'gap' ? (
                <span key={`g${i}`} className="px-2 text-muted-foreground text-xs">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                    safePage === n
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddLeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchLeads}
      />
    </div>
  )
}
