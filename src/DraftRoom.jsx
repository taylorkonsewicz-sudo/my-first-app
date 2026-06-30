import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
const ROSTER_SLOTS = {
  QB: 2, RB: 4, WR: 4, TE: 2, K: 1, DEF: 1
}
const TOTAL_ROUNDS = 14
const TEAM_COUNT = 8
const SECONDS_PER_PICK = 90

export default function DraftRoom({ session, profile, league, onDraftComplete }) {
  const [players, setPlayers] = useState([])
  const [picks, setPicks] = useState([])
  const [draftOrder, setDraftOrder] = useState([])
  const [members, setMembers] = useState([])
  const [filterPosition, setFilterPosition] = useState('ALL')
  const [searchName, setSearchName] = useState('')
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_PICK)
  const [message, setMessage] = useState('')
  const [draftStatus, setDraftStatus] = useState(league.draft_status)

  const isCommissioner = league.commissioner_id === session.user.id

 // Load everything when component mounts
  useEffect(() => {
    loadPlayers()
    loadMembers()
    loadPicks()

    // Listen for new picks in real time
    const picksChannel = supabase
      .channel('draft_picks_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'draft_picks',
        filter: `league_id=eq.${league.id}`
      }, () => {
        loadPicks()
      })
      .subscribe()

    // Listen for league status changes (like draft starting)
    const leagueChannel = supabase
      .channel('league_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${league.id}`
      }, (payload) => {
        setDraftStatus(payload.new.draft_status)
        setDraftOrder(payload.new.draft_order || [])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(picksChannel)
      supabase.removeChannel(leagueChannel)
    }
  }, [])

  // Timer countdown
  useEffect(() => {
    if (draftStatus !== 'active') return
    if (timeLeft <= 0) {
      handleAutoPick()
      return
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, draftStatus])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('position')
      .order('full_name')
    setPlayers(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('league_members')
      .select('*, profiles(username, team_name)')
      .eq('league_id', league.id)
    setMembers(data || [])
  }

  async function loadPicks() {
    const { data } = await supabase
      .from('draft_picks')
      .select('*, players(*)')
      .eq('league_id', league.id)
      .order('pick_number')
    setPicks(data || [])
  }

  async function startDraft() {
    if (members.length < 1) {
      setMessage('You need at least 1 teams to start the draft')
      return
    }

    // Randomly shuffle member order for draft
    const shuffled = [...members].sort(() => Math.random() - 0.5)
    const order = shuffled.map(m => m.user_id)

    const { error } = await supabase
      .from('leagues')
      .update({
        draft_status: 'active',
        draft_order: order
      })
      .eq('id', league.id)

    if (error) {
      setMessage('Error starting draft: ' + error.message)
      return
    }

    setDraftOrder(order)
    setDraftStatus('active')
    setTimeLeft(SECONDS_PER_PICK)
  }

  // Figure out whose turn it is
  function getCurrentPicker() {
    const pickNumber = picks.length
    const round = Math.floor(pickNumber / TEAM_COUNT)
    const isEvenRound = round % 2 === 0
    const positionInRound = pickNumber % TEAM_COUNT
    const orderIndex = isEvenRound
      ? positionInRound
      : TEAM_COUNT - 1 - positionInRound
    return draftOrder[orderIndex]
  }

  async function handlePick(player) {
    if (draftStatus !== 'active') return

    const currentPicker = getCurrentPicker()
    if (currentPicker !== session.user.id) {
      setMessage("It's not your turn yet!")
      return
    }

    // Check if player already picked
    const alreadyPicked = picks.find(p => p.player_id === player.id)
    if (alreadyPicked) {
      setMessage('That player is already taken!')
      return
    }

    const pickNumber = picks.length + 1
    const round = Math.floor(picks.length / TEAM_COUNT) + 1

    const { error } = await supabase
      .from('draft_picks')
      .insert({
        league_id: league.id,
        player_id: player.id,
        user_id: session.user.id,
        pick_number: pickNumber,
        round: round
      })

    if (error) {
      setMessage('Error making pick: ' + error.message)
      return
    }

    await loadPicks()
    setTimeLeft(SECONDS_PER_PICK)
    setMessage('')

    // Check if draft is complete
    if (pickNumber >= TEAM_COUNT * TOTAL_ROUNDS) {
      await supabase
        .from('leagues')
        .update({ draft_status: 'complete' })
        .eq('id', league.id)
      setDraftStatus('complete')
    }
  }

  async function handleAutoPick() {
    const currentPicker = getCurrentPicker()
    if (currentPicker !== session.user.id) {
      setTimeLeft(SECONDS_PER_PICK)
      return
    }

    // Pick the first available player
    const pickedIds = picks.map(p => p.player_id)
    const available = players.find(p => !pickedIds.includes(p.id))
    if (available) {
      await handlePick(available)
    }
  }

  // Get my roster
  const myPicks = picks.filter(p => p.user_id === session.user.id)
  const pickedPlayerIds = picks.map(p => p.player_id)

  // Filter available players
  const availablePlayers = players.filter(p => {
    const notPicked = !pickedPlayerIds.includes(p.id)
    const matchesPosition = filterPosition === 'ALL' || p.position === filterPosition
    const matchesSearch = p.full_name.toLowerCase().includes(searchName.toLowerCase())
    return notPicked && matchesPosition && matchesSearch
  })

  const currentPicker = draftStatus === 'active' ? getCurrentPicker() : null
  const isMyTurn = currentPicker === session.user.id
  const currentPickerProfile = members.find(m => m.user_id === currentPicker)
  const currentRound = Math.floor(picks.length / TEAM_COUNT) + 1
  const currentPickInRound = (picks.length % TEAM_COUNT) + 1

    if (members === undefined) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>🏈 Sunday Funday</h1>
        <p>Loading draft room...</p>
      </div>
    )
  }

  // Waiting for draft to start
  if (draftStatus === 'waiting') {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
        <h1>🏈 Sunday Funday</h1>
        <h2>Draft Room — {league.name}</h2>
        <div style={{
          padding: '20px',
          backgroundColor: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
          marginBottom: '20px'
        }}>
          <h3>Teams Joined ({members.length}/8)</h3>
          {members.map(m => (
            <div key={m.user_id} style={{
              padding: '8px',
              marginBottom: '6px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              {m.profiles?.username} — <strong>{m.profiles?.team_name}</strong>
              {m.user_id === league.commissioner_id && ' 👑'}
            </div>
          ))}
        </div>

        {isCommissioner ? (
          <div>
            <p>As commissioner, you control when the draft starts.</p>
            <button
              onClick={startDraft}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Start Draft 🏈
            </button>
          </div>
        ) : (
          <p>Waiting for the commissioner to start the draft...</p>
        )}

        {message && <p style={{ color: 'red' }}>{message}</p>}
      </div>
    )
  }

  // Draft complete
  if (draftStatus === 'complete') {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
        <h1>🏈 Sunday Funday</h1>
        <h2>Draft Complete!</h2>
        <p>Your team, {profile.team_name}:</p>
        {POSITIONS.map(pos => {
          const posPlayers = myPicks.filter(p => p.players?.position === pos)
          if (posPlayers.length === 0) return null
          return (
            <div key={pos}>
              <h3>{pos}</h3>
              {posPlayers.map(p => (
                <div key={p.id} style={{
                  padding: '8px',
                  marginBottom: '4px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px'
                }}>
                  {p.players?.full_name} — {p.players?.nfl_team}
                </div>
              ))}
            </div>
          )
        })}
        <button
          onClick={onDraftComplete}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Go to My Team 🏈
        </button>
      </div>
    )
  }

  // Active draft
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🏈 Sunday Funday Draft</h1>

      {/* Draft status bar */}
      <div style={{
        padding: '15px',
        backgroundColor: isMyTurn ? '#f0fdf4' : '#eff6ff',
        borderRadius: '10px',
        border: `2px solid ${isMyTurn ? '#22c55e' : '#3b82f6'}`,
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
          Round {currentRound} — Pick {currentPickInRound} of {TEAM_COUNT}
        </p>
        <p style={{ margin: '4px 0', fontSize: '16px' }}>
          {isMyTurn
            ? '⭐ YOUR TURN TO PICK!'
            : `Waiting for ${currentPickerProfile?.profiles?.username || 'next team'}...`
          }
        </p>
        <p style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 'bold',
          color: timeLeft <= 10 ? 'red' : '#333'
        }}>
          ⏱ {timeLeft}s
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

        {/* Player list */}
        <div style={{ flex: 2, minWidth: '280px' }}>
          <h3>Available Players</h3>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {['ALL', ...POSITIONS].map(pos => (
              <button
                key={pos}
                onClick={() => setFilterPosition(pos)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: filterPosition === pos ? '#22c55e' : '#e5e7eb',
                  color: filterPosition === pos ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {pos}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search player name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {availablePlayers.map(player => (
              <div
                key={player.id}
                onClick={() => handlePick(player)}
                style={{
                  padding: '10px',
                  marginBottom: '4px',
                  backgroundColor: isMyTurn ? 'white' : '#f9fafb',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  cursor: isMyTurn ? 'pointer' : 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: isMyTurn ? 1 : 0.7
                }}
              >
                <span>
                  <strong style={{ color: '#22c55e' }}>{player.position}</strong>
                  {' '}{player.full_name}
                </span>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {player.nfl_team} · Bye {player.bye_week}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* My roster */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3>My Team ({myPicks.length}/{TOTAL_ROUNDS})</h3>
          {POSITIONS.map(pos => {
            const posPlayers = myPicks.filter(p => p.players?.position === pos)
            if (posPlayers.length === 0) return null
            return (
              <div key={pos} style={{ marginBottom: '10px' }}>
                <p style={{
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#666',
                  textTransform: 'uppercase'
                }}>{pos}</p>
                {posPlayers.map(p => (
                  <div key={p.id} style={{
                    padding: '6px 8px',
                    marginBottom: '3px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}>
                    {p.players?.full_name}
                  </div>
                ))}
              </div>
            )
          })}

          {message && (
            <p style={{ color: 'red', fontSize: '14px' }}>{message}</p>
          )}
        </div>
      </div>

      {/* Recent picks */}
      <div style={{ marginTop: '20px' }}>
        <h3>Recent Picks</h3>
        <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {[...picks].reverse().slice(0, 10).map(pick => {
            const picker = members.find(m => m.user_id === pick.user_id)
            return (
              <div key={pick.id} style={{
                padding: '6px 10px',
                marginBottom: '3px',
                backgroundColor: pick.user_id === session.user.id ? '#f0fdf4' : '#f9fafb',
                borderRadius: '6px',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>
                  Pick {pick.pick_number} — <strong>{pick.players?.full_name}</strong> ({pick.players?.position})
                </span>
                <span style={{ color: '#666' }}>
                  {picker?.profiles?.username}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
