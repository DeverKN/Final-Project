import { immutagen, ImmutaGenIterator, type ImmutaGen } from "immutagen";

type Box<A> = { val: A };
type HKTs<A, ParamTypes extends any[]> = {
  List: A[];
  Box: Box<A>;
  Task: Task<ParamTypes[0], A>;
};

type HKTTag = keyof HKTs<unknown, []>;
type Apply<Tag extends HKTTag, A, ParamTypes extends any[] = []> = HKTs<
  A,
  ParamTypes
>[Tag];

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

const kleisli = <F extends HKTTag, A, B, C>(
  f: (a: A) => FFree<F, B>,
  g: (b: B) => FFree<F, C>
): ((a: A) => FFree<F, C>) => {
  return (a) => bind(f(a), g);
};

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
etaF :: g a -> FFree g a
etaF fa = FImpure fa FPure
*/

export const etaF = <F extends HKTTag, A, ParamTypes extends any[]>(
  fa: Apply<F, A, ParamTypes>
): FFree<F, A, ParamTypes> => {
  return FImpure(fa, FPure) as any;
};

type ChainObject<F extends HKTTag, A, X extends any[]> = {
  bind: <B, Y extends any[]>(
    f: (a: A) => FFree<F, B, Y>
  ) => ChainObject<F, B, UnionArr<X, Y>>;
  end: () => FFree<F, A, X>;
};

type UnionArr<X, Y> = X extends [infer x, ...infer xs]
  ? Y extends [infer y, ...infer ys]
    ? [x | y, ...UnionArr<xs, ys>]
    : []
  : [];

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

export type Effect<Tag, V, R> = { tag: Tag; val: V; resume: R };

export type Task<Effects extends Effect<String, any, any>, Result> = any;
export type EffTask<Effects extends Effect<String, any, any>, Result> = FFree<
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

type Continuaton<K, R> = (x: K) => R;

export type Handler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = (
  k: Continuaton<[E["resume"], Partial<Handlers<Effects, T, Result>>], Result>,
  v: E["val"]
) => Result;

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

type PartialHandlers<Effects extends Effect<string, any, any>, T, Result> = Partial<{
  [tag in Effects["tag"]]: Handler<
    Extract<Effects, Effect<tag, any, any>>,
    Effects,
    T,
    Result
  >;
}> & {
  return: (t: T) => Result;
};

export const runTask = <
  Effects extends Effect<string, any, any>,
  Handle extends Handlers<Effects, T, Result>,
  T,
  Result
>(
  task: EffTask<Effects, T>,
  handlers: Handle
): Result => {
  // console.log("task", task)
  switch (task.tag) {
    case "FPure":
      return handlers.return(task.val);
    case "FImpure": {
      const k = (
        v: [
          x: Effects["resume"],
          handlers$: Partial<Handlers<Effects, T, Result>>
        ]
      ) => {
        const [x, handlers$] = v;
        const newHandlers: Handle = { ...handlers, ...handlers$ };
        return runTask(task.k(x), newHandlers as any);
      };

      // console.log(task.val);
      return handlers[task.val.tag as Effects["tag"]](k as any, task.val.val);
    }
  }
};

// type ImmutaGen<T, TReturn, TNext> = {
//   next: () => { value: TNext; done: false, gen: ImmutaGen } | { value: TReturn; done: true };
// }

// const taskDo = <Effects extends Effect<string, any, any>, T>(
//   gen: ImmutaGen<Effects, T, Effects["resume"]>
// ): EffTask<Effects, T> => {
//   const { value, done } = gen.next();
//   if (done) {
//     return FPure(value);
//   } else {
//     return FImpure(value, (x) => taskDo(gen));
//   }
// };

export const taskDo = <
  TArgs extends any[],
  Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
>(
  gen: (
    ...args: TArgs
  ) => Gen
) => (...args: TArgs): (Gen extends Generator<EffTask<infer Effects, any>, infer T, any> ? EffTask<Effects, T> : never) => {
  const immut = immutagen(gen);
  const res = (...args: any[]) => {
    const { value, next } = immut(...args);
    if (!next) {
      return FPure(value);
    } else {
      return bind(value, taskDoHelper(next));
    }
  };
  return res as any
};

const taskDoHelper = <Effects extends Effect<string, any, any>, T>(
  iter: ImmutaGenIterator<EffTask<Effects, any>, T, Effects["resume"]>
): ((val: Effects["resume"] | undefined) => EffTask<Effects, T>) => {
  return (val: Effects["resume"] | undefined = undefined) => {
    const { value, next } = iter(val);
    if (!next) {
      return FPure(value);
    } else {
      return bind(value, taskDoHelper(next));
    }
  };
};

export const wrapEff = <E extends Effect<any, any, any>, R>(
  t: EffTask<E, R>
): Generator<EffTask<E, R>, R, any> => {
  return (function* (): Generator<EffTask<E, R>, R, any> {
    const val = yield t;
    return val;
  })();
};

export const handle = <
  Effects extends Effect<string, any, any>,
  Handle extends PartialHandlers<Effects, T, any>,
  T
  // Result
>(
  task: EffTask<Effects, T>,
  handlers: Handle
): Handle extends PartialHandlers<Effects, T, infer Result> ? (EffTask<Exclude<Effects, Extract<Effects, Effect<keyof Handle, any, any>>>, Result>) : never => {
  // console.log("task", task);
  switch (task.tag) {
    case "FPure":
      return FPure(handlers.return(task.val)) as any;
    case "FImpure": {
      const k = (
        v: [
          x: Effects["resume"],
          handlers$: Partial<Handlers<Effects, T, any>>
        ]
      ) => {
        const [x, handlers$] = v;
        const newHandlers: Handle = { ...handlers, ...handlers$ };
        return runTask(task.k(x), newHandlers as any);
      };

      if (task.val.tag in handlers) {
        return (handlers[task.val.tag as Effects["tag"]] as any)(k as any, task.val.val);
      } else {
        return FImpure(task.val.val, task.val.k) as any;
      }
    }
  }
};

export const eff = <E extends Effect<any, any, any>>(tag: E["tag"]): E["val"] extends void ? (() => EffTask<E, E["resume"]>) : ((v: E["val"]) => EffTask<E, E["resume"]>) => {
  const e = (v: E["val"]) => etaF({ tag: tag, val: v, resume: null as E["resume"] })
  return e as any;
}
// const amb = <T>(vs: T[]): EffTask<AMB<T>, T> => {

export const run = <T>(task: EffTask<never, T>): T => runTask(task, {return: (v) => v});

export const w = wrapEff;
