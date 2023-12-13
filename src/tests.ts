// These are old tests
import {
  EffTask,
  bind,
  FPure,
  Handlers,
  taskDo,
  Effect,
  w,
  handle,
  run,
  eff,
  PartialHandlers,
  runTask,
  PartialEffectContinuation,
  EffectContinuation,
  TypedEffTask,
  FImpure,
} from "./Effect";
import { Observable, forwardObservable } from "./Observable";

type AMB<T> = Effect<"amb", [options: T[]], T>;
type Get<T> = Effect<"get", void, T>;
type Set<T> = Effect<"set", [val: T], void>;
type Choose = Effect<"choose", void, boolean>;
type Fail = Effect<"fail", void, void>;
type Interval = Effect<"interval", [ms: number], number>;
type Timeout = Effect<"timeout", [ms: number], boolean>;
// type GetUUID = Effect<"getUUID", void, string>;
type GetNamed<T> = Effect<"get", [name: string, val: T], T>;
type SetNamed<T> = Effect<"set", [name: string, val: T], void>;
type Await<T> = Effect<"await", [promise: Promise<T>], T>;

type NameToken = symbol;
type StateAnchor = Effect<"stateAnchor", void, void>;
type EndStateAnchor = Effect<"endStateAnchor", void, void>;
type Ref<T> = Effect<"ref", [val: T], NameToken>;
type SetRef<T> = Effect<"setRef", [token: NameToken, val: T], void>;
type GetRef<T> = Effect<"getRef", [token: NameToken], T>;

const ref = <T>(v: T) => eff<Ref<T>>("ref")(v);
const setRef = <T>(token: NameToken, v: T) =>
  eff<SetRef<T>>("setRef")(token, v);
const getRef = <T>(token: NameToken) => eff<GetRef<T>>("getRef")(token);
const stateAnchor = () => eff<StateAnchor>("stateAnchor")();
const endStateAnchor = () => eff<EndStateAnchor>("endStateAnchor")();
const wait = <T>(p: Promise<T>) => eff<Await<T>>("await")(p);

// const getUUID = eff<GetUUID>("getUUID")();
const getNamed = <T>(name: string, v: T) => eff<GetNamed<T>>("get")(name, v);
const setNamed = <T>(name: string, v: T) => eff<SetNamed<T>>("set")(name, v);
// type Render<Effects extends Effect<any, any, any>> = Effect<
//   "render",
//   JSF<Effects>,
//   void
// >;

const choose = eff<Choose>("choose");
const fail = eff<Fail>("fail");

// const amb = <T>(vs: T[]): EffTask<AMB<T>, T> => {
//   return etaF({ tag: "amb", val: vs, resume: null as T });
// };

const amb = <T>(v: T[]) => w(eff<AMB<T>>("amb")(v));
const get = <T>() => w(eff<Get<T>>("get")());
const set = <T>(v: T) => w(eff<Set<T>>("set")(v));
const interval = (v: number) => w(eff<Interval>("interval")(v));
const timeout = (v: number) => w(eff<Timeout>("timeout")(v));
// const render = <Effects extends Effect<any, any, any>>(html: JSF<Effects>) => {
//   return eff<Render<Effects>>("render")(html);
// };

const handlerAMB = <T, R>(): Handlers<AMB<T>, R, R[]> => ({
  amb: (k, vs) => {
    return vs.flatMap((v) => k(v, handlerAMB()));
  },
  return: (v) => [v],
});

// const testComputationEff4 = (): EffTask<AMB<number>, number> => {
//   return bind(amb([1, 2, 3]), (x) =>
//     bind(amb([2, 4, 6]), (y) =>
//       bind(FPure(x + y), (i) => bind(assert(i > 4), () => FPure(i)))
//     )
//   );
// };

// const test = function* () {
//   let x = yield amb([1, 2, 3]);
//   let y = yield amb([2, 4, 6]);
//   let i = yield FPure(x + y);
//   yield assert(i > 4);
//   return i;
// }

const sqr = (x: number) => x * x;

const doTest = taskDo(function* () {
  let a = yield* amb([1, 2, 3]);
  let b = yield* amb([2, 4, 6]);
  let c = yield* amb([3, 6, 9]);
  let z = yield* assert<number>(a + b == c);
  return `${a} + ${b} = ${c}`;
});

const assert = <T>(b: boolean): TypedEffTask<AMB<T>, null> => {
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
  choose: (k) => k(true, trueChoice()),
  return: (v) => v,
});

const allChoices = <T>(): PartialHandlers<Choose, T, T[]> => ({
  choose: (k) => {
    return taskDo(function* () {
      const l = yield* w(k(true, allChoices()));
      const r = yield* w(k(false, allChoices()));
      return [...l, ...r];
    });
  },
  return: (v) => [v],
});

