import {
  EffTask,
  etaF,
  bind,
  FPure,
  Handlers,
  runTask,
  taskDo,
  Effect,
  w,
  handle,
  run,
  eff,
} from "./Effect";

type AMB<T> = Effect<"amb", T[], T>;
type Get<T> = Effect<"get", void, T>;
type Set<T> = Effect<"set", T, void>;
type Choose = Effect<"choose", void, boolean>;
type Fail = Effect<"fail", void, void>;

const choose = eff<Choose>("choose");
const fail = eff<Fail>("fail");

// const amb = <T>(vs: T[]): EffTask<AMB<T>, T> => {
//   return etaF({ tag: "amb", val: vs, resume: null as T });
// };

const amb = <T>(v: T[]) => eff<AMB<T>>("amb")(v);
const get = <T>() => eff<Get<T>>("get")();
const set = <T>(v: T) => eff<Set<T>>("set")(v);

const handlerAMB = <T, R>(): Handlers<AMB<T>, R, R[]> => ({
  amb: (k, vs) => {
    return vs.flatMap((v) => k([v, handlerAMB()]));
  },
  return: (v) => [v],
});

const testComputationEff4 = (): EffTask<AMB<number>, number> => {
  return bind(amb([1, 2, 3]), (x) =>
    bind(amb([2, 4, 6]), (y) =>
      bind(FPure(x + y), (i) => bind(assert(i > 4), () => FPure(i)))
    )
  );
};

// const test = function* () {
//   let x = yield amb([1, 2, 3]);
//   let y = yield amb([2, 4, 6]);
//   let i = yield FPure(x + y);
//   yield assert(i > 4);
//   return i;
// }

const sqr = (x: number) => x * x;

const doTest = taskDo(function* () {
  let a = yield* w(amb([1, 2, 3]));
  let b = yield* w(amb([2, 4, 6]));
  let c = yield* w(amb([3, 6, 9]));
  let z = yield* w(assert<number>(a + b == c));
  return `${a} + ${b} = ${c}`;
});

const assert = <T>(b: boolean): EffTask<AMB<T>, null> => {
  return amb(b ? [null] : []);
};

/*

toss () = if choose () then Heads else Tails

drunkToss () = if choose () then
                  if choose () then Heads else Tails
                  else
                  fail ()

drunkTosses n = if n = 0 then []
                else drunkToss () :: drunkTosses (n − 1)

*/

const toss = taskDo(function* () {
  if (yield* w(choose())) {
    return "Heads";
  } else {
    return "Tails";
  }
});

// const inferEffects = <
//   TArgs extends any[],
//   Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
// >(
//   gen: (
//     ...args: TArgs
//   ) => Gen
// ): (Gen extends Generator<EffTask<infer Effects, any>, any, any> ? Effects : never) => {
//   return null as any;
// }

// const test = inferEffects(function* () {
//   // yield* w(amb([1, 2, 3]));
//   // yield* w(choose())
//   // yield* w(fail());
//   // yield* w(choose())
//   if (yield* w(choose())) {
//     if (yield* w(choose())) {
//       return "Heads";
//     } else {
//       return "Tails";
//     }
//   } else {
//     yield* w(fail());
//   }
// })

const drunkToss = taskDo(function* () {
  if (yield* w(choose())) {
    if (yield* w(choose())) {
      return "Heads";
    } else {
      return "Tails";
    }
  } else {
    yield* w(fail());
  }
});

type DrunkTosses = (
  n: number
) => EffTask<Choose | Fail, ("Heads" | "Tails" | undefined)[]>;

const drunkTosses: DrunkTosses = taskDo(function* (n: number) {
  if (n == 0) {
    return [];
  } else {
    // const first = yield* w(drunkToss())
    // const rest = (yield* w(drunkTosses(n - 1)))
    const res: ("Heads" | "Tails" | undefined)[] = [
      yield* w(drunkToss()),
      ...(yield* w(drunkTosses(n - 1))),
    ];
    return res;
  }
});

type Maybe<T> = { tag: "Just"; val: T } | { tag: "Nothing" };
const Just = <T>(v: T): Maybe<T> => ({ tag: "Just", val: v });
const Nothing = <T>(): Maybe<T> => ({ tag: "Nothing" });

const maybeFail = <T>(): Handlers<Fail, T, Maybe<T>> => ({
  fail: () => Nothing(),
  return: (v) => Just(v),
});

const trueChoice = <T>(): Handlers<Choose, T, T> => ({
  choose: (k) => k([true, trueChoice()]),
  return: (v) => v,
});

const allChoices = <T>(): Handlers<Choose, T, T[]> => ({
  choose: (k) => k([true, allChoices()]),
  return: (v) => [v],
});

console.log(runTask(testComputationEff4(), handlerAMB<number, number>()));
console.log(runTask(doTest(), handlerAMB<number, string>()));
// const handler = handlerAMB<number>();
// const h = handle<number[]>()
// console.log("do", doTest())
// console.log("drunk", drunkTosses(2))
// const r1 = handle(
//   drunkTosses(2),
//   maybeFail<("Heads" | "Tails" | undefined)[]>()
// );
// const r2 = handle(r1, allChoices<Maybe<("Heads" | "Tails" | undefined)[]>>());
// console.log(run(r2));
// console.log(run(handle(doTest(), handlerAMB<number, string>())));