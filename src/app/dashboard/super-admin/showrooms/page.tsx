'use client'

import { ShowroomsManager } from '@/components/super-admin/ShowroomsManager'

export default function SuperAdminShowroomsPage() {
  return (
    <div className="p-10 pt-2 max-w-7xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          Showrooms
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
          Tous les showrooms enregistrés sur la plateforme.
        </p>
      </div>
      <ShowroomsManager />
    </div>
  )
}
