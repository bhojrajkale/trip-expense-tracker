import { useState } from 'react'
import { signInWithGoogle } from '../../utils/auth'

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch {
      setError('Sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center bg-[#f5f5f7] p-8 text-center" style={{ minHeight: '100dvh' }}>
      <span className="text-6xl mb-5">✈️</span>
      <h1 className="text-2xl font-semibold text-[#1d1d1f] mb-2" style={{ letterSpacing: '-0.3px' }}>TripTracker</h1>
      <p className="text-[#7a7a7a] text-[17px] mb-10 max-w-xs leading-relaxed">
        Sign in to sync your trips and expenses across all your devices.
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex items-center gap-3 px-7 py-3.5 rounded-full bg-white border border-[#e0e0e0] text-[#1d1d1f] font-medium text-base disabled:opacity-50 active:scale-95 transition-transform"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <GoogleIcon />
        {loading ? 'Signing in…' : 'Continue with Google'}
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}
