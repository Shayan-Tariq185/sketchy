import { X, Pencil, MessageCircle, Trophy, Zap, Users, Gift, Sparkles } from 'lucide-react';

export default function HowToPlayOverlay({ onClose }) {
  return (
    <div className="overlay-scrim" onClick={onClose}>
      <div className="wobble-card howto-card" onClick={(e) => e.stopPropagation()}>
        <div className="wobble-card-inner">
          <button className="howto-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>

          <span className="eyebrow">
            <Pencil size={13} /> How to play
          </span>
          <h2 className="howto-title">Sketchy, explained</h2>

          <div className="howto-scroll">
            <section className="howto-section">
              <h3>
                <Users size={15} /> Getting started
              </h3>
              <p>
                Create a private room or join one with a friend's code — there's no public matchmaking, so it's
                always just the people you invite. Once everyone's in the lobby, the host picks the word pack,
                difficulty, draw time, and number of rounds, then hits start.
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <Pencil size={15} /> Drawing &amp; guessing
              </h3>
              <p>
                Each round, one player is the drawer and gets a word to sketch — everyone else races to guess it
                in the chat. Players take turns drawing in order, so over the course of a full round, every
                player gets a turn at the canvas once.
              </p>
              <p>
                Drawers usually get to pick from 3 word choices before they start (the host can turn this off so
                a word is assigned automatically instead).
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <MessageCircle size={15} /> Guessing tips
              </h3>
              <p>
                Type your guess straight into the chat box — close guesses get a private warm/cold style hint
                without ever revealing the actual word, so keep trying as you narrow it down.
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <Trophy size={15} /> How points work
              </h3>
              <p>
                Guessing correctly earns you a <strong>base 50 points</strong>, plus a speed bonus of up to{' '}
                <strong>450 more</strong> for guessing quickly — the faster you guess after the round starts, the
                bigger that bonus. Whoever guesses <strong>first</strong> in a round gets an extra{' '}
                <strong>+50</strong> on top of that.
              </p>
              <p>
                The drawer isn't left out — every time someone guesses their word correctly, the drawer earns
                half of whatever that guesser just scored. A good drawing that gets guessed fast by multiple
                people adds up fast for the artist too.
              </p>
              <p>
                Your guess streak (consecutive rounds you've guessed correctly) is tracked and shown on the
                leaderboard as a badge of honor, and resets if you miss a round — it's currently a bragging-rights
                stat rather than a score multiplier.
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <Zap size={15} /> Drawer's prediction
              </h3>
              <p>
                Before drawing starts, the drawer can predict exactly how many players will guess their word
                correctly. Nail the prediction and the drawer earns a flat <strong>+50 bonus</strong> once the
                round ends.
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <Gift size={15} /> Bonus round (5+ players)
              </h3>
              <p>
                If there are at least 5 players, the host can turn on a bonus round that plays once after the
                main game ends. Everyone draws the same secret word at the same time, then tries to match each
                anonymous drawing to the player who drew it. Every correct match is worth{' '}
                <strong>100 points</strong>.
              </p>
            </section>

            <section className="howto-section">
              <h3>
                <Sparkles size={15} /> Extra modes
              </h3>
              <p>
                Hosts can also turn on smart narrator hints (playful clues instead of letter reveals) and team
                mode (two teams take turns guessing, with teammates cheering instead of competing against each
                other) from the lobby settings.
              </p>
            </section>
          </div>

          <button className="btn btn-primary btn-block" onClick={onClose}>
            Got it — let's play
          </button>
        </div>
      </div>
    </div>
  );
}