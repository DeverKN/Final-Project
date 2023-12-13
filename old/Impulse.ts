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
} from "../src/Effect";
import { Observable, forwardObservable } from "../src/Observable";

type StateStart = Effect<"start", [], void>;
type StateEnd = Effect<"end", [], void>;
type GetNamed<S, T> = Effect<"get", [name: S, val: T], T>;
type SetNamed<S, T> = Effect<"set", [name: S, val: T], void>;
type Timeout = Effect<"timeout", [ms: number], boolean>;

type NameToken = symbol;
export type StateAnchor = Effect<"stateAnchor", void, void>;
export type EndStateAnchor = Effect<"endStateAnchor", void, void>;
export type Ref<T> = Effect<"ref", [val: T], NameToken>;
export type SetRef<T> = Effect<"setRef", [token: NameToken, val: T], void>;
export type GetRef<T> = Effect<"getRef", [token: NameToken], T>;
export type Handler<E extends Effect<any, any, any>> = Effect<
  "handler",
  [task: TypedEffTask<E, void>],
  boolean
>;

// const handler = typedEff<Handler>("handler");

export const ref = <T>(v: T) => typedEff<Ref<T>>("ref")(v);
export const setRef = <T>(token: NameToken, v: T) =>
  typedEff<SetRef<T>>("setRef")(token, v);
export const getRef = <T>(token: NameToken) =>
  typedEff<GetRef<T>>("getRef")(token);
export const stateAnchor = () => typedEff<StateAnchor>("stateAnchor")();
export const endStateAnchor = () =>
  typedEff<EndStateAnchor>("endStateAnchor")();

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

const handleRef = <T, R>(
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
      return k([
        token,
        handleRef(s, k$, rerun, oldCache, [token, ...newCache]),
      ]);
    } else {
      const token = Symbol();
      return k([
        token,
        handleRef({ ...s, [token]: v }, k$, rerun, oldCache, [
          token,
          ...newCache,
        ]),
      ]);
    }
  },
  getRef: (k, token) => {
    return k([s[token], handleRef(s, k$, rerun, oldCache, newCache)]);
  },
  setRef: (k, token, v) => {
    return k([
      void 0,
      handleRef({ ...s, [token]: v }, k$, true, oldCache, newCache),
    ]);
  },
  stateAnchor: (k) => {
    return k([void 0, handleRef(s, k, false, oldCache, newCache)]);
  },
  endStateAnchor: (k) => {
    if (rerun) {
      return k$([void 0, handleRef(s, k$, false, newCache, [])]);
    } else {
      return k([void 0, handleRef(s, k$, false, oldCache, newCache)]);
    }
  },
  return: (v) => v,
});

type StateSetter<T> = (
  val: T | ((val: T) => T)
) => TypedEffTask<SetRef<T> | GetRef<T>, void>;

export const useState = <T>(
  defaultVal: T
): TypedEffTask<GetRef<T> | Ref<T>, [T, StateSetter<T>]> => {
  return typedTaskDo(function* () {
    const token = yield* ref<T>(defaultVal);
    const val = yield* getRef<T>(token);
    const set: StateSetter<T> = (val) => {
      if (typeof val === "function") {
        return typedTaskDo(function* () {
          const oldVal = yield* getRef<T>(token);
          const newVal = (val as (val: T) => T)(oldVal);
          yield* setRef(token, newVal);
        });
      } else {
        return setRef(token, val);
      }
    };
    const result: [T, StateSetter<T>] = [val, set];
    return result;
  });
};

type EventTypes = {
  click: any;
  change: any;
};

type EventNames = keyof EventTypes;
type EventHandler<
  Effects extends Effect<any, any, any>,
  EventName extends EventNames
> = (event: EventTypes[EventName]) => TypedEffTask<Effects, void>;
type EventHandlers<Effects extends Effect<any, any, any>> = {
  [eventName in EventNames as `on${Capitalize<eventName>}`]: EventHandler<
    Effects,
    eventName
  >;
};

type PropNames = {
  class: string;
};

export type JSF<Effects extends Effect<any, any, any>> =
  | {
      tag: string;
      props: Partial<EventHandlers<Effects>> & Partial<PropNames>;
      children: JSF<Effects>[];
    }
  | string
  | number;

export const h = <Effects extends Effect<any, any, any>>(
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

const counter = taskDo(function* () {
  yield* stateAnchor();

  const [count, setCount] = yield* useState(0);

  yield* endStateAnchor();
  return h("div", {}, [
    h("button", { onClick: () => setCount(count + 1) }, ["+"]),
    `count is ${count}`,
    h("button", { onClick: () => setCount(count + 1) }, ["-"]),
  ]);
});

const test = taskDo(function* () {
  yield* stateAnchor();
  const [count, setCount] = yield* useState(0);

  yield* doInterval(
    typedTaskDo(function* () {
      yield* setCount(count + 1);
    })
  );

  yield* endStateAnchor();
  return `count: ${count}`;
});

const handleState = <T>(
  s: Record<string, any>,
  k$: PartialEffectContinuation<
    StateStart,
    StateEnd | StateStart | GetNamed<string, any> | SetNamed<string, any>,
    T,
    T
  > | null = null,
  rerun = false
): PartialHandlers<
  StateEnd | StateStart | GetNamed<string, any> | SetNamed<string, any>,
  T,
  T
> => {
  return {
    start: (k) => k([void 0, handleState(s, k, false)]),
    end: (k) => {
      if (rerun) {
        return k$!([void 0, handleState(s, k$, false)]);
      } else {
        return k([void 0, handleState(s, k$, false)]);
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
      return val;
    },
  };
};

const runTimeout = <T>(t: EffTask<Timeout, T>): Promise<Observable<T>> => {
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

// const installHandler = <Effects extends Effect<string, any, any>>(
//   element: HTMLElement,
//   eventName: string,
//   t: EffTask<Effects, void>
// ) => taskDo(function* () {
//     let b = yield* handler(element, eventName);
//     if (b) yield* w(t);
// });

const convert = <E extends Effect<any, any, any>>(
  j: JSF<E>
): TypedEffTask<E, HTMLElement> => {
  return typedTaskDo(function* () {
    if (typeof j === "string") return document.createTextNode(j);
    if (typeof j === "number") return document.createTextNode(j.toString());

    const { tag, props, children } = j;
    const el = document.createElement(tag);

    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) {
        const eventName = k.slice(2).toLowerCase();
        el.addEventListener(eventName, () => yield* v());
      } else {
        el.setAttribute(k, v);
      }
    }

    for (const child of children) {
      el.appendChild(yield* convert(child));
    }

    return el;
  });
};

runTimeout(handle(test, handleRef<number, string>({}))).subscribe({
  update: (data) => console.log(data),
});
