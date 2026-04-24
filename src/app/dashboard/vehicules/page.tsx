'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { VEHICLE_STATUS_LABELS, type Vehicle } from '@/lib/types'
import { Car, Plus, MoreVertical } from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────
function formatPrice(p: number | null) {
  if (!p) return '—'
  return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(p) + ' DZD'
}

function stockPill(status: Vehicle['status']) {
  if (status === 'available') return { cls: 'bg-emerald-500/15 text-emerald-400', label: 'En stock' }
  if (status === 'reserved')  return { cls: 'bg-amber-500/15 text-amber-400',   label: 'Réservé' }
  return { cls: 'bg-red-500/15 text-red-400', label: 'Vendu' }
}

const BRANDS = ['Geely', 'Chery', 'Fiat', 'Renault', 'DFSK', 'Toyota', 'Hyundai', 'Kia', 'Peugeot']

// ── Add Vehicle Modal ────────────────────────────────────────
function AddVehicleModal({
  open, onClose, onSaved,
}: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    brand: 'Geely', model: '', year: new Date().getFullYear().toString(),
    color: '', price_dzd: '', status: 'available' as Vehicle['status'],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand || !form.model) { setError('Marque et modèle sont requis.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('vehicles').insert([{
      brand:     form.brand,
      model:     form.model.trim(),
      year:      form.year ? parseInt(form.year) : null,
      color:     form.color || null,
      price_dzd: form.price_dzd ? parseFloat(form.price_dzd.replace(/\s/g, '')) : null,
      status:    form.status,
    }])
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ brand: 'Geely', model: '', year: new Date().getFullYear().toString(), color: '', price_dzd: '', status: 'available' })
    setError('')
    onSaved()
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Ajouter un véhicule</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Marque *</label>
              <select
                value={form.brand}
                onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Modèle *</label>
              <input
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="ex. Emgrand, Tiggo 4…"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Année</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                placeholder="2024"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Couleur</label>
              <input
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="ex. Blanc Perle"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prix (DZD)</label>
              <input
                value={form.price_dzd}
                onChange={e => setForm(f => ({ ...f, price_dzd: e.target.value }))}
                placeholder="ex. 3850000"
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Vehicle['status'] }))}
                className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="available">Disponible</option>
                <option value="reserved">Réservé</option>
                <option value="sold">Vendu</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-60">
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────
export default function VehiculesPage() {
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([])
  const [loading,    setLoading]    = useState(true)
  const [marque,     setMarque]     = useState('')
  const [modele,     setModele]     = useState('')
  const [annee,      setAnnee]      = useState('')
  const [statusFilter, setStatusFilter] = useState<Vehicle['status'] | 'all'>('all')
  const [modalOpen,  setModalOpen]  = useState(false)

  async function fetchVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })
    setVehicles((data ?? []) as Vehicle[])
    setLoading(false)
  }

  useEffect(() => { fetchVehicles() }, [])

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (marque && !v.brand.toLowerCase().includes(marque.toLowerCase())) return false
      if (modele && !v.model.toLowerCase().includes(modele.toLowerCase())) return false
      if (annee  && String(v.year ?? '').includes(annee) === false) return false
      return true
    })
  }, [vehicles, statusFilter, marque, modele, annee])

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Inventaire des Véhicules</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2.5 font-semibold transition"
        >
          <Plus className="w-4 h-4" /> Ajouter un véhicule
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Marque</label>
          <input
            value={marque}
            onChange={e => setMarque(e.target.value)}
            placeholder="Toutes"
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Modèle</label>
          <input
            value={modele}
            onChange={e => setModele(e.target.value)}
            placeholder="Tous"
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Année</label>
          <input
            value={annee}
            onChange={e => setAnnee(e.target.value)}
            placeholder="Toutes"
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Statut</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as Vehicle['status'] | 'all')}
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
          >
            <option value="all">Tous</option>
            <option value="available">Disponible</option>
            <option value="reserved">Réservé</option>
            <option value="sold">Vendu</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-card py-16 text-center flex flex-col items-center gap-3">
          <Car className="w-10 h-10 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-medium text-foreground">Aucun véhicule</p>
            <p className="text-xs text-muted-foreground mt-1">Aucun véhicule ne correspond à vos filtres.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map(v => {
            const stock = stockPill(v.status)
            return (
              <div
                key={v.id}
                className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-all duration-150 flex flex-col"
              >
                {/* Image area */}
                <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center">
                  <Car className="w-14 h-14 text-muted-foreground/40" />
                  {v.status === 'reserved' && (
                    <span className="absolute top-2 right-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/90 text-white">
                      Réservé
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground leading-tight truncate">
                        {v.brand} {v.model}{v.year ? ` ${v.year}` : ''}
                      </h3>
                      <p className="text-sm font-bold text-foreground mt-1">{formatPrice(v.price_dzd)}</p>
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      aria-label="Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Transmission : —</p>
                    <p className="text-xs text-muted-foreground">Carburant : {v.color ?? '—'}</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${stock.cls}`}>
                      {stock.label}
                    </span>
                    <select
                      value={v.status}
                      onChange={async e => {
                        const status = e.target.value as Vehicle['status']
                        await supabase.from('vehicles').update({ status }).eq('id', v.id)
                        setVehicles(prev => prev.map(x => x.id === v.id ? { ...x, status } : x))
                      }}
                      className={`text-xs h-7 px-2 rounded-md bg-muted/40 border border-border text-muted-foreground outline-none focus:border-primary cursor-pointer`}
                      aria-label="Changer le statut"
                    >
                      <option value="available">{VEHICLE_STATUS_LABELS.available}</option>
                      <option value="reserved">{VEHICLE_STATUS_LABELS.reserved}</option>
                      <option value="sold">{VEHICLE_STATUS_LABELS.sold}</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddVehicleModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchVehicles} />
    </div>
  )
}
