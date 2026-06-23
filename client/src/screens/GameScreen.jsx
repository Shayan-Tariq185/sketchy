import { useEffect, useRef } from 'react';
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

export default function GameScreen() {
  const { room, playerId, chooseWord, roundEndInfo, setRoundEndInfo, lastCorrect } = useGame();
  const isDrawer = room.drawerId === playerId;
  const canDraw = isDrawer && room.status === 'drawing';
  const canGuess = !isDrawer && room.status === 'drawing';
  const roundKeyRef = useRef(null);

  const canvasState = useCanvasDrawing({ roomCode: room.code, canDraw });

  useTimerSounds(room.timeLeft, room.status === 'drawing');

  useEffect(() => {
    // a fresh round (new round number OR new drawer for choice-mode entry)
    // should clear the local canvas buffer
    const key = `${room.round}-${room.drawerId}`;
    if (roundKeyRef.current !== key) {
      roundKeyRef.current = key;
    }
  }, [room.round, room.drawerId]);

  useEffect(() => {
    if (room.status === 'drawing' && roundEndInfo) {
      setRoundEndInfo(null);
    }
  }, [room.status, roundEndInfo, setRoundEndInfo]);

  return (
    <main className={`screen screen-wide game-screen ${room.status?.startsWith('bonus') ? 'game-screen--bonus' : ''}`}>
      {!room.status?.startsWith('bonus') ? (
      <div className="game-grid">
        <RoundSidebar isDrawer={isDrawer} />

        <DrawingCanvas canvasState={canvasState} canDraw={canDraw} resetKey={`${room.round}-${room.drawerId}`} />

        <GuessFeed isDrawer={isDrawer} canGuess={canGuess} />
      </div>
      ) : null}

      {room.status === 'choosing' && isDrawer ? (
        <WordChoiceOverlay choices={room.wordChoices} onChoose={chooseWord} />
      ) : null}

      {room.status === 'predicting' && isDrawer ? (
        <PredictionOverlay />
      ) : null}

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
