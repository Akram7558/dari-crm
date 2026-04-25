'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Activer le mode clair / Switch to light mode' : 'Activer le mode sombre / Switch to dark mode'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-white dark:hover:border-zinc-700 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
    </button>
  )
}
