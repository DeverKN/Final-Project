import {
  EffTask,
  Effect,
  FPure,
  Handlers,
  PartialEffectContinuation,
  PartialHandlers,
  TypedEffTask,
  bind,
  handle,
  run,
  runTask,
  taskDo,
  typedEff,
  typedTaskDo,
  w,
} from "./Effect";
import { Observable, forwardObservable } from "./Observable";

type StateStart = Effect<"start", [], void>;
type StateEnd = Effect<"end", [], void>;
type GetNamed<S, T> = Effect<"get", [name: S, val: T], T>;
type SetNamed<S, T> = Effect<"set", [name: S, val: T], void>;
type Timeout = Effect<"timeout", [ms: number], boolean>;

const get = <S extends string, T>(name: S, v: T) =>
  typedEff<GetNamed<S, T>>("get")(name, v);
const set = <S extends string, T>(name: S, v: T) =>
  typedEff<SetNamed<S, T>>("set")(name, v);
const start = typedEff<StateStart>("start");
const end = typedEff<StateEnd>("end");
const timeout = typedEff<Timeout>("timeout");

const doInterval = <Effects extends Effect<string, any, any>, T>(
  t: TypedEffTask<Effects, T>,
  interval: number = 1000
) =>
  typedTaskDo(function* () {
    let b = yield* timeout(interval);
    // console.log("first", b)
    if (b) yield* t;
  });

const withState = <E extends Effect<string, any, any>, T>(
  task: EffTask<E, T>
) =>
  taskDo(function* () {
    yield* start();
    // console.log("start");
    const result = yield* w(task);
    yield* end();
    return result;
  });

const test = taskDo(function* () {
    yield* start();
    console.log("start");
    yield* doInterval(
      typedTaskDo(function* () {
        const count = yield* get("count", 0);
        const msg = yield* get("msg", "hello");
        yield* set("count", count + 1);
        yield* set("msg", msg + "!");
      })
    );

    const count = yield* get("count", 0);
    const msg = yield* get("msg", "hello");
    console.log({count, msg})
    yield* end();
    return `msg: ${msg}, count: ${count}`;
  });

// type GetHelper<R> = {
//   [key in keyof R]: GetNamed<key, R[key]>;
// }[keyof R];

// type SetHelper<R> = {
//   [key in keyof R]: GetNamed<key, R[key]>;
// }[keyof R];
// type t =  Helper<{msg: "test", count: 0}>

const handleState = <T>(
  s: Record<string, any>,
  k$: PartialEffectContinuation<
    StateStart,
    StateEnd | StateStart | GetNamed<string, any> | SetNamed<string, any>,
    T,
    Observable<T>
  > | null = null,
  rerun = false
): PartialHandlers<StateEnd | StateStart | GetNamed<string, any> | SetNamed<string, any>, T, Observable<T>> => {
  return {
    start: (k) =>
      k([void 0, handleState(s, k, false)]),
    end: (k) => {
      console.log("rerun", rerun);
      if (rerun) {
        return taskDo(function* () {
          const first = yield* w(
            k([void 0, handleState(s, k$, false)])
          );
          const rest = yield* w(
            k$!([void 0, handleState(s, k$, false)])
          );
          return forwardObservable(first, rest);
        });
      } else {
        return k([
          void 0,
          handleState(s, k$, false),
        ]);
      }
    },
    get: (k, name, val) => {
      if (name in s) {
        return k([s[name], handleState(s, k$, rerun)]);
      } else {
        return k([val, handleState({ ...s, [name]: val }, k$, rerun)]);
      }
    },
    set: (k, name, val) => {
      // console.log("set", name, val)
      return k([void 0, handleState({ ...s, [name]: val }, k$, true)]);
    },
    return: (val) => {
      return new Observable(val);
    },
  };
};

const runTimeout = <T>(t: EffTask<Timeout, T>): Observable<T> => {
  const handle: Handlers<Timeout, T, Observable<T>> = {
    timeout: (k, interval) => {
      // console.log("timeout")
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

runTimeout(handle(test, handleState({}))).subscribe({
  update: (data) => {
    data.subscribe({
      update: (data) => {
        console.log(data);
      },
    })
  },
});