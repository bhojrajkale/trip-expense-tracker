import type { Tab } from '../types'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '⊞' },
  { id: 'add', label: 'Add', icon: '+' },
  { id: 'expenses', label: 'Expenses', icon: '₹' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'activity', label: 'Feed', icon: '🕓' },
]

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface-glass-nav)] backdrop-blur-xl border-t border-[var(--hairline)] flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id
        const isAdd = tab.id === 'add'
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-label={tab.label}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[52px] active:opacity-60 transition-opacity duration-150 ${
              isAdd ? '' : isActive ? 'text-[var(--action)]' : 'text-[var(--muted)]'
            }`}
          >
            {isAdd ? (
              <span
                className="flex items-center justify-center rounded-full bg-[var(--action)] text-white font-semibold leading-none"
                style={{ width: 24, height: 24, fontSize: 18 }}
              >
                +
              </span>
            ) : (
              <span className="text-[18px] leading-none">{tab.icon}</span>
            )}
            <span
              className={`font-medium leading-none text-[10px] ${isAdd ? 'text-[var(--action)]' : ''}`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
