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

// type MaybeAsync<F extends (...args: any) => any> = (...args: Parameters<F>) => Promise<ReturnType<F>> | ReturnType<F>;

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
// export type NamedEffect<Name, Eff extends Effect<any, any, any>> = { name: Name, effect: Eff }

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
export type EffectContinuation<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = Continuation<[E["resume"], Partial<Handlers<Effects, T, Result>>], Result>;
export type PartialEffectContinuation<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = Continuation<
  [E["resume"], PartialHandlers<Effects, T, Result>],
  EffTask<Effect<any, any, any>, Result>
>;

export type Handler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = E["val"] extends void
  ? (k: EffectContinuation<E, Effects, T, Result>) => Result
  : (k: EffectContinuation<E, Effects, T, Result>, ...v: E["val"]) => Result;

export type PartialHandler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  T,
  Result
> = E["val"] extends void
  ? (k: PartialEffectContinuation<E, Effects, T, Result>) => EffTask<Effect<any, any, any>, Result>
  : (k: PartialEffectContinuation<E, Effects, T, Result>, ...v: E["val"]) => EffTask<Effect<any, any, any>, Result>;

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

      // console.log("task", task);
      return handlers[task.val.tag as Effects["tag"]](
        k as any,
        ...task.val.val
      );
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
  Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
>(
  gen: () => Gen
): (Gen extends Generator<EffTask<infer Effects, any>, infer T, any> ? EffTask<Effects, T> : never) => {
  const immut = immutagen(gen);
  const { value, next } = immut();
  if (!next) {
    return FPure(value) as any;
  } else {
    return bind(value, taskDoHelper(next)) as any;
  }
};

export const typedTaskDo = <
  Gen extends Generator<EffTask<Effect<string, any, any>, any>, any, any>
>(
  gen: () => Gen
): (Gen extends Generator<EffTask<infer Effects, any>, infer T, any> ? TypedEffTask<Effects, T> : never) => {
  return w(taskDo(gen)) as any;
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
// type GetResult<Handle extends PartialHandlers<any, any, any>> =
//   Handle extends PartialHandlers<any, any, infer Result> ? Result : never;
// type FallThroughTask<
//   Effects extends Effect<string, any, any>,
//   Handle extends PartialHandlers<Effects, T, any>,
//   T
// > = EffTask<
//   Exclude<Effects, Extract<Effects, Effect<keyof Handle, any, any>>>,
//   GetResult<Handle>
// >;

export const handle = <Effects extends Effect<string, any, any>, Handle extends PartialHandlers<Effects, T, any>, T>(
  task: EffTask<Effects, T>,
  handlers: Handle
): (EffTask<Exclude<Effects, Extract<Effects, Effect<keyof Handle, any, any>>>, GetResult<Handle>>) => {
  switch (task.tag) {
    case "FPure":
      return FPure(handlers.return(task.val)) as any;
    case "FImpure": {
      const k = (
        v: [x: Effects["resume"], handlers$: Partial<Handlers<Effects, T, any>>]
      ) => {
        const [x, handlers$] = v;
        const newHandlers: Handle = { ...handlers, ...handlers$ };
        const res = handle(task.k(x), newHandlers as any);
        return res
        // if (res.tag === "FPure") {
        //   return res
        // } else {
        //   //TODO: something here
        // }
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

export const eff = <E extends Effect<any, any, any>>(
  tag: E["tag"]
): E["val"] extends void
  ? () => EffTask<E, E["resume"]>
  : (...v: E["val"]) => EffTask<E, E["resume"]> => {
  const e = (...v: E["val"]) =>
    etaF({ tag: tag, val: v, resume: null as E["resume"] });
  return e as any;
};

export const typedEff = <E extends Effect<any, any, any>>(
  tag: E["tag"]
): E["val"] extends void
  ? () => TypedEffTask<E, E["resume"]>
  : (...v: E["val"]) => TypedEffTask<E, E["resume"]> => {
  const e = (...v: E["val"]) =>
    w(etaF({ tag: tag, val: v, resume: null as E["resume"] }));
  return e as any;
};

export const run = <T>(task: EffTask<never, T>): T =>
  runTask(task, { return: (v) => v });

export const w = wrapEff;

type BoardTile = {
  text: string;
  color: "red" | "yellow" | "blue";
}