/* Generates a short human-readable clue for a word given its category. */
(function(){
  'use strict';

  // Curated hints for common words. Fallback is category-based.
  const SPECIFIC = {
    // Animals
    ELEPHANT:'A huge grey mammal with a long trunk.',
    GIRAFFE:'The tallest land animal, with a very long neck.',
    PENGUIN:'A flightless bird from icy regions.',
    DOLPHIN:'A smart marine mammal that clicks and jumps.',
    TIGER:'A big striped orange cat.',
    LION:'The "king of the jungle".',
    KANGAROO:'An Australian animal that hops with a pouch.',
    OCTOPUS:'A sea creature with eight arms.',
    BUTTERFLY:'A colorful insect with big wings.',
    // Countries
    BRAZIL:'Largest country in South America, famous for samba.',
    JAPAN:'An island nation known for sushi and cherry blossoms.',
    FRANCE:'European country famous for the Eiffel Tower.',
    EGYPT:'Home to the pyramids and the Nile.',
    CANADA:'North American country known for maple syrup.',
    // Foods
    PIZZA:'Italian dish with cheese and toppings on dough.',
    SUSHI:'Japanese dish with rice and often raw fish.',
    BURGER:'Sandwich with a patty in a bun.',
    CHOCOLATE:'Sweet treat made from cocoa.',
    // Sports
    SOCCER:'World\'s most popular sport, played with a ball and feet.',
    TENNIS:'Racket sport played on a court with a net.',
    BASKETBALL:'Sport where you shoot a ball through a hoop.',
    // Space
    SATURN:'The planet famous for its rings.',
    JUPITER:'The largest planet in our solar system.',
    GALAXY:'A huge system of stars, gas, and dust.',
    COMET:'A ball of ice and dust with a glowing tail.',
  };

  const CATEGORY_HINTS = {
    'Animals':      w => `An animal (${countLetters(w)} letters).`,
    'Countries':    w => `A country in the world (${countLetters(w)} letters).`,
    'Foods':        w => `Something you can eat (${countLetters(w)} letters).`,
    'Fruits':       w => `A type of fruit (${countLetters(w)} letters).`,
    'Vegetables':   w => `A vegetable found in the garden (${countLetters(w)} letters).`,
    'Sports':       w => `A sport or game (${countLetters(w)} letters).`,
    'Colors':       w => `A color of the rainbow (${countLetters(w)} letters).`,
    'Movies':       w => `A well-known movie title (${countLetters(w)} letters).`,
    'Music':        w => `Something related to music (${countLetters(w)} letters).`,
    'Space':        w => `Something out in space (${countLetters(w)} letters).`,
    'Nature':       w => `Something found in nature (${countLetters(w)} letters).`,
    'Technology':   w => `A tech-related word (${countLetters(w)} letters).`,
    'Jobs':         w => `A job or profession (${countLetters(w)} letters).`,
    'Body':         w => `A part of the body (${countLetters(w)} letters).`,
    'Clothing':     w => `Something you wear (${countLetters(w)} letters).`,
    'Vehicles':     w => `Something you can ride or drive (${countLetters(w)} letters).`,
    'Instruments':  w => `A musical instrument (${countLetters(w)} letters).`,
  };

  function countLetters(w){ return w.replace(/\s/g,'').length; }

  function clueFor(word, category){
    if(!word) return '—';
    const key = word.toUpperCase();
    if(SPECIFIC[key]) return SPECIFIC[key];
    if(category && category!=='Random' && CATEGORY_HINTS[category]){
      return CATEGORY_HINTS[category](word);
    }
    // Random fallback
    const words = word.split(' ').length;
    return `A ${countLetters(word)}-letter word${words>1?` in ${words} parts`:''}. Category: ${category||'Random'}.`;
  }

  window.Clues = { clueFor };
})();
