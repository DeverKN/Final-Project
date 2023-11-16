type Box<A> = { val: A };
type HKTs<A, ParamTypes extends any[]> = {
  List: A[];
  Box: Box<A>;
  NumState: StateF<number, A>;
  NumStateEff: StateEff<number, A>;
  StateEff: StateEff<ParamTypes[0], A>;
  ChooseEff: ChooseEff<A>;
  Task: Task<ParamTypes[0], A>;
  // NumState: NumStateF<A>;
  // EffectF: EffectF<A>;
};

type HKTTag = keyof HKTs<unknown, []>;
// type FunctorTag = HKTTag;
type Apply<Tag extends HKTTag, A, ParamTypes extends any[] = []> = HKTs<
  A,
  ParamTypes
>[Tag];

const HIDDEN_TYPE_TAG = Symbol("HIDDEN_TYPE_TAG");
type HIDDEN_TYPE_TAG = typeof HIDDEN_TYPE_TAG;

// type Free<F extends FunctorTag, A> =
//   | { tag: "Pure"; val: A; [HIDDEN_TYPE_TAG]: F }
//   | { tag: "Impure"; val: Functor<F, Free<F, A>>; [HIDDEN_TYPE_TAG]: F };

type FFree<F extends HKTTag, A, ParamTypes extends any[] = [], X = any> =
  | { tag: "FPure"; val: A; [HIDDEN_TYPE_TAG]: F }
  | {
      tag: "FImpure";
      val: Apply<F, X, ParamTypes>;
      k: (a: X) => FFree<F, A, ParamTypes>;
      [HIDDEN_TYPE_TAG]: F;
    };

const FPure = <F extends HKTTag, A, ParamTypes extends any[] = []>(
  val: A
): FFree<F, A, ParamTypes> => {
  return { tag: "FPure", val, [HIDDEN_TYPE_TAG]: void 0 as any };
};

