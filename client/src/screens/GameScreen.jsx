import { useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useCanvasDrawing } from '../hooks/useCanvasDrawing';
import { useTimerSounds } from '../hooks/useTimerSounds';
import RoundSidebar from '../components/RoundSidebar';
import DrawingCanvas from '../components/DrawingCanvas';
import GuessFeed from '../components/GuessFeed';
import WordChoiceOverlay from '../components/WordChoiceOverlay';
import PredictionOverlay from '../components/PredictionOverlay';
import RoundEndOverlay from '../components/RoundEndOverlay';
import CorrectGuessFlash from '../components/CorrectGuessFlash';
import BonusRoundOverlay from '../components/BonusRoundOverlay';

/** Word banner rendered above the canvas — never overflows, wraps cleanly.
 * The drawer sees their real word as plain text; only guessers see the
 * letter-box masked rendering (which assumes single-character "_" tokens
 * and must never receive a real multi-word string like "Bunsen burner",
 * or it crams whole words into single-letter-sized boxes). */
function WordBanner({ isDrawer, secretWord, maskedWord }) {
  if (isDrawer) {
    if (!secretWord) return null;
    return (
      <div className="word-banner">
        <span className="word-banner-label">
          <Eye size={12} /> Your word
        </span>
        <div className="word-banner-plain">{secretWord}</div>
      </div>
    );
  }

  if (!maskedWord) return null;

  const wordChunks = maskedWord.split('   '); // triple-space = word boundary
  return (
    <div className="word-banner">
      <span className="word-banner-label">Guess the word</span>
      <div className="word-banner-letters">
        {wordChunks.map((chunk, wi) => (
          <span key={wi} className="word-banner-chunk">
            {chunk.split(' ').map((letter, li) => {
              const isBlank = letter === '_';
              return (
                <span key={li} className={`word-banner-letter${isBlank ? '' : ' revealed'}`}>
                  {isBlank ? '' : letter}
                </span>
              );
            })}
            {wi < wordChunks.length - 1 && <span className="word-banner-gap" />}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GameScreen() {
  const { room, playerId, secretWord, chooseWord, roundEndInfo, setRoundEndInfo, lastCorrect, isMyTeamDrawing } = useGame();
  const isDrawer = room.drawerId === playerId;
  const canDraw = isDrawer && room.status === 'drawing';
  const canGuess = !isDrawer && room.status === 'drawing' && !isMyTeamDrawing;
  const roundKeyRef = useRef(null);

  const canvasState = useCanvasDrawing({ roomCode: room.code, canDraw });

  useTimerSounds(room.timeLeft, room.status === 'drawing');

  useEffect(() => {
    const key = `${room.round}-${room.drawerId}`;
    if (roundKeyRef.current !== key) roundKeyRef.current = key;
  }, [room.round, room.drawerId]);

  useEffect(() => {
    if (room.status === 'drawing' && roundEndInfo) setRoundEndInfo(null);
  }, [room.status, roundEndInfo, setRoundEndInfo]);

  return (
    <main className={`screen screen-wide game-screen ${room.status?.startsWith('bonus') ? 'game-screen--bonus' : ''}`}>
      {!room.status?.startsWith('bonus') ? (
        <div className="game-grid">
          <RoundSidebar isDrawer={isDrawer} />

          <div className="canvas-panel">
            {/* Word display above canvas — never overflows */}
            {room.status === 'drawing' && (
              <WordBanner isDrawer={isDrawer} secretWord={secretWord} maskedWord={room.maskedWord} />
            )}
            <DrawingCanvas canvasState={canvasState} canDraw={canDraw} resetKey={`${room.round}-${room.drawerId}`} />
          </div>

          <GuessFeed isDrawer={isDrawer} canGuess={canGuess} />
        </div>
      ) : null}

      {room.status === 'choosing' && isDrawer ? (
        <WordChoiceOverlay choices={room.wordChoices} onChoose={chooseWord} />
      ) : null}

      {room.status === 'predicting' && isDrawer ? <PredictionOverlay /> : null}

      {(room.status === 'choosing' || room.status === 'predicting') && !isDrawer ? (
        <div className="overlay-scrim">
          <div className="paper-card waiting-for-word-card">
            <p>{room.players.find((p) => p.id === room.drawerId)?.name || 'The drawer'} is getting ready…</p>
          </div>
        </div>
      ) : null}

      {room.status === 'round-end' && roundEndInfo ? <RoundEndOverlay info={roundEndInfo} /> : null}

      {lastCorrect ? <CorrectGuessFlash payload={lastCorrect} /> : null}

      <BonusRoundOverlay />
    </main>
  );
}