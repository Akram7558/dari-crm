export type Showroom = {
  id: string
  name: string
  city: string
  address: string | null
  phone: string | null
  created_at: string
}

export type AppUser = {
  id: string
  showroom_id: string | null
  email: string
  full_name: string
  role: 'admin' | 'manager' | 'agent'
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export type Vehicle = {
  id: string
  showroom_id: string | null
  brand: string
  model: string
  year: number | null
  color: string | null
  vin: string | null
  price_dzd: number | null
  status: 'available' | 'reserved' | 'sold'
  created_at: string
  image_url: string | null
  reserved_by_lead_id: string | null
  kilometrage: number | null
  etat_carrosserie: string | null
  finition: string | null
  carte_grise: string | null
  type_moteur: string | null
}

export type LeadSource =
  | 'walk-in'
  | 'phone'
  | 'website'
  | 'referral'
  | 'social'
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'telephone'

export type Lead = {
  id: string
  showroom_id: string | null
  assigned_to: string | null
  vehicle_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  wilaya: string | null
  source: LeadSource
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  notes: string | null
  // fields added by migration_01_kanban.sql
  model_wanted: string | null
  budget_dzd: number | null
  // field added by migration_07_leads_suivi.sql — independent follow-up tracker
  suivi: LeadSuivi | null
  created_at: string
  updated_at: string
}

// ── Suivi (follow-up attempts) — distinct from sales pipeline `status` ───
export type LeadSuivi =
  | 'tentative_1'
  | 'tentative_2'
  | 'tentative_3'
  | 'reporter'
  | 'rdv_planifie'
  | 'perdu'

export const LEAD_SUIVI_LABELS: Record<LeadSuivi, string> = {
  tentative_1:  'Tentative 1',
  tentative_2:  'Tentative 2',
  tentative_3:  'Tentative 3',
  reporter:     'Reporter',
  rdv_planifie: 'RDV planifié',
  perdu:        'Perdu',
}

export const LEAD_SUIVI_VALUES: LeadSuivi[] = [
  'tentative_1', 'tentative_2', 'tentative_3', 'reporter', 'rdv_planifie', 'perdu',
]

export const LEAD_SUIVI_BADGE_CLASSES: Record<LeadSuivi, string> = {
  tentative_1:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 border-yellow-200/60 dark:border-yellow-500/20',
  tentative_2:  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 border-orange-200/60 dark:border-orange-500/20',
  tentative_3:  'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-200/60 dark:border-red-500/20',
  reporter:     'bg-amber-200 text-amber-900 dark:bg-amber-700/30 dark:text-amber-300 border-amber-400/60 dark:border-amber-700/40',
  rdv_planifie: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20',
  perdu:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/50',
}

export type Activity = {
  id: string
  lead_id: string | null
  user_id: string | null
  type: 'call' | 'email' | 'meeting' | 'note' | 'status_change'
  title: string
  body: string | null
  scheduled_at: string | null
  done: boolean
  created_at: string
  // joined relations
  leads?: { full_name: string } | null
  users?: { full_name: string } | null
}

// ── Display labels ───────────────────────────────────────────────

export const LEAD_STATUS_LABELS: Record<Lead['status'], string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'RDV planifié',
  proposal: 'Offre faite',
  won: 'Vendu',
  lost: 'Perdu',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  'walk-in':   'Showroom',
  phone:       'Téléphone',
  website:     'Site web',
  referral:    'Recommandation',
  social:      'Réseaux sociaux',
  facebook:    'Facebook',
  instagram:   'Instagram',
  whatsapp:    'WhatsApp',
  telephone:   'Téléphone',
}

export const VEHICLE_STATUS_LABELS: Record<Vehicle['status'], string> = {
  available: 'Disponible',
  reserved:  'Réservé',
  sold:      'Vendu',
}

export const ACTIVITY_TYPE_LABELS: Record<Activity['type'], string> = {
  call:          'Appel',
  email:         'Email',
  meeting:       'Réunion',
  note:          'Note',
  status_change: 'Changement statut',
}

// ── Notifications / alerts ───────────────────────────────────────

export type NotificationType =
  | 'lead_ignored'
  | 'lead_stagnant'
  | 'stock_rupture'
  | 'vendor_inactive'

export type Notification = {
  id: string
  showroom_id: string | null
  user_id: string | null
  type: NotificationType
  title: string
  message: string
  lead_id: string | null
  vehicle_id: string | null
  dedupe_key: string | null
  read: boolean
  created_at: string
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  lead_ignored:    'Lead ignoré',
  lead_stagnant:   'Lead stagnant',
  stock_rupture:   'Rupture de stock',
  vendor_inactive: 'Vendeur inactif',
}

// ── Integrations (Meta OAuth) ────────────────────────────────────

export type IntegrationProvider = 'whatsapp' | 'messenger' | 'instagram'

export type Integration = {
  id: string
  showroom_id: string
  provider: IntegrationProvider
  account_name: string | null
  account_id: string | null
  phone_number: string | null
  access_token: string | null
  expires_at: string | null
  is_active: boolean
  connected_at: string
}

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  whatsapp:  'WhatsApp Business',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram Business',
}

// ── 58 Wilayas d'Algérie ─────────────────────────────────────────
export const WILAYAS_58: string[] = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa',
  'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa',
  'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel',
  'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
  'Constantine', 'Médéa', 'Mostaganem', "M'Sila", 'Mascara', 'Ouargla',
  'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès',
  'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma',
  'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun',
  'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah',
  'In Guezzam', 'Touggourt', 'Djanet', "El M'ghair", 'El Menia',
]
