/* All faces share one 100 × 140 coordinate system, independent of CSS fonts. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownfallCards = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const shapes = {
    spades: '<path d="M12 1C9 5 2 9 2 14a5 5 0 0 0 9 3c0 3-1 5-3 6h8c-2-1-3-3-3-6a5 5 0 0 0 9-3c0-5-7-9-10-13Z"/>',
    hearts: '<path d="M12 22C9 18 1 13 1 7a6 6 0 0 1 11-3A6 6 0 0 1 23 7c0 6-8 11-11 15Z"/>',
    clubs: '<path d="M11 16c0 4-1 6-3 7h8c-2-1-3-3-3-7Z"/><circle cx="12" cy="6" r="5"/><circle cx="6" cy="13" r="5"/><circle cx="18" cy="13" r="5"/>',
    diamonds: '<path d="m12 1 10 11-10 11L2 12Z"/>'
  };
  // Explicit pip positions avoid grid min-content overflow on 9s and 10s.
  const patterns = {
    1: [[50, 70]],
    2: [[50, 39], [50, 101]],
    3: [[50, 37], [50, 70], [50, 103]],
    4: [[33, 38], [67, 38], [33, 102], [67, 102]],
    5: [[33, 38], [67, 38], [50, 70], [33, 102], [67, 102]],
    6: [[33, 36], [67, 36], [33, 70], [67, 70], [33, 104], [67, 104]],
    7: [[33, 36], [67, 36], [50, 53], [33, 70], [67, 70], [33, 104], [67, 104]],
    8: [[33, 36], [67, 36], [50, 53], [33, 70], [67, 70], [50, 87], [33, 104], [67, 104]],
    9: [[33, 32], [67, 32], [33, 57], [67, 57], [50, 70], [33, 83], [67, 83], [33, 108], [67, 108]],
    10: [[33, 32], [67, 32], [50, 45], [33, 57], [67, 57], [33, 83], [67, 83], [50, 95], [33, 108], [67, 108]]
  };
  const crown = '<path d="m4 10 7 5 5-10 5 10 7-5-3 16H7zM9 22h14"/>';
  const horse = '<path d="M10 36c0-9 10-12 12-18l-7 5-7-3 5-8 5-3V4l6 5c10 2 11 10 9 19l-2 8ZM8 40h26M21 13h1M13 12l5 3"/>';
  function suit(s, x, y, size, inverted = false) {
    return `<g class="face-suit" transform="translate(${x} ${y}) rotate(${inverted ? 180 : 0}) scale(${size / 24}) translate(-12 -12)">${shapes[s]}</g>`;
  }
  function frame() {
    return '<rect x="5.5" y="5.5" width="89" height="129" rx="4" fill="none" stroke="currentColor" stroke-width=".65" opacity=".14"/>';
  }
  function indices(card) {
    const rank = ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[card.value] || card.value;
    const index = `<text x="9" y="19" font-family="Georgia,Times New Roman,serif" font-size="${card.value === 10 ? 13 : 15}" font-weight="600">${rank}</text>${suit(card.suit, 15, 29, 10)}`;
    return `<g class="face-index">${index}</g><g class="face-index" transform="translate(100 140) rotate(180)">${index}</g>`;
  }
  function knight() {
    return `<g class="face-knight"><rect x="27" y="32" width="46" height="77" rx="21" fill="#b69b56" fill-opacity=".06" stroke="#b69b56" stroke-width=".8" stroke-opacity=".45"/><g transform="translate(31 45) scale(.95)" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${horse}</g><g class="face-badge"><circle cx="50" cy="32" r="10" fill="#c0a264" stroke="#f6e9bf" stroke-width="1"/><g transform="translate(41 22) scale(.56)" fill="none" stroke="#fff8df" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${crown}</g></g><text x="50" y="100" text-anchor="middle" font-family="Georgia,serif" font-size="5.3" letter-spacing="1.2" fill="#9a814b">KNIGHT</text><path d="M40 104h20" fill="none" stroke="#b69b56" stroke-width=".6" opacity=".5"/></g>`;
  }
  function court(card) {
    const rank = { 11: 'J', 12: 'Q', 13: 'K' }[card.value];
    return `<g class="face-court"><rect x="27" y="32" width="46" height="76" rx="3" fill="currentColor" fill-opacity=".025" stroke="currentColor" stroke-width=".7" stroke-opacity=".2"/><path d="m50 37 18 33-18 33-18-33Z" fill="none" stroke="currentColor" stroke-width=".6" opacity=".14"/>${suit(card.suit, 50, 45, 10)}<text x="50" y="84" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="39">${rank}</text>${suit(card.suit, 50, 96, 10, true)}</g>`;
  }
  function render(card, role = 'soldier') {
    if (!card || !shapes[card.suit] || !Number.isInteger(card.value) || card.value < 1 || card.value > 13) throw new Error('Invalid playing card');
    const content = role === 'knight' ? knight() : card.value > 10 ? court(card) : `<g class="face-pips">${patterns[card.value].map(([x, y]) => suit(card.suit, x, y, card.value === 1 ? 39 : card.value >= 9 ? 15 : 18, y > 70)).join('')}</g>`;
    return `<svg class="card-art" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-face="${card.value}" data-suit="${card.suit}" data-role="${role}">${frame()}${content}${indices(card)}</svg>`;
  }
  function renderJoker() {
    const letters = ['J', 'O', 'K', 'E', 'R'].map((letter, i) => `<text x="12" y="17" dy="${i * 9}" text-anchor="middle">${letter}</text>`).join('');
    const art = '<path d="M30 6 17 19l13 13 13-13z" fill="currentColor" fill-opacity=".035" stroke-opacity=".18"/><path d="m14 31 1-14 10 7 5-15 6 15 10-7-1 14M17 31h26M20 34c0 13 3 20 10 20s10-7 10-20M19 36l-5 1 3 8 5 1m19-10 5 1-3 8-5 1M25 39h1m8 0h1M27 47c2 2 4 2 6 0M26 53l-3 7-12 6 19 7 19-7-12-6-3-7M21 61l9 7 9-7M13 67l3 3m28-3-3 3M17 18l-3-3m30 3 3-3"/><circle cx="30" cy="8" r="2"/><circle cx="14" cy="15" r="1.5"/><circle cx="47" cy="15" r="1.5"/><path d="m28 18 2-3 2 3-2 3zM28 57l2-2 2 2-2 3z" fill="currentColor"/>';
    return `<svg class="card-art" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" data-face="joker" data-role="commander">${frame()}<path d="m50 22 25 48-25 48-25-48Z" fill="currentColor" opacity=".025"/><g font-family="Georgia,serif" font-size="7.5" font-weight="600">${letters}<g transform="translate(100 140) rotate(180)">${letters}</g></g><g class="face-sovereign" transform="translate(20 29)" fill="none" stroke="currentColor" stroke-width=".95" stroke-linecap="round" stroke-linejoin="round">${art}</g><text x="50" y="121" text-anchor="middle" font-family="Georgia,serif" font-size="4.2" letter-spacing="1">THE SOVEREIGN</text></svg>`;
  }
  return { render, renderJoker };
});