// const handleInterval = <T>(): PartialHandlers<Interval, T, Observable<T>> => ({
//   interval: (k, interval) => {
//     // const v = f();
//     const observer = k([interval, handleInterval()]);
//     setInterval(() => {
//       const newO = k([interval, handleInterval()])
//       bind(newO, (newO) => forwardObservable(newO, observer));
//     }, interval)
//     return observer;
//     // const newO = k([0, handleInterval()]);
//   },
//   return: (v) => new Observable(v),
// });

const runInterval = <T>(t: EffTask<Interval, T>): Observable<T> => {
  const handle: Handlers<Interval, T, Observable<T>> = {
    interval: (k, interval) => {
      let i = 0;
      const obs = k(i++, handle);
      setInterval(() => {
        forwardObservable(k(i++, handle), obs);
      }, interval);
      return obs;
    },
    return: (v) => new Observable(v),
  };
  return runTask(t, handle);
};

const runTimeout = <T>(t: EffTask<Timeout, T>): Observable<T> => {
  const handle: Handlers<Timeout, T, Observable<T>> = {
    timeout: (k, interval) => {
      const obs = k(false, handle);
      setTimeout(() => {
        forwardObservable(k(true, handle), obs);
      }, interval);
      return obs;
    },
    return: (v) => new Observable(v),
  };
  return runTask(t, handle);
};

const handleTimeout = <T>(): PartialHandlers<Timeout, T, Observable<T>> => ({
  timeout: (k, interval) => {
    // const obs = k([false, handleTimeout()]);
    // setTimeout(() => {
    //   forwardObservable(k([true, handleTimeout()]), obs);
    // }, interval);
    return taskDo(function* () {
      const obs = yield k(false, handleTimeout());
      // yield* w(timeout(interval));
      const newObs = yield k(true, handleTimeout());
      forwardObservable(newObs, obs);
      return obs;
    });
  },
  return: (v) => new Observable(v),
});

// handleTimeout = <T>(): PartialHandlers<Timeout, T, Observable<T>> => ({
//   timeout: (k, interval) => {
//     const obs = k([interval, handleTimeout()]);
//     setTimeout(() => {
//       forwardObservable(k([interval, handleTimeout()]), obs);
//     }, interval)
//     return obs;
//   },
//   return: (v) => new Observable(v),
// });

const handleState = <T, R>(s: T): PartialHandlers<Get<T> | Set<T>, R, R> => ({
  get: (k) => k(s, handleState(s)),
  set: (k, v) => k(void 0, handleState(v)),
  return: (v) => v,
});

const handleStateFull = <T, R>(s: T): Handlers<Get<T> | Set<T>, R, R> => ({
  get: (k) => k(s, handleStateFull(s)),
  set: (k, v) => k(void 0, handleStateFull(v)),
  return: (v) => v,
});

const handleState2 = <T, R>(
  s: T,
  k$: PartialEffectContinuation<Get<T>, Get<T> | Set<T>, R, R>
): PartialHandlers<Get<T> | Set<T>, R, R> => ({
  get: (k) => k(s, handleState2(s, k)),
  set: (_, v) => k$(v, handleState2(v, k$)),
  return: (v) => v,
});

// const handleNamedState2 = <T, R>(
//   s: Record<string, T>,
//   kMap: Record<
//     string,
//     PartialEffectContinuation<GetNamed<T>, GetNamed<T> | SetNamed<T>, R, R>
//   >
// ): PartialHandlers<GetNamed<T> | SetNamed<T>, R, R> => ({
//   get: (k, [name, v]) => {
//     if (name in s) {
//       return k([s[name], handleNamedState2(s, { ...kMap, [name]: k })])
//     } else {
//       return k([v, handleNamedState2({...s, [name]: v }, { ...kMap, [name]: k })])
//     }
//   },
//   set: (_, [name, v]) => kMap[name]([v, handleNamedState2({ ...s, [name]: v }, kMap)]),
//   return: (v) => v,
// });
// console.log(runTask(testComputationEff4(), handlerAMB<number, number>()));
// console.log(runTask(doTest(), handlerAMB<number, string>()));
// const handler = handlerAMB<number>();
// const h = handle<number[]>()
// console.log("do", doTest())
// console.log("drunk", drunkTosses(2))
// const r1 = handle(
//   drunkTosses(2),
//   maybeFail<("Heads" | "Tails" | undefined)[]>()
// );
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

const r1 = handle(
  handle(drunkTosses(2), maybeFail<("Heads" | "Tails" | undefined)[]>()),
  allChoices<Maybe<("Heads" | "Tails" | undefined)[]>>()
);

const r2 = handle(
  handle(drunkTosses(2), maybeFail<("Heads" | "Tails" | undefined)[]>()),
  trueChoice<Maybe<("Heads" | "Tails" | undefined)[]>>()
);

