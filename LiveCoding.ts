/*

Choose a word from each list such that the last letter of each word is the same as the first letter of the next
["the", "that", "a"]
["frog", "elephant", "thing"]
["walked", "treaded", "grows"]
["slowly", "quickly"]

*/

const last = (s: string) => s[s.length - 1];
const first = (s: string) => s[0];
const satisfies = (s: string, w: string) => last(s) === first(w);

//  Naive solution

const naiveSolution = () => {
  const words1 = ["the", "that", "a"];
  const words2 = ["frog", "elephant", "thing"];
  const words3 = ["walked", "treaded", "grows"];
  const words4 = ["slowly", "quickly"];

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (satisfies(w1, w2)) {
        for (const w3 of words3) {
          if (satisfies(w2, w3)) {
            for (const w4 of words4) {
              if (satisfies(w3, w4)) {
                return `${w1} ${w2} ${w3} ${w4}`;
              }
            }
          }
        }
      }
    }
  }
}

console.log(naiveSolution());


const functionalSolution = (): string[] => {
  const words = ["the", "that", "a"];
  const words2 = ["frog", "elephant", "thing"];
  const words3 = ["walked", "treaded", "grows"];
  const words4 = ["slowly", "quickly"];

  return words.flatMap((w1) =>
    words2.flatMap((w2) => {
      if (satisfies(w1, w2)) {
        return words3.flatMap((w3) => {
          if (satisfies(w2, w3)) {
            return words4.flatMap((w4) => {
              if (satisfies(w3, w4)) {
                return [`${w1} ${w2} ${w3} ${w4}`];
              } else {
                return [];
              }
            });
          } else {
            return [];
          }
        });
      } else {
        return [];
      }
    })
  );
};

console.log(functionalSolution());