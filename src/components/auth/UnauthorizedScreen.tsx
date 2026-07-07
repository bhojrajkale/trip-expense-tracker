import { signOutUser } from '../../utils/auth'

interface Props {
  email: string | null
}

export default function UnauthorizedScreen({ email }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center bg-[#f5f5f7] p-8 text-center"
      style={{ minHeight: '100dvh' }}
    >
      <span className="text-6xl mb-5">🔒</span>
      <h1 className="text-xl font-semibold text-[#1d1d1f] mb-2" style={{ letterSpacing: '-0.3px' }}>
        Private Instance
      </h1>
      <p className="text-[#7a7a7a] text-sm leading-relaxed max-w-xs mb-2">
        This TripTracker is a personal deployment — your account isn't on the access list.
      </p>
      {email && (
        <p className="text-xs text-[#7a7a7a] mb-6">
          Signed in as <span className="font-medium text-[#1d1d1f]">{email}</span>
        </p>
      )}
      <p className="text-[#7a7a7a] text-sm leading-relaxed max-w-xs mb-8">
        To use TripTracker with your own data, fork the project on GitHub and connect your own Firebase project.
      </p>
      <button
        onClick={signOutUser}
        className="px-6 py-3 rounded-full border border-[#0066cc] text-[#0066cc] font-medium text-sm active:scale-95 transition-transform"
      >
        Sign out
      </button>
    </div>
  )
}
