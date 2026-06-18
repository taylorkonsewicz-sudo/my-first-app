import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [teamName, setTeamName] = useState('')

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

  // When session changes, check if profile exists
  useEffect(() => {
    if (session) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setProfile(data)
        })
    } else {
      setProfile(undefined)
    }
  }, [session])

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

  async function handleProfileSave() {
    if (!username || !teamName) {
      setMessage('Please fill in both fields')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        username: username,
        team_name: teamName
      })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setProfile({ id: session.user.id, username, team_name: teamName })
      setMessage('')
    }
  }

  // Still loading
  if (session === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading...</p>
      </div>
    )
  }

  // Not logged in — show login form
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

  // Logged in but checking for profile
  if (profile === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading your profile...</p>
      </div>
    )
  }

  // Logged in but no profile yet — show profile creation form
  if (profile === null) {
    return (
      <div style={{
        maxWidth: '400px',
        margin: '100px auto',
        padding: '20px',
        fontFamily: 'sans-serif'
      }}>
        <h1>🏈 Sunday Funday</h1>
        <h2>Set up your profile</h2>
        <p>Just two things and you're in!</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Your name (e.g. Taylor)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <input
            type="text"
            placeholder="Your team name (e.g. Taylor's Touchdowns)"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button
            onClick={handleProfileSave}
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
            Let's go! 🏈
          </button>

          {message && (
            <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>
              {message}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Logged in with profile — show dashboard
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🏈 Sunday Funday</h1>
      <h2>Welcome back, {profile.username}!</h2>
      <p>Your team: <strong>{profile.team_name}</strong></p>
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