const r3 = handle(
  handle(drunkTosses(2), allChoices<("Heads" | "Tails" | undefined)[]>()),
  maybeFail<("Heads" | "Tails" | undefined)[][]>()
);

console.log(run(r1).map(prettyPrint));
console.log(prettyPrint(run(r2)));
console.log(prettyPrint(run(r3)));
console.log(
  prettyPrint(
    run(
      handle(
        handle(drunkTosses(2), trueChoice<("Heads" | "Tails" | undefined)[]>()),
        maybeFail<("Heads" | "Tails" | undefined)[]>()
      )
    )
  )
);
// console.log(run(handle(doTest(), handlerAMB<number, string>())));

const renderer = (
  s: number,
  k$: EffectContinuation<
    Get<number>,
    Get<number> | Set<number> | Timeout,
    string,
    Observable<string>
  >
): Handlers<
  Get<number> | Set<number> | Timeout,
  string,
  Observable<string>
> => ({
  get: (k) => {
    const obs = k(s, renderer(s, k));
    return obs;
  },
  set: (_, v) => {
    const obs = k$(v, renderer(v, k$));
    return obs;
  },
  timeout: (k, timeout) => {
    // let i = 0;
    const obs = k(false, renderer(s, k$));
    setTimeout(() => {
      k(true, renderer(s, k$)).subscribe({
        update: (data) => obs.update(data),
      });
    }, timeout);
    return obs;
  },
  return: (v) => new Observable(v),
});

const stateTask = () =>
  taskDo(function* () {
    let count = yield* get<number>();
    yield* w(
      doInterval(
        taskDo(function* () {
          yield* set<number>(count + 1);
          return null;
        })
      )
    );
    return `count is ${count}`;
  });

const doInterval = <Effects extends Effect<string, any, any>, T>(
  t: EffTask<Effects, T>,
  interval: number = 1000
) =>
  taskDo(function* () {
    let b = yield* timeout(interval);
    if (b) yield* w(t);
  });

const stateTaskTest = () =>
  taskDo(function* () {
    let count = yield* w(getNamed<number>("count", 0));
    let msg = yield* w(getNamed<string>("msg", "hi"));
    yield* w(
      doInterval(
        taskDo(function* () {
          yield* w(setNamed<number>("count", count + 1));
          return null;
        })
      )
    );
    yield* w(
      doInterval(
        taskDo(function* () {
          yield* w(setNamed<string>("msg", msg + " hi"));
          return null;
        })
      )
    );
    return `count is ${count}, msg is ${msg}`;
  });

const handleRef2 = <T, R>(
  s: Record<symbol, T>,
  k$: any = null,
  rerun: boolean = false,
  oldCache: symbol[] | null = null,
  newCache: symbol[] = []
): PartialHandlers<
  Ref<T> | GetRef<T> | SetRef<T> | StateAnchor | EndStateAnchor,
  R,
  R
> => ({
  ref: (k, v) => {
    if (oldCache) {
      const token = oldCache!.pop()!;
      return k(
        token,
        handleRef2(s, k$, rerun, oldCache, [token, ...newCache]),
      );
    } else {
      const token = Symbol();
      return k(
        token,
        handleRef2({ ...s, [token]: v }, k$, rerun, oldCache, [
          token,
          ...newCache,
        ]),
      );
    }
  },
  getRef: (k, token) => {
    return k(s[token], handleRef2(s, k$, rerun, oldCache, newCache));
  },
  setRef: (k, token, v) => {
    return k(
      void 0,
      handleRef2({ ...s, [token]: v }, k$, true, oldCache, newCache),
    );
  },
  stateAnchor: (k) => {
    return k(void 0, handleRef2(s, k, false, oldCache, newCache));
  },
  endStateAnchor: (k) => {
    if (rerun) {
      return k$(void 0, handleRef2(s, k$, false, newCache, []));
    } else {
      return k(void 0, handleRef2(s, k$, false, oldCache, newCache));
    }
  },
  return: (v) => v,
});

const refTest = taskDo(function* () {
  yield* w(stateAnchor());
  const num = yield* w(ref<number>(0));
  const name = yield* w(ref<string>("dever"));
  if ((yield* w(getRef<number>(num))) < 21) {
    yield* w(setRef(num, (yield* w(getRef<number>(num))) + 1));
  }
  yield* w(endStateAnchor());
  return `name: ${yield* w(
    getRef<string>(name)
  )} age: ${yield* w(getRef<number>(num))}`;
});

const fetchTest = taskDo(function* () {
  const res = yield* w(
    wait(fetch("https://jsonplaceholder.typicode.com/todos/1"))
  );
  const json = yield* w(wait(res.json()));
  return json.title as string;
});

console.log(run(handle(refTest, handleRef2<number | string, string>({}))));
