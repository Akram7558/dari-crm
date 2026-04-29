'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Pencil, Trash2, X, Users as UsersIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppRole, AppUser, Showroom, UserRole } from '@/lib/types'

const ROLE_VALUES: AppRole[] = ['owner', 'manager', 'closer', 'prospecteur']
const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  owner:       'Propriétaire',
  manager:     'Manager',
  closer:      'Closer',
  prospecteur: 'Prospecteur',
}

const ROLE_BADGE: Record<AppRole, string> = {
  super_admin: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  owner:       'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  manager:     'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  closer:      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  prospecteur: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
}

type Form = {
  id: string | null         // user_roles.id when editing
  email: string             // input — looked up against public.users
  showroom_id: string
  role: AppRole
}

const empty: Form = { id: null, email: '', showroom_id: '', role: 'prospecteur' }

export function UsersManager() {
  const [roles, setRoles] = useState<UserRole[]>([])
  const [showrooms, setShowrooms] = useState<Showroom[]>([])
  const [usersById, setUsersById] = useState<Record<string, AppUser>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchAll() {
    const [{ data: r }, { data: s }, { data: u }] = await Promise.all([
      supabase.from('user_roles').select('*').order('created_at', { ascending: false }),
      supabase.from('showrooms').select('*').order('name'),
      supabase.from('users').select('id, email, full_name'),
    ])
    setRoles((r ?? []) as UserRole[])
    setShowrooms((s ?? []) as Showroom[])
    const map: Record<string, AppUser> = {}
    for (const x of (u ?? []) as AppUser[]) map[x.id] = x
    setUsersById(map)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const showroomById = useMemo(() => {
    const m: Record<string, Showroom> = {}
    for (const s of showrooms) m[s.id] = s
    return m
  }, [showrooms])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!form.email.trim()) { setError('Email requis.'); return }
    if (!form.showroom_id)  { setError('Sélectionnez un showroom.'); return }
    setSaving(true); setError('')

    // Look up the user_id by email in public.users.
    const { data: lookup, error: luErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', form.email.trim().toLowerCase())
      .maybeSingle()
    if (luErr) { setSaving(false); setError(luErr.message); return }
    if (!lookup) {
      setSaving(false)
      setError("Aucun utilisateur trouvé avec cet email. L'utilisateur doit d'abord créer un compte.")
      return
    }

    const payload = {
      user_id:     lookup.id,
      showroom_id: form.showroom_id,
      role:        form.role,
    }
    const { error: err } = form.id
      ? await supabase.from('user_roles').update(payload).eq('id', form.id)
      : await supabase.from('user_roles').insert([payload])
    setSaving(false)
    if (err) {
      // Friendly message for the unique-on-user_id constraint.
      if (/uq_user_roles_user/i.test(err.message)) {
        setError('Cet utilisateur a déjà un rôle. Modifiez la ligne existante.')
      } else {
        setError(err.message)
      }
      return
    }
    setForm(null)
    fetchAll()
  }

  async function remove(r: UserRole) {
    const u = usersById[r.user_id]
    if (!confirm(`Retirer le rôle de ${u?.email ?? 'cet utilisateur'} ?`)) return
    const { error } = await supabase.from('user_roles').delete().eq('id', r.id)
    if (error) { alert(error.message); return }
    fetchAll()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-[2rem] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
            Utilisateurs
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {roles.length}
          </span>
        </div>
        <button
          onClick={() => setForm(empty)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Showroom</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Rôle</th>
              <th className="px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {roles.map((r) => {
              const u = usersById[r.user_id]
              const s = r.showroom_id ? showroomById[r.showroom_id] : null
              return (
                <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{u?.email ?? '—'}</div>
                    {u?.full_name && (
                      <div className="text-xs text-zinc-500 mt-0.5">{u.full_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                    {s?.name ?? <span className="text-zinc-400 italic">— global —</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${ROLE_BADGE[r.role]}`}>
                      {ROLE_LABELS[r.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setForm({
                          id: r.id,
                          email: u?.email ?? '',
                          showroom_id: r.showroom_id ?? '',
                          role: r.role,
                        })}
                        title="Modifier"
                        className="p-2 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        title="Retirer le rôle"
                        className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && roles.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Aucun utilisateur. Cliquez sur « Nouvel utilisateur » pour assigner un rôle.
          </div>
        )}
      </div>

      {/* Modal */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {form.id ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}
              </h3>
              <button onClick={() => setForm(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!form.id}
                  placeholder="utilisateur@autodex.store"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  L&apos;utilisateur doit avoir déjà créé un compte sur AutoDex.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Showroom *</label>
                <select
                  value={form.showroom_id}
                  onChange={(e) => setForm({ ...form, showroom_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">— Sélectionner —</option>
                  {showrooms.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Rôle *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                >
                  {ROLE_VALUES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg text-sm text-foreground hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 font-medium"
                >
                  {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
