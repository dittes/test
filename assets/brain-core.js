export const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export function makeNumber(length, random = Math.random) {
  return String(1 + Math.floor(random() * 9)) + Array.from({ length: length - 1 }, () => Math.floor(random() * 10)).join('');
}
export const normalizeDigits = input => input.replace(/\s/g, '');
export function typingScore(reference, value, seconds) {
  const correct = [...value].reduce((sum, char, i) => sum + Number(char === reference[i]), 0);
  const minutes = Math.max(seconds, .001) / 60;
  return { correct, wpm: Math.round(correct / 5 / minutes), gross: Math.round(value.length / 5 / minutes), accuracy: value.length ? Math.round(correct / value.length * 100) : 0 };
}
export const words = 'acorn anchor apple apron arch basket beach beacon bean berry blanket bloom board book bottle branch bread bridge brook brush bucket button cabin candle canvas carrot cedar chalk cherry chest cloud coast copper cotton crane creek crown daisy dawn desk door drum dune eagle earth elm feather fence fern field fig flame flask flower flute forest fork frame frost garden gate glass globe glove grain grape grass gravel grove harbor hat hazel hill honey hook horse house island ivy jacket jar kettle key kite ladder lake lamp leaf lemon letter linen maple marble meadow melon mint mirror moon moss mug needle nest oak ocean olive onion orchard otter owl paddle paper peach pearl pebble pen pepper petal piano pine pitcher pond poppy porch potato purse quilt rabbit rain reed ribbon river road robin rock roof rope rose ruler sail salt sand scarf seed shell shelf shore silk slate snow soap sock spoon spring spruce square star steam stone stool storm string sugar sun table tent thorn thread thyme tiger tin toast towel trail tree tulip valley vase velvet vine violet wagon wall walnut wave wheat wheel willow window wing wool yarn'.split(' ');
export function nextWord(seen, random = Math.random) {
  const fresh = words.filter(word => !seen.has(word));
  const pool = seen.size && (random() < .4 || !fresh.length) ? [...seen] : fresh;
  return pool[Math.floor(random() * pool.length)];
}
export function targetPosition(width, height, previous, random = Math.random) {
  const maxX = Math.max(0, width - 64), maxY = Math.max(0, height - 64);
  let point;
  for (let attempt = 0; attempt < 30; attempt++) {
    point = { x: 8 + random() * maxX, y: 8 + random() * maxY };
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 60) return point;
  }
  // A corner fallback avoids an unbounded random retry loop.
  return [{x:8,y:8},{x:8+maxX,y:8},{x:8,y:8+maxY},{x:8+maxX,y:8+maxY}]
    .sort((a,b) => Math.hypot(b.x-previous.x,b.y-previous.y)-Math.hypot(a.x-previous.x,a.y-previous.y))[0];
}
export const passage = 'The workshop opens early, before the street grows busy. A notebook sits beside a cup of tea, and a row of clean tools hangs above the bench. There is no rush to begin. First, open the window, move the lamp, and make enough space for the task ahead. Small preparations often save more time than working faster. Outside, a cyclist stops to read a map. Two neighbors carry a wooden table across the road, pausing halfway to let a delivery van pass. The town is waking up in its own order. Inside the workshop, the first job is a loose handle on an old drawer. It needs one screw, a careful turn, and a check that nothing catches. The next job takes longer. A box of spare parts has lost its labels, so each piece must be sorted by size and shape. Some fit together at once; others need a closer look. A useful system leaves room for the pieces that do not belong anywhere yet. By noon, the light has moved across the floor. Someone brings fresh bread, and the tools are set aside for a short break. Conversation turns to the weather, a book left on a train, and the best route to the coast. No one agrees on the route, but everyone agrees that a walk would be welcome. Later, the drawer slides smoothly into place. The spare parts have clear labels, and the bench is empty again. Before closing the door, the owner writes a short note for tomorrow: check the hinges, order more paper, and return the borrowed ruler. Most days end without a grand result. A few ordinary things work a little better, and that is enough. On the way home, a narrow path follows the river past a stand of willow trees. Leaves gather along the bank while the current carries a small branch around the bend. A dog waits patiently at the footbridge. Its owner is looking at the water, not at a screen. For a moment, the whole afternoon seems quieter. Then a bell rings from the other side of the river, and the walk continues.';
