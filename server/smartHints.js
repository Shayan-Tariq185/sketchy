// Playful narrator hints that never reveal the word outright.

const PACK_CATEGORIES = {
  Classic: 'everyday things',
  'Movies & Shows': 'movies & characters',
  'Food & Drink': 'food & drinks',
  'Tech & Internet': 'tech & internet culture'
};

const ANIMAL_WORDS = new Set([
  'dog', 'cat', 'fish', 'bird', 'duck', 'cow', 'goat', 'sheep', 'horse', 'camel', 'lion', 'tiger',
  'bear', 'monkey', 'rabbit', 'mouse', 'frog', 'snake', 'turtle', 'bee', 'ant', 'spider', 'butterfly',
  'snail', 'elephant', 'giraffe', 'zebra', 'panda', 'penguin', 'dolphin', 'shark', 'whale', 'dragon'
]);

const FOOD_WORDS = new Set([
  'apple', 'banana', 'mango', 'orange', 'grapes', 'lemon', 'watermelon', 'carrot', 'potato', 'tomato',
  'onion', 'corn', 'pumpkin', 'pizza', 'burger', 'fries', 'sandwich', 'egg', 'bread', 'cake', 'cookie',
  'donut', 'ice cream', 'tea', 'chai', 'juice', 'biryani', 'samosa', 'naan', 'cupcake', 'pancake'
]);

const ACTION_WORDS = new Set([
  'running', 'jumping', 'swimming', 'dancing', 'singing', 'sleeping', 'eating', 'reading', 'writing',
  'drawing', 'cooking', 'fishing', 'camping', 'waving', 'crying', 'laughing', 'skating', 'climbing'
]);

const RHYME_PAIRS = [
  ['cat', 'hat'], ['dog', 'frog'], ['bear', 'chair'], ['train', 'rain'], ['moon', 'spoon'],
  ['cake', 'snake'], ['light', 'kite'], ['star', 'car'], ['bee', 'tree'], ['fish', 'dish']
];

function normalise(word) {
  return (word || '').trim().toLowerCase();
}

function guessCategory(word, wordPack) {
  const w = normalise(word);
  if (ANIMAL_WORDS.has(w) || w.includes('animal')) return 'an animal';
  if (FOOD_WORDS.has(w)) return 'something edible';
  if (ACTION_WORDS.has(w)) return 'an action — something someone does';
  if (w.includes(' ')) return 'a phrase (two or more words)';
  return PACK_CATEGORIES[wordPack] || 'something drawable';
}

function findRhymeHint(word) {
  const w = normalise(word);
  for (const [a, b] of RHYME_PAIRS) {
    if (w === a) return `Hmm… it rhymes with "${b}".`;
    if (w === b) return `Hmm… it rhymes with "${a}".`;
  }
  const last = w.split(' ').pop();
  if (last && last.length >= 3) {
    return `The last syllable sounds a bit like "-${last.slice(-2)}".`;
  }
  return null;
}

/**
 * Returns a narrator hint for the given stage (0, 1, 2).
 * Stages fire at ~50%, ~70%, and ~85% of draw time.
 */
export function generateSmartHint(word, wordPack, difficulty, stage) {
  const w = normalise(word);
  const letters = w.replace(/\s/g, '');
  const category = guessCategory(w, wordPack);

  if (stage === 0) {
    return `💡 Sketchy says: Think ${category} — from the "${wordPack}" pack (${difficulty} tier).`;
  }

  if (stage === 1) {
    const parts = [];
    parts.push(`${letters.length} letter${letters.length === 1 ? '' : 's'} total`);
    if (letters.length > 0) {
      parts.push(`starts with "${letters[0].toUpperCase()}"`);
    }
    if (w.includes(' ')) {
      parts.push(`${w.split(/\s+/).length} words`);
    }
    return `💡 Sketchy whispers: ${parts.join(', ')}.`;
  }

  const rhyme = findRhymeHint(w);
  if (rhyme) return `💡 Final nudge: ${rhyme}`;
  if (letters.length >= 4) {
    return `💡 Final nudge: Contains the letter "${letters[Math.floor(letters.length / 2)].toUpperCase()}" somewhere in the middle.`;
  }
  return `💡 Final nudge: It's something you'd doodle quickly — don't overthink it!`;
}
