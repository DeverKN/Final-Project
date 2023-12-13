import { immutagen, ImmutaGenIterator, type ImmutaGen } from "immutagen";

/*

(co-pilot suggested this but it's actually right lmao)
This is a port of the Eff monad from the paper "Freer Monads, More Extensible Effects" by Oleg Kiselyov and Hiromi Ishii

*/

/*
This is a hack to get around the fact that TypeScript doesn't support higher kinded types.
I borrowed the idea from FP-TS
*/

type HKTs<A, ParamTypes extends any[]> = {
  List: A[];
  Task: Task<ParamTypes[0], A>;
};

type HKTTag = keyof HKTs<unknown, []>;
type Apply<Tag extends HKTTag, A, ParamTypes extends any[] = []> = HKTs<
  A,
  ParamTypes
>[Tag];

/*

Freer monad in Typescript

*/
const HIDDEN_TYPE_TAG = Symbol("HIDDEN_TYPE_TAG");
type HIDDEN_TYPE_TAG = typeof HIDDEN_TYPE_TAG;

type FFree<F extends HKTTag, A, ParamTypes extends any[] = [], X = any> =
  | { tag: "FPure"; val: A; [HIDDEN_TYPE_TAG]: F }
  | {
      tag: "FImpure";
      val: Apply<F, X, ParamTypes>;
      k: (a: X) => FFree<F, A, ParamTypes>;
      [HIDDEN_TYPE_TAG]: F;
    };

export const FPure = <F extends HKTTag, A, ParamTypes extends any[] = []>(
  val: A
): FFree<F, A, ParamTypes> => {
  return { tag: "FPure", val, [HIDDEN_TYPE_TAG]: void 0 as any };
};

export const FImpure = <
  F extends HKTTag,
  A,
  ParamTypes extends any[] = [],
  X = any
>(
  val: Apply<F, X>,
  k: (a: X) => FFree<F, A, ParamTypes>
): FFree<F, A> => {
  return { tag: "FImpure", val, k, [HIDDEN_TYPE_TAG]: void 0 as any };
};

/*
map for the freer monad
*/

const map = <F extends HKTTag, A, B>(
  m: FFree<F, A>,
  f: (a: A) => B
): FFree<F, B> => {
  switch (m.tag) {
    case "FPure":
      return FPure(f(m.val));
    case "FImpure":
      return FImpure(m.val, (x) => map(m.k(x), f));
  }
};

/*
kleisli composition (>>>) for the freer monad
*/

const kleisli = <F extends HKTTag, A, B, C>(
  f: (a: A) => FFree<F, B>,
  g: (b: B) => FFree<F, C>
): ((a: A) => FFree<F, C>) => {
  return (a) => bind(f(a), g);
};

/*
bind (>>=) for the freer monad
*/
export const bind = <F extends HKTTag, A, B, X extends any[], Y extends any[]>(
  m: FFree<F, A, X>,
  k: (a: A) => FFree<F, B, Y>
): FFree<F, B, UnionArr<X, Y>> => {
  switch (m.tag) {
    case "FPure":
      return k(m.val);
    case "FImpure": {
      const k$ = m.k;
      return FImpure(m.val, kleisli(k$, k));
    }
  }
};

/*
  lifts impure effects into the freer monad
*/
export const etaF = <F extends HKTTag, A, ParamTypes extends any[]>(
  fa: Apply<F, A, ParamTypes>
): FFree<F, A, ParamTypes> => {
  return FImpure(fa, FPure) as any;
};

// this is used to combine the effect types for two tasks when they're bound together
type UnionArr<X, Y> = X extends [infer x, ...infer xs]
  ? Y extends [infer y, ...infer ys]
    ? [x | y, ...UnionArr<xs, ys>]
    : []
  : [];


/*
  this is used for chaining syntax for binds
*/
type ChainObject<F extends HKTTag, A, X extends any[]> = {
  bind: <B, Y extends any[]>(
    f: (a: A) => FFree<F, B, Y>
  ) => ChainObject<F, B, UnionArr<X, Y>>;
  end: () => FFree<F, A, X>;
};

