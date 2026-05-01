'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Pencil, Trash2, X, Users as UsersIcon, CheckCircle2, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ── Internal-team scope ─────────────────────────────────────────────
// This component is mounted on /dashboard/super-admin/utilisateurs and
// the super-admin home. It manages ONLY internal-team accounts:
// super_admin / commercial / prospecteur_saas. Showroom users
// (owner/manager/closer/prospecteur) are managed on the Showrooms page.
type InternalRole = 'super_admin' | 'commercial' | 'prospecteur_saas'
const INTERNAL_ROLES: InternalRole[] = ['super_admin', 'commercial', 'prospecteur_saas']

const ROLE_LABELS: Record<InternalRole, string> = {
  super_admin:      'Super Admin',
  commercial:       'Commercial',
  prospecteur_saas: 'Prospecteur SaaS',
}

const ROLE_BADGE: Record<InternalRole, string> = {
  super_admin:      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  commercial:       'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  prospecteur_saas: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-500/30',
}

type InternalUserRow = {
  id:         string  // user_roles.id
  user_id:    string  // auth.users.id
  email:      string | null
  role:       InternalRole
  created_at: string
}

type CreateForm = {
  kind:             'create'
  email:            string
  name:             string
  password:         string
  password_confirm: string
  role:             InternalRole
}

type EditForm = {
  kind:             'edit'
  user_id:          string  // auth.users.id (target)
  email:            string
  password:         string  // empty = keep current
  password_confirm: string
  role:             InternalRole
  originalRole:     InternalRole
  isOwnRow:         boolean
}

const emptyCreate: CreateForm = {
  kind: 'create',
  email: '',
  name: '',
  password: '',
  password_confirm: '',
  role: 'commercial',
}

// Returns 0 (none/weak), 1 (weak), 2 (medium), 3 (strong) for the password.
function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw))   score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return 1
  if (score <= 4) return 2
  return 3
}

const STRENGTH_META: Record<0 | 1 | 2 | 3, { label: string; color: string; widthClass: string }> = {
  0: { label: '—',      color: 'bg-zinc-300 dark:bg-zinc-700',  widthClass: 'w-0' },
  1: { label: 'Faible', color: 'bg-rose-500',                    widthClass: 'w-1/3' },
  2: { label: 'Moyen',  color: 'bg-amber-500',                   widthClass: 'w-2/3' },
  3: { label: 'Fort',   color: 'bg-emerald-500',                 widthClass: 'w-full' },
}

