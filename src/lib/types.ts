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
  created_at: string
  updated_at: string
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