export const chain = <F extends HKTTag, A, ParamTypes extends any[]>(
  v: FFree<F, A, ParamTypes>
): ChainObject<F, A, ParamTypes> => {
  return {
    bind: <B>(f: (a: A) => FFree<F, B>): ChainObject<F, B, ParamTypes> => {
      return chain(bind(v, f));
    },
    end: (): FFree<F, A> => {
      return v;
    },
  };
};

/*
data StateEff s x where
  Get :: StateEff s s
  Put :: s -> StateEff s ()

type EffState s = FFree (StateEff s)
*/

/*
type for effects feat. lying about types for fun and profit
*/

const SymbolForResume = Symbol("SymbolForResume");
type SymbolForResume = typeof SymbolForResume;
export type Effect<Tag, V, R> = { tag: Tag; val: V; [SymbolForResume]: R };

export type Task<Effects extends Effect<string, any, any>, Result> = any;
export type EffTask<Effects extends Effect<string, any, any>, Result> = FFree<
  "Task",
  Result,
  [Effects]
>;

/*
getEff:: EffState s s
getEff = etaF Get 

putEff:: s -> EffState s ()
putEff = etaF . Put
*/

/*
runEffState :: EffState s a -> s -> (a,s)
runEffState (FPure x) s     = (x,s)
runEffState (FImpure m q) s =
  let (x,s') = unEffState m s in runEffState (q x) s'

unEffState :: StateEff s a -> (s -> (a,s))
unEffState Get s     = (s,s)
unEffState (Put s) _ = ((),s)
*/

type Continuation<K, R> = (x: K) => R;
type TupleContinuation<K extends any[], R> = (...x: K) => R;

/*
The continuations passed to handlers
*/
export type EffectContinuation<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = (
  val: E[SymbolForResume],
  newHandlers?: Partial<Handlers<Effects, T, Result>>
) => Result; // TupleContinuation<[E[SymbolForResume], Partial<Handlers<Effects, T, Result>>], Result>;

export type PartialEffectContinuation<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = (
  val: E[SymbolForResume],
  newHandlers?: PartialHandlers<Effects, T, Result>
) => EffTask<Effect<any, any, any>, Result>;

/*
A handler for a single effect
*/
export type Handler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = E["val"] extends void
  ? (k: EffectContinuation<E, Effects, T, Result>) => Result
  : (k: EffectContinuation<E, Effects, T, Result>, ...v: E["val"]) => Result;

/*
A handler for a single effect in a partial handler
*/
export type PartialHandler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = E["val"] extends void
  ? (
      k: PartialEffectContinuation<E, Effects, T, Result>
    ) => EffTask<Effect<any, any, any>, Result>
  : (
      k: PartialEffectContinuation<E, Effects, T, Result>,
      ...v: E["val"]
    ) => EffTask<Effect<any, any, any>, Result>;

/*
Handlers for a set of effects
*/
export type Handlers<Effects extends Effect<string, any, any>, T, Result> = {
  [tag in Effects["tag"]]: Handler<
    Extract<Effects, Effect<tag, any, any>>,
    Effects,
    T,
    Result
  >;
} & {
  return: (t: T) => Result;
};

/*
Partial handlers for a set of effects
*/
export type PartialHandlers<
  Effects extends Effect<string, any, any>,
  T,
  Result
> = Partial<{
  [tag in Effects["tag"]]: PartialHandler<
    Extract<Effects, Effect<tag, any, any>>,
    Effects,
    T,
    Result
  >;
}> & {
  return: (t: T) => Result;
};

/*
runs a task when given all the handlers for its effects
*/
export const runTask = <
  Effects extends Effect<string, any, any>,
  Handle extends Handlers<Effects, T, Result>,
  T,
  Result
>(
  task: EffTask<Effects, T>,
  handlers: Handle
): Result => {
  switch (task.tag) {
    case "FPure":
      return handlers.return(task.val);
    case "FImpure": {
      const k = (
        val: Effects[SymbolForResume],
        handlers$: Partial<Handlers<Effects, T, Result>> = handlers as Partial<
          Handlers<Effects, T, Result>
        >
      ) => {
        const newHandlers: Handle = { ...handlers, ...handlers$ };
        return runTask(task.k(val), newHandlers as any);
      };

      return handlers[task.val.tag as Effects["tag"]](
        k as any,
        ...task.val.val
      );
    }
  }
};

/*
do notation for tasks
converts a generator into a task monad
*/
export const taskDo = <
  Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
