'use client'

import { motion } from 'motion/react'
import { StatsCards } from '@/components/super-admin/StatsCards'
import { ShowroomsManager } from '@/components/super-admin/ShowroomsManager'
import { UsersManager } from '@/components/super-admin/UsersManager'

export default function SuperAdminDashboardPage() {
  return (
    <div className="p-10 pt-2 max-w-7xl space-y-8 pb-12">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
          Super Admin · Vue globale
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          Tableau de bord SaaS
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
          Gérez les showrooms, les utilisateurs et surveillez l&apos;activité globale d&apos;AutoDex.
        </p>
      </motion.div>

      <StatsCards />
      <ShowroomsManager />
      <UsersManager />
    </div>
  )
}