const FImpure = <F extends HKTTag, A, ParamTypes extends any[] = [], X = any>(
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

const bind = <F extends HKTTag, A, B, X extends any[], Y extends any[]>(
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

const etaF = <F extends HKTTag, A, ParamTypes extends any[]>(
  fa: Apply<F, A, ParamTypes>
): FFree<F, A, ParamTypes> => {
  return FImpure(fa, FPure) as any;
};

/*
newtype State s a = State{unState :: s -> (a,s)}

get :: State s s
get = State $ \s -> (s,s)

put :: s -> State s ()
put s = State $ \_ -> ((),s)

runState :: State s a -> s -> (a,s)
runState = unState
*/

type StateF<S, A> = (s: S) => [A, S];

const get = <S>(): StateF<S, S> => {
  return (s) => [s, s];
};

const put = <S>(s: S): StateF<S, null> => {
  return (_: S) => [null, s];
};

const runState = <S, A>(state: StateF<S, A>, s: S): [A, S] => {
  return state(s);
};

/*
type FFState s = FFree (State s)
*/

type FFState<S> = FFree<"NumState", S>;

/*
getFF :: FFState s s
getFF = etaF get

putFF :: s -> FFState s ()
putFF = etaF . put
*/

const getFF = (): FFState<number> => {
  return etaF(get());
};

const putFF = (s: number): FFState<null> => {
  return etaF(put(s));
};

/*
runFFState :: FFState s a -> s -> (a,s)
runFFState (FPure x) s     = (x,s)
runFFState (FImpure m q) s = let (x,s') = unState m s in runFFState (q x) s'
*/

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

type TestArr = UnionArr<[1, 2], ["a", "b"]>;

const chain = <F extends HKTTag, A, ParamTypes extends any[]>(
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

const someComputation = (): FFState<null> => {
  return bind(
    bind(getFF(), (i) => putFF(i + 1)),
    () => FPure(null)
  ) as FFState<null>;
};

const testComputation = (): FFState<null> => {
  return chain(getFF())
    .bind((i) => putFF(i + 1))
    .bind(() => getFF())
    .bind((i) => putFF(i * 2))
    .end();
};

const runFFState = <A>(state: FFState<A>, s: number): [A, number] => {
  switch (state.tag) {
    case "FPure":
      return [state.val, s];
    case "FImpure": {
      const [x, s$] = state.val(s);
      return runFFState(state.k(x), s$);
    }
  }
};

console.log(runFFState(someComputation(), 0));
console.log(runFFState(testComputation(), 5));

/*
data StateEff s x where
  Get :: StateEff s s
  Put :: s -> StateEff s ()

type EffState s = FFree (StateEff s)
*/

type Effect<Tag, V, R> = { tag: Tag; val: V; resume: R };
type Read<T> = { tag: "read"; val: null; resume: T };
type Write<T> = { tag: "write"; val: T; resume: null };

type Task<Effects extends Effect<String, any, any>, Result> = any;
type EffTask<Effects extends Effect<String, any, any>, Result> = FFree<
  "Task",
  Result,
  [Effects]
>;
type ReadTask = EffTask<Write<string> | Read<string>, string>;

type StateEff<S, X> =
  | { tag: "Get"; resume: X }
  | { tag: "Put"; val: S; resume: X };
type NumEffState<A> = FFree<"NumStateEff", A>;
type EffState<S, A> = FFree<"StateEff", A, [S]>;

type ChooseEff<X> =
  | { tag: "Choose"; val: X[]; resume: X }
  | { tag: "Assert"; val: boolean; resume: null[] };

type Test = EffState<number, null>;
type Test2 = NumEffState<null>;
type EffChoose<A> = FFree<"ChooseEff", A>;
/*
getEff:: EffState s s
getEff = etaF Get

putEff:: s -> EffState s ()
putEff = etaF . Put
*/

const getEff = (): NumEffState<number> => {
  return etaF({ tag: "Get", resume: null as any as number });
};

const getEff$ = <S>(): EffState<S, S> => {
  return etaF({ tag: "Get", resume: null as any as S });
};

// const test = getEff$<number>()

const putEff = (s: number): NumEffState<null> => {
  return etaF({ tag: "Put", val: s, resume: null });
};

const putEff$ = <S>(s: S): EffState<S, null> => {
  return etaF({ tag: "Put", val: s, resume: null }); // as any;
};

/*
runEffState :: EffState s a -> s -> (a,s)
runEffState (FPure x) s     = (x,s)
runEffState (FImpure m q) s =
  let (x,s') = unEffState m s in runEffState (q x) s'

unEffState :: StateEff s a -> (s -> (a,s))
unEffState Get s     = (s,s)
unEffState (Put s) _ = ((),s)
*/

const runEffState = <A>(state: NumEffState<A>, s: number): [A, number] => {
  switch (state.tag) {
    case "FPure":
      return [state.val, s];
    case "FImpure": {
      const [x, s$] = unEffState(state.val, s);
      return runEffState(state.k(x), s$);
    }
  }
};

const unEffState = <A>(state: StateEff<number, A>, s: number): [A, number] => {
  switch (state.tag) {
    case "Get":
      return [s, s] as any;
    case "Put":
      return [null, state.val] as any;
  }
};

const lbind = <A, B>(m: A[], f: (a: A) => B[]): B[] => {
  return m.flatMap(f);
}

const runEffChoose = <A>(state: EffChoose<A>): A[] => {
  switch (state.tag) {
    case "FPure":
      return [state.val];
    case "FImpure": {
      const xs = unEffChoose(state.val);
      return lbind(xs, (x) => runEffChoose(state.k(x)));
    }
  }
};

const unEffChoose = <A>(state: ChooseEff<A>): A[] => {
  switch (state.tag) {
    case "Choose":
      return state.val;
    case "Assert": {
      if (state.val) {
        return [null as any];
      } else {
        return [];
      }
    }
  }
};

const chooseEff = <A>(xs: A[]): EffChoose<A> => {
  return etaF({ tag: "Choose", val: xs, resume: null as A });
};

const assertEff = (b: boolean): EffChoose<null> => {
  return etaF({ tag: "Assert", val: b, resume: null as any as null[] });
};

const testComputationL = (): EffChoose<number> => {
  // return bind(chooseEff([1, 2, 3]), (x) =>
  //   bind(FPure(x + 3), (i) => bind(assertEff(i > 4), () => FPure(i)))
  // );
  return bind(chooseEff([1, 2, 3]), (x) =>
    bind(chooseEff([2, 4, 6]), (y) =>
      bind(FPure(x + y), (i) => bind(assertEff(i > 4), () => FPure(i)))
    )
  );
  // .bind((i) => assertEff(i > 4))
  // .bind((i) => FPure(i))
  // .end();
};

console.log(runEffChoose(testComputationL()));

const testComputationEff = (): EffState<number, null> => {
  return chain(getEff$<number>())
    .bind((i) => putEff$(i + 1))
    .bind(() => getEff$<number>())
    .bind((i) => putEff$(i * 2))
    .end();
};

const runEffState$ = <S, A>(state: EffState<S, A>, s: S): [A, S] => {
  switch (state.tag) {
    case "FPure":
      return [state.val, s] as any;
    case "FImpure": {
      const [x, s$] = unEffState$(state.val, s);
      return runEffState$(state.k(x), s$) as any;
    }
  }
};

const unEffState$ = <S, A>(state: StateEff<S, A>, s: S): [A, S] => {
  switch (state.tag) {
    case "Get":
      return [s, s] as any;
    case "Put":
      return [null, state.val] as any;
  }
};

const testComputationEff2 = (): EffState<string, null> => {
  return chain(getEff$<string>())
    .bind((i) => putEff$("hello " + i))
    .bind(() => getEff$<string>())
    .bind((i) => putEff$(i + " ${name}!!"))
    .end();
};

console.log(runEffState$(testComputationEff2(), "there"));

type Continuaton<K, R> = (x: K) => R;

type Handler2<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  Result
> = (k: Continuaton<[E["resume"], Partial<Handlers<Effects, Result>>], Result>, v: E["val"]) => Result;

type Handler<
  E extends Effect<string, any, any>,
  Effects extends Effect<string, any, any>,
  Result
> = (e: E["val"]) => [E["resume"], Partial<Handlers<Effects, Result>>];

type Handlers<Effects extends Effect<string, any, any>, Result> = {
  [tag in Effects["tag"]]: Handler<
    Extract<Effects, Effect<tag, any, any>>,
    Effects,
    Result
  >;
}
// } & {
//   return: (t: T) => Result;
// };

const handle = <
  Effects extends Effect<string, any, any>,
  H extends Handlers<Effects, Return>,
  T,
  Return
>(
  effect: Effects,
  handlers: H
): [Effects["resume"], H] => {
  const [res, handlers$] = handlers[effect.tag as Effects["tag"]](effect.val);
  const newHandlers = { ...handlers, ...handlers$ };
  return [res, newHandlers];
};

// const run

const runTask = <Effects extends Effect<string, any, any>, Handle extends Handlers<Effects, Result>, Result>(
  task: EffTask<Effects, Result>,
  handlers: Handle
): Result => {
  switch (task.tag) {
    case "FPure":
      return task.val;
    case "FImpure": {
      const k = (x: Effects["resume"], handlers$: Handle) => {
        return runTask(task.k(x), handlers);
      }
      const [x, handlers$] = handle(task.val, handlers as any);
      // const task = state.val
      return runTask(task.k(x), handlers$); // as any;
    }
  }
};

const read = <T>(): EffTask<Read<T>, T> => {
  return etaF({ tag: "read", val: null, resume: null as T });
};

const write = <T>(s: T): EffTask<Write<T>, null> => {
  return etaF({ tag: "write", val: s as T, resume: null });
};

const test = bind(read<string>(), (s) => write("test"));

const testComputationEff3 = (): EffTask<
  Read<string> | Write<string>,
  string
> => {
  const test = chain(read<string>())
    .bind((i) => write("hello " + i))
    .bind(() => read<string>())
    .bind((i) => write(i + " ${name}!!"))
    .bind(() => read<string>())
    .end();
  return test;
};

const handlerState = <T>(s: T): Handlers<Read<T> | Write<T>, T> => ({
  read: () => [s, handlerState(s)],
  write: (s) => [null, handlerState(s)],
});

// const handlerState = <T>(s: T): Handlers<Read<T> | Write<T>> => ({
//   read: () => [s, handlerState(s)],
//   write: (s) => [null, handlerState(s)],
// });

console.log(runTask(testComputationEff3(), handlerState("there")));

// type Choose<T> = { tag: "read"; val: null; resume: T };
// type Assert = { tag: "write"; val: boolean; resume: null };

// const handlerChoose = <T>(): Handlers<Choose<T> | Assert> => ({
//   read: () => [s, handlerChoose()],
//   write: (s) => [null, handlerChoose()],
// })

// type EffState<S> =

/*
data Lang r where
    LReturn     :: Var -> Lang Int
    LPrint      :: IntExpr -> Lang ()
    LAssign     :: Var -> IntExpr -> Lang ()
    LRead       :: Var -> Lang Int
*/

type Lang<R> = { tag: "LReturn"; val: number } | { tag: "LPrint"; val: null };

export {};

type Eff<R, A> = unknown
const run = <W>(eff: Eff<void, W>): W => {
  return eff as any;
}

// const send_req = <A, R>(f: (s: Suspension<A>) => Request): Eff<R, A> => {
//   return f as any;
// }