>(
  gen: () => Gen
): Gen extends Generator<EffTask<infer Effects, any>, infer T, any> ? EffTask<Effects, T> : never => {
  const immut = immutagen(gen);
  const { value, next } = immut();
  if (!next) {
    return FPure(value) as any;
  } else {
    return bind(value, taskDoHelper(next)) as any;
  }
};

/*
same as a above but with better type inference for yield
*/
export const typedTaskDo = <
  Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
>(
  gen: () => Gen
): Gen extends Generator<EffTask<infer Effects, any>, infer T, any> ? TypedEffTask<Effects, T> : never => {
  return w(taskDo(gen)) as any;
};

const taskDoHelper = <Effects extends Effect<string, any, any>, T>(
  iter: ImmutaGenIterator<EffTask<Effects, any>, T, Effects[SymbolForResume]>
): ((val: Effects[SymbolForResume] | undefined) => EffTask<Effects, T>) => {
  return (val: Effects[SymbolForResume] | undefined = undefined) => {
    const { value, next } = iter(val);
    if (!next) {
      return FPure(value);
    } else {
      return bind(value, taskDoHelper(next));
    }
  };
};

/*
used to get better type inference for yield
*/
export type TypedEffTask<E extends Effect<string, any, any>, R> = Generator<
  EffTask<E, R>,
  R,
  any
>;
export const wrapEff = <E extends Effect<any, any, any>, R>(
  t: EffTask<E, R>
): TypedEffTask<E, R> => {
  return (function* (): Generator<EffTask<E, R>, R, any> {
    const val = yield t;
    return val;
  })();
};

export type GetResult<Handle extends PartialHandlers<any, any, any>> =
  ReturnType<Handle["return"]>;

/*

handles a subset of the effects of a task similar to runTask but also deals with 
effects that don't have a handler by repackaging them as tasks

*/
export const handle = <
  Effects extends Effect<string, any, any>,
  Handle extends PartialHandlers<Effects, T, any>,
  T
>(
  task: EffTask<Effects, T>,
  handlers: Handle
): (EffTask<Exclude<Effects, Extract<Effects, Effect<keyof Handle, any, any>>>,GetResult<Handle>>) => {
  switch (task.tag) {
    case "FPure":
      return FPure(handlers.return(task.val)) as any;
    case "FImpure": {
      const k = (
        val: Effects[SymbolForResume],
        handlers$: Partial<Handlers<Effects, T, any>> = handlers as Partial<
          Handlers<Effects, T, any>
        >
      ) => {
        const newHandlers: Handle = { ...handlers, ...handlers$ };
        const res = handle(task.k(val), newHandlers as any);
        return res;
      };

      if (task.val.tag in handlers) {
        return (handlers[task.val.tag as Effects["tag"]] as any)(
          k as any,
          ...task.val.val
        );
      } else {
        const k$ = (v: any): FFree<"Task", T, [Effects], any> => {
          return handle(task.k(v), handlers) as any;
        };
        return FImpure(task.val, k$) as any;
      }
    }
  }
};

/* helpers for making effect constructors */
export const eff = <E extends Effect<any, any, any>>(
  tag: E["tag"]
): (E["val"] extends void ? () => EffTask<E, E[SymbolForResume]> : (...v: E["val"]) => EffTask<E, E[SymbolForResume]>) => {
  const e = (...v: E["val"]) =>
    etaF({ tag: tag, val: v, resume: null as E[SymbolForResume] });
  return e as any;
};

export const typedEff = <E extends Effect<any, any, any>>(
  tag: E["tag"]
): (E["val"] extends void ? () => TypedEffTask<E, E[SymbolForResume]> : (...v: E["val"]) => TypedEffTask<E, E[SymbolForResume]>) => {
  const e = (...v: E["val"]) =>
    w(etaF({ tag: tag, val: v, resume: null as E[SymbolForResume] }));
  return e as any;
};

/* runs a task with no effects */
export const run = <T>(task: EffTask<never, T>): T =>
  runTask(task, { return: (v) => v });

export const unWrapEff = <E extends Effect<any, any, any>, R>(
  t: TypedEffTask<E, R>
): EffTask<E, R> => {
  return taskDo(function* () {
    const val = yield* t;
    return val;
  });
};
export const w = wrapEff;
export const u = unWrapEff;
export const Pure = FPure;
