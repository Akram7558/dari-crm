'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, Car, TrendingUp, Trophy, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AlertBanner } from '@/components/alerts/alert-banner'
import {
  LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS,
  type Lead, type Vehicle,
} from '@/lib/types'
import { format, subDays, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ─────────────────────────────────────────────────

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

const PIPELINE_ORDER: Lead['status'][] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

// ── Component ───────────────────────────────────────────────

export default function DashboardPage() {
  const [leads,    setLeads]    = useState<Lead[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    ]).then(([{ data: l }, { data: v }]) => {
      setLeads(   (l ?? []) as Lead[])
      setVehicles((v ?? []) as Vehicle[])
      setLoading(false)
    })
  }, [])

  // ── KPIs ──────────────────────────────────────────────────
  const now        = new Date()
  const monthStart = subDays(now, 30)
  const leadsThisMonth  = leads.filter(l => isAfter(new Date(l.created_at), monthStart))
  const wonLeads        = leads.filter(l => l.status === 'won')
  const availableVehicles = vehicles.filter(v => v.status === 'available')

  // ── Pipeline bar data ─────────────────────────────────────
  const pipelineData = PIPELINE_ORDER.map(status => ({
    name: LEAD_STATUS_LABELS[status],
    total: leads.filter(l => l.status === status).length,
  }))

  const kpis = [
    {
      label: 'Total prospects',
      value: leads.length,
      sub: `+${leadsThisMonth.length} ce mois`,
      icon: Users,
    },
    {
      label: 'Prospects ce mois',
      value: leadsThisMonth.length,
      sub: `sur 30 jours glissants`,
      icon: TrendingUp,
    },
    {
      label: 'Véhicules disponibles',
      value: availableVehicles.length,
      sub: `sur ${vehicles.length} en stock`,
      icon: Car,
    },
    {
      label: 'Ventes conclues',
      value: wonLeads.length,
      sub: `taux : ${leads.length ? Math.round((wonLeads.length / leads.length) * 100) : 0}%`,
      icon: Trophy,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement du tableau de bord…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(now, "EEEE d MMMM yyyy", { locale: fr })} · Vue d&apos;ensemble commerciale
        </p>
      </div>

      {/* ── Red alert banner (leads ignored > 48h) ── */}
      <AlertBanner />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-5 flex items-start justify-between gap-4 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</p>
                <p className="text-3xl md:text-4xl font-bold text-foreground mt-2 leading-none tracking-tight">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-2">{kpi.sub}</p>
              </div>
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                <Icon className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pipeline bar chart ── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Pipeline commercial</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={pipelineData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              axisLine={false} tickLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#1A2234', fontSize: 12, color: '#F1F5F9' }}
              cursor={{ fill: 'rgba(99,102,241,0.08)' }}
            />
            <Bar dataKey="total" name="Prospects" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Recent leads table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Derniers prospects</h2>
          <a
            href="/dashboard/leads"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Voir tout <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nom</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Wilaya</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Source</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 6).map((lead) => (
                <tr key={lead.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-foreground">
                    <span dir="auto">{lead.full_name}</span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground">{lead.wilaya ?? '—'}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sourcePill(lead.source)}`}>
                      {LEAD_SOURCE_LABELS[lead.source]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusPill(lead.status)}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground text-xs">
                    {format(new Date(lead.created_at), 'dd/MM/yyyy', { locale: fr })}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-sm">
                    Aucun prospect pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
