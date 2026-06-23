import { LogOut, Palette, Play, Sparkles, Timer, Users, Mic, Gift } from 'lucide-react';
import { useGame } from '../context/GameContext';
import RoomCodeTicket from '../components/RoomCodeTicket';
import PlayerList from '../components/PlayerList';

const WORD_PACKS = ['Classic', 'Movies & Shows', 'Food & Drink', 'Tech & Internet'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function LobbyScreen() {
  const { room, playerId, leaveRoom, startGame, updateSettings } = useGame();
  const me = room.players.find((p) => p.id === playerId);
  const isHost = !!me?.isHost;
  const canStart = room.players.filter((p) => p.connected).length >= 2;
  const canBonus = room.players.filter((p) => p.connected).length >= 5;

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
