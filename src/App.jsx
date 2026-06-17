import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setMessage('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage('Error: ' + error.message)
      } else {
        setMessage('Check your email to confirm your account!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage('Error: ' + error.message)
      }
    }
  }

  if (session === undefined) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading...</p>
      </div>
    )
  }

  if (session === null) {
    return (
      <div style={{
        maxWidth: '400px',
        margin: '100px auto',
        padding: '20px',
        fontFamily: 'sans-serif'
      }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Sign in to join your league</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px',
              fontSize: '16px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          {message && (
            <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>
              {message}
            </p>
          )}

          <p
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ cursor: 'pointer', color: '#3b82f6', textAlign: 'center' }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🏈 Sunday Funday</h1>
      <p>Welcome! Logged in as: {session.user.email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          padding: '10px 20px',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Sign Out
      </button>
    </div>
  )
}

export default App
