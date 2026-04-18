'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type IgnoredRow = {
  id: string
  full_name: string
  created_at: string
  assigned_to: string | null
}

type VendorName = { id: string; full_name: string | null; email: string | null }

const HOURS = 60 * 60 * 1000

export function AlertBanner() {
  const [ignored, setIgnored] = useState<IgnoredRow[]>([])
  const [vendors, setVendors] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState(false)
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    let mounted = true
    async function load() {
      const cutoff = new Date(Date.now() - 48 * HOURS).toISOString()
      const { data } = await supabase
        .from('leads')
        .select('id, full_name, created_at, assigned_to')
        .eq('status', 'new')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(20)

      if (!mounted) return
      const rows = (data ?? []) as IgnoredRow[]
      setIgnored(rows)

      const ids = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
      if (ids.length) {
        const { data: u } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', ids)
        const map: Record<string, string> = {}
        for (const row of (u ?? []) as VendorName[]) {
          map[row.id] = row.full_name || row.email || 'Vendeur inconnu'
        }
        if (mounted) setVendors(map)
      }
    }
    load()
    const id = setInterval(() => { load(); setNowMs(Date.now()) }, 60_000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  if (dismissed || ignored.length === 0) return null

  const first = ignored[0]
  const hours = Math.round((nowMs - new Date(first.created_at).getTime()) / HOURS)
  const vendor = first.assigned_to ? vendors[first.assigned_to] : null

  return (
    <div className="relative rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">
          {ignored.length === 1
            ? '1 lead ignoré depuis plus de 48 h'
            : `${ignored.length} leads ignorés depuis plus de 48 h`}
        </p>
        <p className="text-sm text-red-700 mt-0.5">
          <span className="font-medium">{first.full_name}</span>
          {vendor && <> — attribué à <span className="font-medium">{vendor}</span></>}
          {' · '}
          <span>attend depuis {hours} h</span>
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link
            href={`/dashboard/prospects?lead=${first.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800"
          >
            Voir le lead <ChevronRight className="w-3 h-3" />
          </Link>
          {ignored.length > 1 && (
            <Link
              href="/dashboard/alerts"
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700/80 hover:text-red-800"
            >
              Voir les {ignored.length - 1} autres
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 w-7 h-7 rounded-md text-red-500 hover:bg-red-100 flex items-center justify-center"
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
