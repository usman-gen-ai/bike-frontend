import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { auth, getErrorMessage } from '@lib/api'

export const LoginPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.isLoggedIn()) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-2xl shadow-lg">🏍️</div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Bike Admin</h1>
          <p className="text-sm text-gray-500">Sign in to manage models & media</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <input
            type="email" required autoFocus placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <input
            type="password" required placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors"
        >
          {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <LockClosedIcon className="w-4 h-4" />}
          Sign in
        </button>
      </form>
    </div>
  )
}

export default LoginPage
