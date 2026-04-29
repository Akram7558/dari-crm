'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Building2, Users, Megaphone, BadgeDollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function formatDzd(n: number): string {
  return new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(n)
}

export function StatsCards() {
  const [stats, setStats] = useState({
    showrooms: 0,
    users: 0,
    leads: 0,
    revenue: 0,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ count: srCount }, { count: urCount }, { count: ldCount }, { data: ventes }] =
        await Promise.all([
          supabase.from('showrooms').select('*', { count: 'exact', head: true }).eq('active', true),
          supabase.from('user_roles').select('*', { count: 'exact', head: true }),
          supabase.from('leads').select('*', { count: 'exact', head: true }),
          supabase.from('ventes').select('prix_vente'),
        ])
      if (cancelled) return
      const revenue = (ventes ?? []).reduce(
        (acc: number, v: { prix_vente: number | null }) => acc + (v.prix_vente ?? 0),
        0,
      )
      setStats({
        showrooms: srCount ?? 0,
        users:     urCount ?? 0,
        leads:     ldCount ?? 0,
        revenue,
      })
    })()
    return () => { cancelled = true }
  }, [])

  const cards = [
    { label: 'Showrooms actifs',    value: String(stats.showrooms), icon: Building2 },
    { label: 'Utilisateurs',        value: String(stats.users),     icon: Users },
    { label: 'Total prospects',     value: String(stats.leads),     icon: Megaphone },
    { label: 'Chiffre d’affaires', value: `${formatDzd(stats.revenue)} DZD`, icon: BadgeDollarSign },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
      {cards.map((kpi, i) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-[2.5rem] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 flex items-start justify-between gap-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">{kpi.label}</p>
              <p className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white mt-3 leading-none tracking-tighter break-all">
                {kpi.value}
              </p>
            </div>
            <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
