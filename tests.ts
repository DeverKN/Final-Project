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

type NameToken = symbol
type Ref<T> = Effect<"ref", [val: T], NameToken>;
type SetRef<T> = Effect<"setRef", [token: NameToken, val: T], void>;
type GetRef<T> = Effect<"getRef", [token: NameToken], T>;

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
    return vs.flatMap((v) => k([v, handlerAMB()]));
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

// type DrunkTosses = (
//   n: number
// ) => EffTask<Choose | Fail, ("Heads" | "Tails" | undefined)[]>;

const drunkTosses = (
  n: number
): EffTask<Choose | Fail, ("Heads" | "Tails" | undefined)[]> =>
  taskDo(function* () {
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
      const obs = k([i++, handle]);
      setInterval(() => {
        forwardObservable(k([i++, handle]), obs);
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
      const obs = k([false, handle]);
      setTimeout(() => {
        forwardObservable(k([true, handle]), obs);
      }, interval);
      return obs;
    },
    return: (v) => new Observable(v),
  };
  return runTask(t, handle);
};

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
  get: (k) => k([s, handleState(s)]),
  set: (k, v) => k([void 0, handleState(v)]),
  return: (v) => v,
});

const handleStateFull = <T, R>(s: T): Handlers<Get<T> | Set<T>, R, R> => ({
  get: (k) => k([s, handleStateFull(s)]),
  set: (k, v) => k([void 0, handleStateFull(v)]),
  return: (v) => v,
});

const handleState2 = <T, R>(
  s: T,
  k$: PartialEffectContinuation<Get<T>, Get<T> | Set<T>, R, R>
): PartialHandlers<Get<T> | Set<T>, R, R> => ({
  get: (k) => k([s, handleState2(s, k)]),
  set: (_, v) => k$([v, handleState2(v, k$)]),
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

// const testH = allChoices<("Heads" | "Tails" | undefined)[]>();
// // type GetResult2<T exgt =
// // type Res = GetResult2<typeof testH>

// const test = handle(
//   drunkTosses(2),
//   allChoices<("Heads" | "Tails" | undefined)[]>()
// );
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
    const obs = k([s, renderer(s, k)]);
    return obs;
  },
  set: (_, v) => {
    const obs = k$([v, renderer(v, k$)]);
    return obs;
  },
  timeout: (k, timeout) => {
    // let i = 0;
    const obs = k([false, renderer(s, k$)]);
    setTimeout(() => {
      k([true, renderer(s, k$)]).subscribe({
        update: (data) => obs.update(data),
      });
      // forwardObservable(newO, obs);
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
    // if (i != 0) yield* w(set(count + 1));
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

const h = <Effects extends Effect<any, any, any>>(
  tag: string,
  props: Partial<EventHandlers<Effects>> & Partial<PropNames>,
  children: JSF<Effects>[]
): JSF<Effects> => {
  return {
    tag,
    props,
    children,
  };
};

type EventTypes = {
  click: any;
  change: any;
};

type EventNames = keyof EventTypes;
type EventHandler<
  Effects extends Effect<any, any, any>,
  EventName extends EventNames
> = (event: EventTypes[EventName]) => EffTask<Effects, void>;
type EventHandlers<Effects extends Effect<any, any, any>> = {
  [eventName in EventNames as `on${Capitalize<eventName>}`]: EventHandler<
    Effects,
    eventName
  >;
};

type PropNames = {
  class: string;
};

type JSF<Effects extends Effect<any, any, any>> =
  | {
      tag: string;
      props: Partial<EventHandlers<Effects>> & Partial<PropNames>;
      children: JSF<Effects>[];
    }
  | string
  | number;

type HTML = string;
const render = <Effects extends Effect<any, any, any>>(
  html: JSF<Effects>
): EffTask<Effects, HTML> => {
  return taskDo(function* () {
    if (typeof html === "string" || typeof html === "number")
      return String(html);
    const tag = html.tag;
    const props = html.props;
    const children = html.children;
    const renderedChildren = children.map(render);
    let childrenHTML: string[] = [];
    for (const child of renderedChildren) {
      childrenHTML.push(yield* w(child));
    }
    let events = [];
    const propsHTML = Object.entries(props)
      .map(([k, v]) => {
        if (k.startsWith("on")) {
          const eventName = k.slice(2).toLowerCase() as EventNames;
          const handler = v as EventHandler<Effects, EventNames>;
          // return `on${eventName}="${v}"`;
          events.push([eventName, v]);
        } else {
          return `${k}="${v}"`;
        }
      })
      .join(" ");
    return `<${tag}${propsHTML}>${childrenHTML.join("")}</${tag}>`;
  });
};
const counter = () =>
  taskDo(function* () {
    let count = yield* get<number>();
    const increment = () =>
      taskDo(function* () {
        yield* set<number>(count + 1);
      });
    const decrement = () =>
      taskDo(function* () {
        yield* set<number>(count - 1);
      });
    // yield* w(doInterval(increment));
    // yield* w(doInterval(increment));
    return render(
      h("div", {}, [
        h("button", { onClick: increment }, ["-"]),
        h("span", {}, [count]),
        h("button", { onClick: decrement }, ["+"]),
      ])
    );
  });

// const res = runTimeout(
//   handle(counter(), handleState2<number, JSF<Set<number>>>(0, null as any))
// );
// const res: Observable<string> = runTask(stateTask(), render(0, null as any));
// res.subscribe({
//   update: (data) => console.log(data),
// });

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
    // if (i != 0) yield* w(set(count + 1));
    return `count is ${count}, msg is ${msg}`;
  });

// runTimeout(
//   handle(stateTaskTest(), handleNamedState2<any, any>({ count: 0 }, {}))
// ).subscribe({
//   update: (data) => console.log(data),
// });
