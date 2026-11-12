import { CloudOff } from 'lucide-react'

import { useOnline } from '@/hooks/useOnline'

/** Banner global quando o dispositivo está sem conexão (FR-032). */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400"
    >
      <CloudOff className="h-3.5 w-3.5" />
      Sem conexão — a leitura continua, mas criar e editar exige internet.
    </div>
  )
}
