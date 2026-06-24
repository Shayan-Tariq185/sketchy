import { useState } from 'react';
import { LogOut, Palette, Play, Sparkles, Timer, Users, Lightbulb, Gift, Swords } from 'lucide-react';
import { useGame } from '../context/GameContext';
import RoomCodeTicket from '../components/RoomCodeTicket';
import PlayerList from '../components/PlayerList';

const WORD_PACKS = ['Classic', 'Pakistani Edition', 'Tech & Internet', 'Sports', 'Geography'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const TEAM_COLORS = ['#FF5D5D', '#4D6BFE'];
const TEAM_NAMES  = ['Team Red', 'Team Blue'];
const MIN_TEAM_MODE_PLAYERS = 4;

function TeamAssigner({ room, isHost, updateSettings }) {
  // Local team assignments keyed by playerId -> teamIndex (0 or 1)
  const players = room.players.filter((p) => p.connected);

  // Build live assignments from current room.teams if available, else default
  // to an even round-robin split so the panel never opens with an empty side.
  const [assignments, setAssignments] = useState(() => {
    const map = {};
    players.forEach((p, i) => { map[p.id] = i % 2; });
    return map;
  });

  const teamGroups = [0, 1].map((ti) =>
    players.filter((p) => (assignments[p.id] ?? (players.indexOf(p) % 2)) === ti)
  );

  function movePlayer(pid, toTeam) {
    const next = { ...assignments, [pid]: toTeam };
    setAssignments(next);
    // Push to server as teamAssignments
    const serverAssignments = [0, 1].map((ti) => ({
      teamId: `team-${ti}`,
      playerIds: players.filter((p) => (next[p.id] ?? (players.indexOf(p) % 2)) === ti).map((p) => p.id),
    }));
    updateSettings({ teamAssignments: serverAssignments });
  }

  return (
    <div className="team-assigner">
      {teamGroups.map((members, ti) => (
        <div key={ti} className="team-col" style={{ '--team-color': TEAM_COLORS[ti] }}>
          <div className="team-col-header" style={{ background: TEAM_COLORS[ti] }}>
            {TEAM_NAMES[ti]}
          </div>
          <div className="team-col-body">
            {members.map((p) => (
              <div key={p.id} className="team-player-chip">
                <span className="avatar-dot" style={{ background: p.color }}>{p.name[0]}</span>
                <span className="team-player-name">{p.name}</span>
                {isHost && (
                  <div className="team-move-btns">
                    <button
                      className="team-move-btn"
                      style={{ background: TEAM_COLORS[ti === 0 ? 1 : 0] }}
                      title={`Move to ${TEAM_NAMES[ti === 0 ? 1 : 0]}`}
                      onClick={() => movePlayer(p.id, ti === 0 ? 1 : 0)}
                    >→</button>
                  </div>
                )}
              </div>
            ))}
            {members.length === 0 && <p className="team-empty">No players</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LobbyScreen() {
  const { room, playerId, leaveRoom, startGame, updateSettings } = useGame();
  const me = room.players.find((p) => p.id === playerId);
  const isHost = !!me?.isHost;
  const canStart = room.players.filter((p) => p.connected).length >= 2;
  const canBonus = room.players.filter((p) => p.connected).length >= 5;
  const canTeamMode = room.players.filter((p) => p.connected).length >= MIN_TEAM_MODE_PLAYERS;
  const teamMode = !!room.settings.teamMode && canTeamMode;

  return (
    <main className="screen screen-narrow">
      <div className="page-header">
        <div className="brand-row">
          <div className="brand-mark" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <Sparkles size={15} color="#FFC93C" />
          </div>
          <span className="brand-name" style={{ fontSize: 18 }}>
            Sketchy
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>
          <LogOut size={14} /> Leave
        </button>
      </div>

      <RoomCodeTicket code={room.code} />

      <section className="paper-card lobby-section">
        <div className="lobby-section-head">
          <Users size={16} />
          <h3>Players ({room.players.length}/12)</h3>
        </div>
        <PlayerList showKick />
        {room.players.length < 2 ? (
          <p className="lobby-hint">Waiting for at least one more friend to join before you can start.</p>
        ) : null}
      </section>

      <section className="paper-card lobby-section">
        <div className="lobby-section-head">
          <Palette size={16} />
          <h3>Game settings</h3>
          {!isHost ? <span className="tag-chip">Host only</span> : null}
        </div>

        <div className="settings-grid">
          <div className="settings-field">
            <label className="label-text">Word pack</label>
            <select
              className="input-field"
              disabled={!isHost}
              value={room.settings.wordPack}
              onChange={(e) => updateSettings({ wordPack: e.target.value })}
            >
              {WORD_PACKS.map((pack) => (
                <option key={pack} value={pack}>
                  {pack}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <label className="label-text">Difficulty</label>
            <select
              className="input-field"
              disabled={!isHost}
              value={room.settings.difficulty}
              onChange={(e) => updateSettings({ difficulty: e.target.value })}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <label className="label-text">
              <Timer size={12} style={{ verticalAlign: 'middle' }} /> Draw time: {room.settings.drawTime}s
            </label>
            <input
              type="range"
              min="30"
              max="180"
              step="10"
              disabled={!isHost}
              value={room.settings.drawTime}
              onChange={(e) => updateSettings({ drawTime: Number(e.target.value) })}
            />
          </div>

          <div className="settings-field">
            <label className="label-text">Rounds: {room.settings.maxRounds}</label>
            <input
              type="range"
              min="2"
              max="20"
              disabled={!isHost}
              value={room.settings.maxRounds}
              onChange={(e) => updateSettings({ maxRounds: Number(e.target.value) })}
            />
          </div>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={!isHost}
            checked={room.settings.choiceMode}
            onChange={(e) => updateSettings({ choiceMode: e.target.checked })}
          />
          <span>Let the drawer pick from 3 words each round</span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={!isHost}
            checked={!!room.settings.hints}
            onChange={(e) => updateSettings({ hints: e.target.checked })}
          />
          <span>
            <Lightbulb size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Letter hints (reveal random letters as time runs low)
          </span>
        </label>

        <label className={`toggle-row ${!canTeamMode ? 'toggle-row--disabled' : ''}`}>
          <input
            type="checkbox"
            disabled={!isHost || !canTeamMode}
            checked={teamMode}
            onChange={(e) => updateSettings({ teamMode: e.target.checked })}
          />
          <span>
            <Swords size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Team vs Team mode — 2 teams, opposing team guesses, same team cheers
          </span>
        </label>
        {!canTeamMode ? (
          <p className="lobby-hint">Need at least {MIN_TEAM_MODE_PLAYERS} players in the room to unlock team mode.</p>
        ) : null}

        <label className={`toggle-row ${!canBonus ? 'toggle-row--disabled' : ''}`}>
          <input
            type="checkbox"
            disabled={!isHost || !canBonus}
            checked={!!room.settings.bonusRound && canBonus}
            onChange={(e) => updateSettings({ bonusRound: e.target.checked })}
          />
          <span>
            <Gift size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Bonus round after the match (5+ players — everyone draws, then guess who drew what)
          </span>
        </label>
        {!canBonus ? (
          <p className="lobby-hint">Need at least 5 players in the room to unlock the bonus round.</p>
        ) : null}
      </section>

      {teamMode && (
        <section className="paper-card lobby-section">
          <div className="lobby-section-head">
            <Swords size={16} />
            <h3>Team assignments</h3>
          </div>
          <p className="lobby-hint" style={{ marginTop: -6, marginBottom: 14 }}>
            {isHost ? 'Move players between teams using the arrows.' : 'The host is assigning teams.'}
          </p>
          <TeamAssigner
            room={room}
            isHost={isHost}
            updateSettings={updateSettings}
          />
        </section>
      )}

      {isHost ? (
        <button className="btn btn-primary btn-block btn-lg" onClick={startGame} disabled={!canStart}>
          <Play size={18} /> Start game
        </button>
      ) : (
        <div className="waiting-banner">Waiting for the host to start the game…</div>
      )}
    </main>
  );
}