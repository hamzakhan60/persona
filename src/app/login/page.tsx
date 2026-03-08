'use client'

import { useState } from 'react'
import { loginAction, signupAction } from './action'

export default function LoginPage() {
  const [mode,     setMode]     = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit() {
    if (!email || !password) { setError('Email and password are required'); return }
    if (mode === 'signup' && !name) { setError('Name is required'); return }

    setLoading(true)
    setError('')

    try {
      const result = mode === 'login'
        ? await loginAction(email, password)
        : await signupAction(email, password, name)

      // If we get here without redirect, there was an error
      if (result?.error) setError(result.error)
    } catch {
      // redirect() in server actions throws internally — this is expected and fine
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontSize: 28, fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 8,
          }}>
            Prep<span style={{ color: 'var(--accent)' }}>Talk</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {mode === 'login'
              ? 'Sign in to your account'
              : 'Create your free account'}
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            padding: 4,
            marginBottom: 24,
          }}>
            {(['login', 'signup'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError('') }}
                style={{
                  flex: 1, padding: '8px', borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 14, fontWeight: 500,
                  background:  mode === tab ? 'var(--bg-card)' : 'transparent',
                  color:       mode === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {/* Name — signup only */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">Full name</label>
              <input
                className="input-field"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKey}
                autoFocus
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Email</label>
            <input
              className="input-field"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              autoFocus={mode === 'login'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label className="label">Password</label>
            <input
              className="input-field"
              type="password"
              placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#2D1515', border: '1px solid #5C2020',
              color: '#FCA5A5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{mode === 'login' ? 'Signing in' : 'Creating account'}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </span>
            ) : mode === 'login' ? 'Sign in →' : 'Create account →'}
          </button>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          color: 'var(--text-muted)', fontSize: 12,
        }}>
          By signing up you agree to our terms of service.
        </p>
      </div>
    </div>
  )
}