export function UsersManager() {
  const [users, setUsers]     = useState<InternalUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [form, setForm]   = useState<CreateForm | EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Toast for "Utilisateur mis à jour"
  const [toast, setToast] = useState<string | null>(null)
  function flashToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Success modal — shown after creating an internal-team user.
  const [created, setCreated] = useState<
    | { email: string; emailSent: true }
    | { email: string; emailSent: false; password: string; emailError?: string }
    | null
  >(null)
  const [copied, setCopied] = useState(false)

  async function fetchAll() {
    setLoading(true); setLoadError('')
    const res = await fetch('/api/admin/list-internal-users')
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoadError(json?.error ?? 'Erreur lors du chargement.')
      setUsers([])
    } else {
      setUsers((json.users ?? []) as InternalUserRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null)
    })
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError('')

    if (form.kind === 'create') {
      if (!form.email.trim())          { setError('Email requis.'); return }
      if (form.password.length < 8)    { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
      if (form.password !== form.password_confirm) {
        setError('Les deux mots de passe ne correspondent pas.'); return
      }
      setSaving(true)
      const res = await fetch('/api/admin/create-internal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    form.email.trim().toLowerCase(),
          name:     form.name.trim(),
          password: form.password,
          role:     form.role,
        }),
      })
      const json = await res.json().catch(() => ({}))
      setSaving(false)
      if (!res.ok) { setError(json?.error ?? 'Erreur lors de la création.'); return }
      setForm(null)
      if (json.email_sent) {
        setCreated({ email: json.email, emailSent: true })
      } else {
        setCreated({
          email:      json.email,
          emailSent:  false,
          password:   json.temp_password ?? form.password,
          emailError: json.email_error,
        })
      }
      fetchAll()
      return
    }

    // ── Edit ────────────────────────────────────────────────────────
    if (!form.email.trim()) { setError('Email requis.'); return }
    if (form.password) {
      if (form.password.length < 8)    { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return }
      if (form.password !== form.password_confirm) {
        setError('Les deux mots de passe ne correspondent pas.'); return
      }
    }
    if (form.isOwnRow && form.role !== form.originalRole) {
      setError('Vous ne pouvez pas modifier votre propre rôle.'); return
    }
    setSaving(true)
    const payload: Record<string, unknown> = { user_id: form.user_id }
    payload.email = form.email.trim().toLowerCase()
    if (form.password) payload.password = form.password
    if (form.role !== form.originalRole) payload.role = form.role
    const res = await fetch('/api/admin/update-internal-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(json?.error ?? 'Erreur lors de la mise à jour.'); return }
    setForm(null)
    flashToast('Utilisateur mis à jour')
    fetchAll()
  }

  async function remove(u: InternalUserRow) {
    if (u.user_id === currentUserId) {
      alert('Vous ne pouvez pas supprimer votre propre compte.')
      return
    }
    if (!confirm(`Retirer le rôle de ${u.email ?? 'cet utilisateur'} ? Le rôle sera supprimé mais le compte auth restera (action réversible).`)) return
    const { error } = await supabase.from('user_roles').delete().eq('id', u.id)
    if (error) { alert(error.message); return }
    fetchAll()
  }

  async function copyCredentials() {
    if (!created || created.emailSent) return
    const text = `Email : ${created.email}\nMot de passe : ${created.password}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copiez ces identifiants :', text)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="rounded-[2rem] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm overflow-hidden relative"
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-black uppercase tracking-tighter text-zinc-900 dark:text-white">
            Utilisateurs internes
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {users.length}
          </span>
        </div>
        <button
          onClick={() => setForm(emptyCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      {loadError && (
        <div className="px-6 py-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-200/40">
          {loadError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40">
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</th>
              <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Rôle</th>
              <th className="px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {users.map((u) => {
              const isOwn = u.user_id === currentUserId
              return (
                <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">
                      {u.email ?? <span className="text-zinc-400 italic">— inconnu —</span>}
                      {isOwn && (
                        <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                          (vous)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setForm({
                          kind:             'edit',
                          user_id:          u.user_id,
                          email:            u.email ?? '',
                          password:         '',
                          password_confirm: '',
                          role:             u.role,
                          originalRole:     u.role,
                          isOwnRow:         isOwn,
                        })}
                        title="Modifier"
                        className="p-2 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(u)}
                        disabled={isOwn}
                        title={isOwn ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Retirer le rôle'}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          isOwn
                            ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                            : 'text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10',
                        )}
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

        {!loading && users.length === 0 && !loadError && (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Aucun utilisateur interne. Cliquez sur « Nouvel utilisateur » pour ajouter un membre de l&apos;équipe.
          </div>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────── */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {form.kind === 'edit' ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}
              </h3>
              <button onClick={() => setForm(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Rôle *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as InternalRole })}
                  disabled={form.kind === 'edit' && form.isOwnRow}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {INTERNAL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {form.kind === 'edit' && form.isOwnRow && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Vous ne pouvez pas modifier votre propre rôle.
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="utilisateur@autodex.store"
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Name (create only) */}
              {form.kind === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Nom complet</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Prénom Nom"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}

              {/* Password — required on create, optional on edit */}
              {(() => {
                const strength = passwordStrength(form.password)
                const meta = STRENGTH_META[strength]
                const mismatch = form.password_confirm.length > 0 && form.password !== form.password_confirm
                const isCreate = form.kind === 'create'
                return (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        {isCreate ? 'Mot de passe *' : 'Nouveau mot de passe'}
                      </label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        minLength={form.password ? 8 : undefined}
                        autoComplete="new-password"
                        placeholder={isCreate ? '8 caractères minimum' : 'Laisser vide pour conserver'}
                        required={isCreate}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                      />
                      {form.password && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                            <div className={cn('h-full transition-all duration-200', meta.color, meta.widthClass)} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 text-right">
                            {meta.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {(isCreate || form.password) && (
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">
                          Confirmer le mot de passe {isCreate ? '*' : ''}
                        </label>
                        <input
                          type="password"
                          value={form.password_confirm}
                          onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                          minLength={8}
                          autoComplete="new-password"
                          required={isCreate || !!form.password}
                          className={cn(
                            'w-full h-10 px-3 rounded-lg border bg-background text-foreground text-sm outline-none focus:ring-2 transition',
                            mismatch
                              ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/20'
                              : 'border-border focus:border-indigo-400 focus:ring-indigo-500/20',
                          )}
                        />
                        {mismatch && (
                          <p className="mt-1 text-[11px] text-rose-600">Les deux mots de passe ne correspondent pas.</p>
                        )}
                      </div>
                    )}
                  </>
                )
              })()}

              {form.kind === 'create' && (
                <div className="rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/10 px-3 py-2.5">
                  <p className="text-[11px] text-violet-800 dark:text-violet-300">
                    Compte d&apos;équipe interne — non rattaché à un showroom. Un email de bienvenue sera envoyé.
                  </p>
                </div>
              )}

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
                  {saving ? 'Enregistrement…' : form.kind === 'edit' ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Success modal (post-create) ───────────────────────────── */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-card border border-border shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-semibold text-foreground">Utilisateur créé</h3>
              </div>
              <button
                onClick={() => { setCreated(null); setCopied(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {created.emailSent ? (
              <div className="px-6 py-6 space-y-4">
                <p className="text-sm text-foreground">
                  Un email avec les identifiants a été envoyé à{' '}
                  <span className="font-bold break-all">{created.email}</span>.
                </p>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => { setCreated(null); setCopied(false) }}
                    className="px-5 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    ⚠️ Compte créé mais l&apos;email n&apos;a pas pu être envoyé.
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">
                    Identifiants à transmettre manuellement :
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</p>
                  <p className="text-sm font-mono text-foreground bg-muted rounded-lg px-3 py-2 break-all select-all">{created.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mot de passe</p>
                  <p className="text-sm font-mono text-foreground bg-muted rounded-lg px-3 py-2 break-all select-all">{created.password}</p>
                </div>
                <button
                  type="button"
                  onClick={copyCredentials}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors',
                    copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white',
                  )}
                >
                  {copied ? (<><CheckCircle2 className="w-4 h-4" /> Copié</>) : (<><Copy className="w-4 h-4" /> Copier les identifiants</>)}
                </button>
                {created.emailError && (
                  <p className="text-[10px] text-muted-foreground break-all">Détail : {created.emailError}</p>
                )}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => { setCreated(null); setCopied(false) }}
                    className="px-5 py-2 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
