import { Effect, Handlers, eff, run, runTask, taskDo, typedTaskDo, w } from "./Effect";

type Choose<T> = Effect<"choose", [options: T[]], T>;
const choose = <T>(options: T[]) => eff<Choose<T>>("choose")(options);

const assert = (b: boolean) => w(choose(b ? [null] : []));

const last = (s: string) => s[s.length - 1];
const first = (s: string) => s[0];

const check = (word1: string, word2: string) => typedTaskDo(function* () {
  yield* assert(last(word1) === first(word2));
})

const test = taskDo(function* () {
  const w1 = yield* w(choose(["the", "that", "a"]));
  const w2 = yield* w(choose(["frog", "elephant", "thing"]));
  yield* check(w1, w2);
  const w3 = yield* w(choose(["walked", "treaded", "grows"]));
  yield* check(w2, w3);
  const w4 = yield* w(choose(["slowly", "quickly"]));
  yield* check(w3, w4);
  return `${w1} ${w2} ${w3} ${w4}`;
})

const handlerChoose = <T>(): Handlers<Choose<any>, T, T[]> => ({
  choose: (k, options) => {
    return options.flatMap((option) => k([option, handlerChoose()]));
  },
  return: (v) => [v],
});

console.log(runTask(test, handlerChoose()));