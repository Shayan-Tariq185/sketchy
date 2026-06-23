import { useEffect, useState } from 'react';
import { ArrowRight, PencilLine, Users, Lock, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import DoodleHero from '../components/DoodleHero';
import { getInviteRoomCode } from '../utils/roomLink';

const NAME_SUGGESTIONS = ['Doodler', 'Sketch Lord', 'Scribbler', 'Pencil Pete'];

export default function HomeScreen() {
  const { createRoom, joinRoom, error, setError, connecting } = useGame();
  const [mode, setMode] = useState('create'); // create | join
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    const inviteCode = getInviteRoomCode();
    if (inviteCode) {
      setCode(inviteCode);
      setMode('join');
      setInvited(true);
    }
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const finalName = name.trim() || NAME_SUGGESTIONS[Math.floor(Math.random() * NAME_SUGGESTIONS.length)];
    setBusy(true);
    await createRoom(finalName);
    setBusy(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Enter the room code your friend shared with you.');
      return;
    }
    const finalName = name.trim() || NAME_SUGGESTIONS[Math.floor(Math.random() * NAME_SUGGESTIONS.length)];
    setBusy(true);
    await joinRoom(code.trim().toUpperCase(), finalName);
    setBusy(false);
  };

  return (
    <main className="screen">
      <div className="home-hero">
        <DoodleHero />
        <div className="brand-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <div className="brand-mark">
            <PencilLine size={20} color="#FFC93C" />
          </div>
          <span className="brand-name">Sketchy</span>
        </div>
        <h1 className="home-headline">
          Draw it. <span className="pencil-underline">Guess it.</span>
          <br />
          Just your friends.
        </h1>
        <p className="home-subline">
          No public matchmaking, no strangers. Make a room, send the code to your group chat, and start sketching.
        </p>

        <div className="home-badges">
          <span className="tag-chip">
            <Lock size={13} /> Private rooms only
          </span>
          <span className="tag-chip">
            <Users size={13} /> 2–12 players
          </span>
          <span className="tag-chip">
            <Sparkles size={13} /> Streaks &amp; replays
          </span>
        </div>
      </div>

      <div className="paper-card home-card">
        <div className="home-tabs">
          <button
            className={mode === 'create' ? 'home-tab active' : 'home-tab'}
            onClick={() => {
              setMode('create');
              setError('');
            }}
          >
            Create a room
          </button>
          <button
            className={mode === 'join' ? 'home-tab active' : 'home-tab'}
            onClick={() => {
              setMode('join');
              setError('');
            }}
          >
            Join with a code
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="home-form">
            <div>
              <label className="label-text" htmlFor="name-create">
                Your display name
              </label>
              <input
                id="name-create"
                className="input-field"
                placeholder=""
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                autoFocus
              />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || connecting}>
              {busy ? 'Creating room…' : 'Create private room'} <ArrowRight size={16} />
            </button>
            <p className="form-hint">You'll get a room code to share with friends right after.</p>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="home-form">
            {invited ? (
              <p className="form-hint" style={{ marginBottom: 4 }}>
                You were invited to room <strong>{code}</strong> — pick a name and join.
              </p>
            ) : null}
            <div>
              <label className="label-text" htmlFor="code-join">
                Room code
              </label>
              <input
                id="code-join"
                className="input-field input-code"
                placeholder="e.g. KX9PL"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setInvited(false);
                }}
                maxLength={6}
                autoFocus={!invited}
              />
            </div>
            <div>
              <label className="label-text" htmlFor="name-join">
                Your display name
              </label>
              <input
                id="name-join"
                className="input-field"
                placeholder=""
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={18}
                autoFocus={invited}
              />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn btn-mint btn-block" type="submit" disabled={busy || connecting}>
              {busy ? 'Joining…' : 'Join room'} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>

      <footer className="home-footer">Built for game nights with people you actually know.</footer>
    </main>
  );
}
