'use client'

import { UsersManager } from '@/components/super-admin/UsersManager'

export default function SuperAdminUsersPage() {
  return (
    <div className="p-10 pt-2 max-w-7xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          Utilisateurs
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
          Gérez les rôles et les affectations aux showrooms.
        </p>
      </div>
      <UsersManager />
    </div>
  )
}
