import {
  EffTask,
  FPure,
  Handlers,
  taskDo,
  Effect,
  w,
  handle,
  run,
  eff,
  PartialHandlers,
  TypedEffTask,
  runTask,
} from "./Effect";

type AMB<T> = Effect<"amb", [options: T[]], T>;
type Choose = Effect<"choose", void, boolean>;
type Fail = Effect<"fail", void, void>;

const choose = eff<Choose>("choose");
const fail = eff<Fail>("fail");

const amb = <T>(v: T[]) => w(eff<AMB<T>>("amb")(v));

const handlerAMB = <T, R>(): Handlers<AMB<T>, R, R[]> => ({
  amb: (k, vs) => {
    return vs.flatMap((v) => k([v, handlerAMB()]));
  },
  return: (v) => [v],
});

const doTest = taskDo(function* () {
  let a = yield* amb([1, 2, 3]);
  let b = yield* amb([2, 4, 6]);
  let c = yield* amb([3, 6, 9]);
  yield* assert(a + b == c);
  return `${a} + ${b} = ${c}`;
});

const assert = (b: boolean): TypedEffTask<AMB<null>, null> => {
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

const drunkToss = () =>
  taskDo(function* () {
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

const drunkTosses = (
  n: number
): EffTask<Choose | Fail, ("Heads" | "Tails" | undefined)[]> =>
  taskDo(function* () {
    if (n == 0) {
      return [];
    } else {
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

const maybeFail = <T>(): PartialHandlers<Fail, T, Maybe<T>> => ({
  fail: () => FPure(Nothing()),
  return: (v) => Just(v),
});

const trueChoice = <T>(): PartialHandlers<Choose, T, T> => ({
  choose: (k) => k([true, trueChoice()]),
  return: (v) => v,
});

const allChoices = <T>(): PartialHandlers<Choose, T, T[]> => ({
  choose: (k) => {
    return taskDo(function* () {
      const l = yield* w(k([true, allChoices()]));
      const r = yield* w(k([false, allChoices()]));
      return [...l, ...r];
    });
  },
  return: (v) => [v],
});

type Stringifiable = {
  toString: () => string;
};

const prettyPrint = <T extends Stringifiable>(m: Maybe<T>): string => {
  switch (m.tag) {
    case "Just":
      return `Just (${m.val.toString()})`;
    case "Nothing":
      return "Nothing";
  }
};

console.log(
  run(
    handle(
      handle(drunkTosses(2), maybeFail<("Heads" | "Tails" | undefined)[]>()),
      allChoices<Maybe<("Heads" | "Tails" | undefined)[]>>()
    )
  ).map(prettyPrint)
);
console.log(
  prettyPrint(
    run(
      handle(
        handle(drunkTosses(2), maybeFail<("Heads" | "Tails" | undefined)[]>()),
        trueChoice<Maybe<("Heads" | "Tails" | undefined)[]>>()
      )
    )
  )
);
console.log(
  prettyPrint(
    run(
      handle(
        handle(drunkTosses(2), allChoices<("Heads" | "Tails" | undefined)[]>()),
        maybeFail<("Heads" | "Tails" | undefined)[][]>()
      )
    )
  )
);

console.log(runTask(doTest, handlerAMB<number | null, string>()));