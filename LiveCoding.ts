const last = (s: string) => s[s.length - 1];
const first = (s: string) => s[0];

/*

Choose a word from each list such that the last letter of each word is the same as the first letter of the next
["the", "that", "a"]
["frog", "elephant", "thing"]
["walked", "treaded", "grows"]
["slowly", "quickly"]

*/

//  Naive solution

const solution = () => {
  const words1 = ["the", "that", "a"];
  const words2 = ["frog", "elephant", "thing"];
  const words3 = ["walked", "treaded", "grows"];
  const words4 = ["slowly", "quickly"];

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (last(w1) === first(w2)) {
        for (const w3 of words3) {
          if (last(w2) === first(w3)) {
            for (const w4 of words4) {
              if (last(w3) === first(w4)) {
                return `${w1} ${w2} ${w3} ${w4}`;
              }
            }
          }
        }
      }
    }
  }
}

console.log(solution());