import { useState } from 'react';
import { LogOut, Palette, Play, Sparkles, Timer, Users, Mic, Gift, Swords } from 'lucide-react';
import { useGame } from '../context/GameContext';
import RoomCodeTicket from '../components/RoomCodeTicket';
import PlayerList from '../components/PlayerList';

const WORD_PACKS = ['Classic', 'Pakistani Edition', 'Tech & Internet', 'Sports', 'Geography'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const TEAM_COLORS = ['#FF5D5D', '#4D6BFE', '#3DDC97', '#FFC93C'];
const TEAM_NAMES  = ['Team Red', 'Team Blue', 'Team Green', 'Team Gold'];

function TeamAssigner({ room, teamCount, isHost, updateSettings }) {
  // Local team assignments keyed by playerId -> teamIndex
  const players = room.players.filter((p) => p.connected);
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    id: `team-${i}`,
    name: TEAM_NAMES[i],
    color: TEAM_COLORS[i],
    playerIds: players.filter((_, pi) => pi % teamCount === i).map((p) => p.id),
  }));

  // Build live assignments from current room.teams if available, else default
  const [assignments, setAssignments] = useState(() => {
    const map = {};
    players.forEach((p, i) => { map[p.id] = i % teamCount; });
    return map;
  });

  const teamGroups = Array.from({ length: teamCount }, (_, ti) =>
    players.filter((p) => (assignments[p.id] ?? (players.indexOf(p) % teamCount)) === ti)
  );

  function movePlayer(pid, toTeam) {
    const next = { ...assignments, [pid]: toTeam };
    setAssignments(next);
    // Push to server as teamAssignments
    const serverAssignments = Array.from({ length: teamCount }, (_, ti) => ({
      teamId: `team-${ti}`,
      playerIds: players.filter((p) => (next[p.id] ?? (players.indexOf(p) % teamCount)) === ti).map((p) => p.id),
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
                    {Array.from({ length: teamCount }, (_, tIdx) =>
                      tIdx !== ti ? (
                        <button
                          key={tIdx}
                          className="team-move-btn"
                          style={{ background: TEAM_COLORS[tIdx] }}
                          title={`Move to ${TEAM_NAMES[tIdx]}`}
                          onClick={() => movePlayer(p.id, tIdx)}
                        >→</button>
                      ) : null
                    )}
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
  const teamMode = !!room.settings.teamMode;
  const teamCount = room.settings.teamCount || 2;

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
            checked={!!room.settings.smartHints}
            onChange={(e) => updateSettings({ smartHints: e.target.checked })}
          />
          <span>
            <Mic size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Smart narrator hints (playful clues instead of letter reveals)
          </span>
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={!isHost}
            checked={teamMode}
            onChange={(e) => updateSettings({ teamMode: e.target.checked })}
          />
          <span>
            <Swords size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Team vs Team mode — opposing team guesses, same team cheers
          </span>
        </label>

        {teamMode && (
          <div className="team-count-row">
            <span className="label-text">Number of teams:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                disabled={!isHost}
                className={`team-count-btn ${teamCount === n ? 'active' : ''}`}
                onClick={() => updateSettings({ teamCount: n })}
              >{n}</button>
            ))}
          </div>
        )}

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
            teamCount={teamCount}
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