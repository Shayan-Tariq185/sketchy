// Curated word packs. Each pack has Easy / Medium / Hard tiers so room hosts
// can tune difficulty, and a custom pack can be supplied by the host at
// runtime (see room.customWords in roomManager.js).

export const WORD_PACKS = {
  Classic: {
    Easy: [
      'Cat', 'Dog', 'Sun', 'Tree', 'Cup', 'Fish', 'House', 'Book', 'Apple', 'Star',
      'Ball', 'Cloud', 'Shoe', 'Chair', 'Clock', 'Moon', 'Door', 'Hat', 'Egg', 'Boat'
    ],
    Medium: [
      'Airport', 'Telescope', 'Skateboard', 'Castle', 'Volcano', 'Robot', 'Treasure',
      'Camera', 'Backpack', 'Helicopter', 'Penguin', 'Sandwich', 'Lighthouse',
      'Dinosaur', 'Astronaut', 'Waterfall', 'Bicycle', 'Campfire', 'Umbrella', 'Jellyfish'
    ],
    Hard: [
      'Time machine', 'Invisible bridge', 'Quantum computer', 'Ancient civilization',
      'Haunted lighthouse', 'Space elevator', 'Dream catcher', 'Underwater city',
      'Parallel universe', 'Optical illusion', 'Black hole', 'Origami crane',
      'Domino effect', 'Mirage', 'Eclipse'
    ]
  },
  'Movies & Shows': {
    Easy: ['Batman', 'Shark', 'Pirate', 'Wizard', 'Robot', 'Ghost', 'Alien', 'Dragon'],
    Medium: ['Superhero landing', 'Plot twist', 'Cliffhanger', 'Movie marathon', 'Red carpet', 'Sequel', 'Soundtrack', 'Cameo'],
    Hard: ['Post-credits scene', 'Unreliable narrator', 'Found footage', 'Slow-motion explosion', 'Fourth wall break', 'Anti-hero']
  },
  'Food & Drink': {
    Easy: ['Pizza', 'Burger', 'Taco', 'Donut', 'Cookie', 'Noodles', 'Pancake', 'Cheese'],
    Medium: ['Street food', 'Food truck', 'Buffet', 'Smoothie bowl', 'Barbecue', 'Dim sum', 'Hot pot', 'Espresso'],
    Hard: ['Molecular gastronomy', 'Farm to table', 'Fermented tea', 'Tasting menu', 'Food coma']
  },
  'Tech & Internet': {
    Easy: ['Laptop', 'Wifi', 'Mouse', 'Robot', 'Drone', 'Battery', 'Headphones', 'Charger'],
    Medium: ['Video call', 'Firewall', 'Server room', 'Touchscreen', 'Smartwatch', 'Livestream', 'Algorithm', 'Chatbot'],
    Hard: ['Artificial intelligence', 'Blockchain', 'Augmented reality', 'Quantum bit', 'Neural network', 'Data breach']
  }
};

export function pickWord(packName, difficulty, excludeList = []) {
  const pack = WORD_PACKS[packName] || WORD_PACKS.Classic;
  const list = pack[difficulty] || pack.Medium;
  const available = list.filter((word) => !excludeList.includes(word));
  const pool = available.length ? available : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickWordChoices(packName, difficulty, excludeList = [], count = 3) {
  const pack = WORD_PACKS[packName] || WORD_PACKS.Classic;
  const list = pack[difficulty] || pack.Medium;
  const available = list.filter((word) => !excludeList.includes(word));
  const pool = available.length >= count ? available : list;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
