import { signOutUser } from '../../utils/auth'

interface Props {
  email: string | null
}

export default function UnauthorizedScreen({ email }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-[var(--bg)] p-8 text-center"
      style={{ minHeight: '100dvh' }}
    >
      <span className="text-6xl mb-5">🔒</span>
      <h1 className="text-xl font-semibold text-[var(--ink)] mb-2" style={{ letterSpacing: '-0.3px' }}>
        Private Instance
      </h1>
      <p className="text-[var(--muted)] text-sm leading-relaxed max-w-xs mb-2">
        This TripTracker is a personal deployment — your account isn't on the access list.
      </p>
      {email && (
        <p className="text-xs text-[var(--muted)] mb-6">
          Signed in as <span className="font-medium text-[var(--ink)]">{email}</span>
        </p>
      )}
      <p className="text-[var(--muted)] text-sm leading-relaxed max-w-xs mb-8">
        To use TripTracker with your own data, fork the project on GitHub and connect your own Firebase project.
      </p>
      <button
        onClick={signOutUser}
        className="px-6 py-3 rounded-full border border-[var(--action)] text-[var(--action)] font-medium text-sm active:scale-95 transition-transform"
      >
        Sign out
      </button>
    </div>
  )
}
