import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [league, setLeague] = useState(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [teamName, setTeamName] = useState('')
  const [leagueName, setLeagueName] = useState('')
  const [screen, setScreen] = useState('dashboard')

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

  // When session changes, load profile
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
      setLeague(undefined)
    }
  }, [session])

  // When profile loads, check if they're in a league
  useEffect(() => {
    if (profile) {
      supabase
        .from('league_members')
        .select('*, leagues(*)')
        .eq('user_id', session.user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setLeague(data.leagues)
          } else {
            setLeague(null)
          }
        })
    }
  }, [profile])

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

  async function handleCreateLeague() {
    if (!leagueName) {
      setMessage('Please enter a league name')
      return
    }

    // Generate a random 6 character invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Create the league
    const { data: newLeague, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: leagueName,
        commissioner_id: session.user.id,
        invite_code: inviteCode
      })
      .select()
      .single()

    if (leagueError) {
      setMessage('Error creating league: ' + leagueError.message)
      return
    }

    // Add creator as first member
    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: newLeague.id,
        user_id: session.user.id,
        team_name: profile.team_name
      })

    if (memberError) {
      setMessage('Error joining league: ' + memberError.message)
      return
    }

    setLeague(newLeague)
    setScreen('dashboard')
    setMessage('')
  }

  // Still loading session
  if (session === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading...</p>
      </div>
    )
  }

  // Not logged in
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

  // Logged in, loading profile
  if (profile === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading your profile...</p>
      </div>
    )
  }

  // Logged in, no profile yet
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

  // Logged in, loading league
  if (league === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading your league...</p>
      </div>
    )
  }

  // Logged in, no league yet — show create league screen
  if (screen === 'createLeague') {
    return (
      <div style={{
        maxWidth: '400px',
        margin: '100px auto',
        padding: '20px',
        fontFamily: 'sans-serif'
      }}>
        <h1>🏈 Sunday Funday</h1>
        <h2>Create a League</h2>
        <p>Give your league a name and we'll generate an invite code for your friends.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="League name (e.g. Sunday Funday Season 1)"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button
            onClick={handleCreateLeague}
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
            Create League 🏈
          </button>

          {message && (
            <p style={{ color: message.startsWith('Error') ? 'red' : 'green' }}>
              {message}
            </p>
          )}

          <p
            onClick={() => { setScreen('dashboard'); setMessage('') }}
            style={{ cursor: 'pointer', color: '#3b82f6', textAlign: 'center' }}
          >
            Back to dashboard
          </p>
        </div>
      </div>
    )
  }

  // Dashboard — with or without a league
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🏈 Sunday Funday</h1>
      <h2>Welcome back, {profile.username}!</h2>
      <p>Your team: <strong>{profile.team_name}</strong></p>

      {league ? (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0'
        }}>
          <h3>Your League</h3>
          <p style={{ fontSize: '20px', fontWeight: 'bold' }}>{league.name}</p>
          <p>Invite your friends with this code:</p>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            letterSpacing: '8px',
            color: '#16a34a',
            padding: '10px',
            backgroundColor: 'white',
            borderRadius: '8px',
            textAlign: 'center',
            border: '2px dashed #16a34a'
          }}>
            {league.invite_code}
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Share this code with your friends so they can join!
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <p>You're not in a league yet.</p>
          <button
            onClick={() => setScreen('createLeague')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Create a League
          </button>
        </div>
      )}

      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          marginTop: '30px',
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
