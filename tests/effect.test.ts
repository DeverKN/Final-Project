import {
  taskDo,
  w,
  EffTask,
  Effect,
  eff,
  FPure,
  PartialHandlers,
  handle,
  run,
  typedEff,
  bind,
  chain,
  Pure,
  Task,
} from "Effect";
import { describe, expect, test } from "bun:test";

type Choose = Effect<"choose", void, boolean>;
type Fail = Effect<"fail", void, void>;
const choose = eff<Choose>("choose");
const fail = eff<Fail>("fail");

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
      const first = yield* w(drunkToss());
      const rest = yield* w(drunkTosses(n - 1));
      return [first, ...rest] as ("Heads" | "Tails" | undefined)[];
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
  choose: (k) => k(true),
  return: (v) => v,
});

const allChoices = <T>(): PartialHandlers<Choose, T, T[]> => ({
  choose: (k) => {
    return taskDo(function* () {
      const l = yield* w(k(true));
      const r = yield* w(k(false));
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

/*
This demonstrates how the ordering of handlers effects their composition and ulitmately
the final result
*/

describe("Drunk toss", () => {
  test("Choice then Maybe", () => {
    expect(
      prettyPrint(
        run(
          handle(
            handle(
              drunkTosses(2),
              trueChoice<("Heads" | "Tails" | undefined)[]>()
            ),
            maybeFail<("Heads" | "Tails" | undefined)[]>()
          )
        )
      )
    ).toBe("Just (Heads,Heads)");
  });

  test("Maybe then Choice", () => {
    expect(
      prettyPrint(
        run(
          handle(
            handle(
              drunkTosses(2),
              trueChoice<("Heads" | "Tails" | undefined)[]>()
            ),
            maybeFail<("Heads" | "Tails" | undefined)[]>()
          )
        )
      )
    ).toBe("Just (Heads,Heads)");
  });

  test("AllChoice then Maybe", () => {
    expect(
      prettyPrint(
        run(
          handle(
            handle(
              drunkTosses(2),
              allChoices<("Heads" | "Tails" | undefined)[]>()
            ),
            maybeFail<("Heads" | "Tails" | undefined)[][]>()
          )
        )
      )
    ).toBe("Nothing");
  });

  test("Maybe then AllChoice", () => {
    expect(
      run(
        handle(
          handle(
            drunkTosses(2),
            maybeFail<("Heads" | "Tails" | undefined)[]>()
          ),
          allChoices<Maybe<("Heads" | "Tails" | undefined)[]>>()
        )
      ).map(prettyPrint)
    ).toEqual([
      "Just (Heads,Heads)",
      "Just (Heads,Tails)",
      "Nothing",
      "Just (Tails,Heads)",
      "Just (Tails,Tails)",
      "Nothing",
      "Nothing",
    ]);
  });
});

/*

This implements mutable references in a way similar to the refs in languages like 
oCaml. Unlike state from above it allows for multiple different references

*/
const SymbolForRefType = Symbol("RefType");
type SymbolForRefType = typeof SymbolForRefType;
type RefToken<T> = {
  token: symbol;
  [SymbolForRefType]: T;
};
type MakeRef<T> = Effect<"makeRef", [val: T], RefToken<T>>;
type ReadRef<T> = Effect<"readRef", [ref: RefToken<T>], T>;
type WriteRef<T> = Effect<"writeRef", [ref: RefToken<T>, val: T], void>;
const makeRef = <T>(val: T) => typedEff<MakeRef<T>>("makeRef")(val);
const readRef = <T>(ref: RefToken<T>) => typedEff<ReadRef<T>>("readRef")(ref);
const writeRef = <T>(ref: RefToken<T>, val: T) =>
  typedEff<WriteRef<T>>("writeRef")(ref, val);

const handleRef = <T>(
  refs: Record<symbol, any>
): PartialHandlers<MakeRef<any> | ReadRef<any> | WriteRef<any>, T, T> => ({
  makeRef: (k, val) => {
    const ref = {
      token: Symbol(),
      [SymbolForRefType]: void 0 as any,
    };
    return k(ref, handleRef({ ...refs, [ref.token]: val }));
  },
  readRef: (k, { token }) => {
    return k(refs[token]);
  },
  writeRef: (k, { token }, val) => {
    return k(undefined, handleRef({ ...refs, [token]: val }));
  },
  return: (v) => v,
});

test("Mutable state", () => {
  const stateTask = taskDo(function* () {
    const name = yield* makeRef("Dever");
    const count = yield* makeRef(0);
    while ((yield* readRef(name)).length > 0) {
      yield* writeRef(count, (yield* readRef(count)) + 1);
      yield* writeRef(name, (yield* readRef(name)).slice(1));
    }
    return yield* readRef(count);
  });
  expect(run(handle(stateTask, handleRef({})))).toBe(5);
});

type Set = Effect<"set", [val: number], void>;
type Get = Effect<"get", never, number>;
const set = eff<Set>("set");
const get = eff<Get>("get");
const handleState = <T>(s: number): PartialHandlers<Set | Get, T, T> => ({
  set: (k, val) => k(undefined, handleState(val)),
  get: (k) => k(s),
  return: (v) => v,
});

/*
Demonstration of bind and change syntax
*/
test("bind", () => {
  const bindTask = bind(get(), (v) =>
    bind(set(v + 2), () =>
      bind(get(), (v) =>
        bind(set(v + 1), () => bind(get(), (v) => Pure(`Count is ${v}`)))
      )
    )
  );
  expect(run(handle(bindTask, handleState(0)))).toBe("Count is 3");
  expect(run(handle(bindTask, handleState(3)))).toBe("Count is 6");
});

test("chain", () => {
  const chainTask = chain(get())
    .bind((v) => set(v + 2))
    .bind(() => get())
    .bind((v) => set(v + 1))
    .bind(() => get())
    .bind((v) => Pure(`Count is ${v}`))
    .end();
  expect(run(handle(chainTask, handleState(0)))).toBe("Count is 3");
  expect(run(handle(chainTask, handleState(3)))).toBe("Count is 6");
});