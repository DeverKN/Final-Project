// export {};

type NumStateF<A> = StateF<number, A>;

const HIDDEN_RESULT_TAG = Symbol("HIDDEN_RESULT_TAG");
type HIDDEN_RESULT_TAG = typeof HIDDEN_RESULT_TAG;
type Effect<A, B> = {
  val: A;
  [HIDDEN_RESULT_TAG]: B;
};

type HKTs<A = never, B = never, C = never, D = never> = {
  List: A[];
  NumState: NumStateF<A>;
  EffectF: EffectF<A>;
};

type Tags = keyof HKTs;
type FunctorTag = Tags;

type Apply<Tag extends Tags, A = never, B = never, C = never, D = never> = HKTs<
  A,
  B,
  C,
  D
>[Tag];
type Functor<
  Tag extends Tags,
  A = never,
  B = never,
  C = never,
  D = never
> = Apply<Tag, A, B, C, D>;

const HIDDEN_TYPE_TAG = Symbol("HIDDEN_TYPE_TAG");
type HIDDEN_TYPE_TAG = typeof HIDDEN_TYPE_TAG;

const Pure = <F extends FunctorTag, A>(val: A): Free<F, A> => {
  return { tag: "Pure", val, [HIDDEN_TYPE_TAG]: void 0 as any };
};

const Impure = <F extends FunctorTag, A>(
  val: Functor<F, Free<F, A>>
): Free<F, A> => {
  return { tag: "Impure", val, [HIDDEN_TYPE_TAG]: void 0 as any };
};

type Free<F extends Tags, A> =
  | { tag: "Pure"; val: A; [HIDDEN_TYPE_TAG]: F }
  | { tag: "Impure"; val: Functor<F, Free<F, A>>; [HIDDEN_TYPE_TAG]: F };

const fmap = <F extends FunctorTag, A, B>(
  v: Free<F, A>,
  f: (a: A) => B
): Free<F, B> => {
  switch (v.tag) {
    case "Pure":
      return Pure(f(v.val));
    case "Impure":
      return Impure(v.val.map((v) => fmap(v, f)));
  }
};

/*
concatFree :: Functor f => Free f (Free f a) -> Free f a
concatFree (Pure x) = x
concatFree (Roll y) = Roll (fmap concatFree y)
*/

const concatFree = <F extends FunctorTag, A>(
  v: Free<F, Free<F, A>>
): Free<F, A> => {
  switch (v.tag) {
    case "Pure":
      return v.val;
    case "Impure":
      return Impure(v.val.map(concatFree));
  }
};

/*
liftFree :: Functor f => f a -> Free f a
liftFree x = Roll (fmap Pure x)
*/

const liftFree = <F extends FunctorTag, A>(v: Functor<F, A>): Free<F, A> => {
  return Impure(v.map(Pure));
};

/*
foldFree :: Functor f => (f r -> r) -> Free f r -> r
foldFree _ (Pure a) = a
foldFree f (Roll x) = f (fmap (foldFree f) x)
*/

const foldFree = <F extends FunctorTag, A>(
  f: (v: Functor<F, A>) => A,
  v: Free<F, A>
): A => {
  switch (v.tag) {
    case "Pure":
      return v.val;
    case "Impure":
      return f(v.val.map((v) => foldFree(f, v)));
  }
};

/*
newtype StateF s a = StateF { runStateF :: s -> (a, s) }
  deriving stock Functor

getF :: StateF s s
getF = StateF $ \s -> (s, s)

putF :: s -> StateF s ()
putF s = StateF $ const ((), s)

type State s = Free (StateF s)
*/

type StateF<S, A> = {
  runStateF: (s: S) => [A, S];
  map: <B>(f: (a: A) => B) => StateF<S, B>;
};

type EffectF<> = {};

const StateF = <S, A>(runStateF: (s: S) => [A, S]): StateF<S, A> => {
  return {
    runStateF,
    map: <B>(f: (a: A) => B): StateF<S, B> => {
      return StateF((s) => {
        const [a, s1] = runStateF(s);
        return [f(a), s1];
      });
    },
  };
};

const getF = <S>(): StateF<S, S> => {
  return StateF((s) => [s, s]);
};

const putF = <S>(s: S): StateF<S, null> => {
  return StateF(() => [null, s]);
};

type NumState<S> = Free<"NumState", S>;

/*
get :: State s s
get = Free $ Pure <$> getF
*/

/*
liftF :: Functor f => f a -> Free f a
*/
const liftF = <F extends FunctorTag, A>(v: Functor<F, A>): Free<F, A> => {
  return Impure(v.map(Pure) as any) as Free<F, A>;
};

const get = (): NumState<number> => {
  // const x = getF<number>()
  // const y = x.map(Pure)
  // const z = Impure(y)
  return Impure(getF<number>().map(Pure)) as NumState<number>;
};

const put = (s: number): NumState<null> => liftF(putF(s)) as any;

/*

someComputation :: State Int ()
someComputation = do
  i <- get
  put $ i + 1
  pure ()

*/

const someComputation = (): NumState<null> => {
  return bind(
    bind(get(), (i) => put(i + 1)),
    () => Pure(null)
  ) as NumState<null>;
};

/*

runState :: State s a -> s -> (a, s)
runState (Pure x) s = (x, s)
runState (Free f) s =
  let (m, s') = runStateF f s
  in runState m s'

*/

const runNumState = <A>(v: NumState<A>, s: number): [A, number] => {
  // console.log(v)
  switch (v.tag) {
    case "Pure":
      const val = v.val;
      // console.log({ val })
      return [v.val, s];
    case "Impure":
      const [m, s1] = v.val.runStateF(s);
      return runNumState(m, s1);
  }
};

/*

instance Functor f => Monad (Free f) where
  return = Pure
  Pure x >>= f = f x
  Free g >>= f = Free ((>>= f) <$> g)

*/

// const inferTag = <F extends FunctorTag, V extends Free<F, any>>(v: V): V["THIS_DOESNT_EXIST"] => {
//   return void 0 as any
// }

const bind = <F extends FunctorTag, A, B>(
  v: Free<F, A>,
  f: (a: A) => Free<F, B>
): Free<F, B> => {
  switch (v.tag) {
    case "Pure":
      return f(v.val);
    case "Impure":
      return Impure(v.val.map((v) => bind(v, f)));
  }
};

type ChainObject<F extends FunctorTag, A> = {
  bind: <B>(f: (a: A) => Free<F, B>) => ChainObject<F, B>;
  end: () => Free<F, A>;
};

const chain = <F extends FunctorTag, A>(v: Free<F, A>): ChainObject<F, A> => {
  return {
    bind: <B>(f: (a: A) => Free<F, B>): ChainObject<F, B> => {
      return chain(bind(v, f));
    },
    end: (): Free<F, A> => {
      return v;
    },
  };
};

const get1 = get();
// const test = inferTag(get1)
// const put
const test1 = bind(get1, put);
const test2 = bind<"NumState", number, null>(get1, put);

// const comp = (): NumState<null> => bind(bind(put(22), () => get()), (v) => put(2 * v))
// console.log(runNumState(get(), 0))
// console.log(runNumState(comp(), 0))

const testComputation = () => {
  return chain(get())
    .bind((i) => put(i * 2))
    .bind(get)
    .bind((i) => put(i + 1))
    .bind(get)
    .end();
};

const wrapM = <F extends FunctorTag, A>(
  v: Free<F, A>
): Generator<Free<F, A>, A, any> => {
  return (function* (): Generator<Free<F, A>, A, any> {
    const val = yield v;
    return val;
  })();
};
type DoGeneratorNotation<F extends FunctorTag, A> = Generator<Free<F, A>, A, A>;
const doFree = <F extends FunctorTag, A>(
  gen: () => DoGeneratorNotation<F, A>
): Free<F, A> => {
  return bind(Pure(null as A), doFreeHelper(gen()));
};

const doFreeHelper = <F extends FunctorTag, A>(
  gen: DoGeneratorNotation<F, A>
): ((a: A) => Free<F, A>) => {
  return (a) => {
    const res = gen.next(a);
    if (res.done) {
      return Pure(res.value);
    } else {
      return bind(res.value, doFreeHelper(gen));
    }
  };
};

const test = doFree(function* () {
  const i = yield* wrapM(get());
  yield put(i * 2);
  const j = yield* wrapM(get());
  yield put(j + 1);
  const k = yield get();
  return k;
});

console.log(runNumState(someComputation(), 0));
console.log(runNumState(someComputation(), 5));
console.log(runNumState(testComputation(), 5));
console.log(runNumState(testComputation(), 2));
console.log(runNumState(test, 5));

export { runNumState, someComputation };
// type NumState = State<number>;

type FFree<F extends Tags, A, X = any> =
  | { tag: "FPure"; val: A; [HIDDEN_TYPE_TAG]: F }
  | { tag: "FImpure"; val: Functor<F, X>; k: ((a: X) => FFree<F, A>); [HIDDEN_TYPE_TAG]: F };

const FPure = <F extends FunctorTag, A>(val: A): FFree<F, A> => {
  return { tag: "FPure", val, [HIDDEN_TYPE_TAG]: void 0 as any };
};

const FImpure = <F extends FunctorTag, X, A>(
  val: Functor<F, X>,
  k: ((a: X) => FFree<F, A>)
): FFree<F, A> => {
  return { tag: "FImpure", val, k, [HIDDEN_TYPE_TAG]: void 0 as any };
};

/*

data FReaderWriter i o x where
Get :: FReaderWriter i o i
Put :: o → FReaderWriter i o ()

*/

type FReaderWriterF<I, O, X> = {
  tag: "Get";
  map: <B>(f: (a: I) => B) => FReaderWriterF<I, O, B>;
} | {
  tag: "Put";
  val: O;
  // k: () => FReaderWriterF<I, O, B>
  map: <B>(f: (a: void) => B) => FReaderWriterF<I, O, B>;
};

/*
instance Monad (FFree f) where ...
Impure fx k’ >>= k = Impure fx (k’ >> k)
*/

/*
(>>>) :: Monad m ⇒ (a → m b) → (b → m c) → (a → m c)
f >>> g = (>>= g) . f
*/

const kleisli = <F extends FunctorTag, A, B, C>(f: (a: A) => FFree<F, B>, g: (b: B) => FFree<F, C>): ((a: A) => FFree<F, C>) => {
  return (a) => bind2(f(a), g);
}

const bind2 = <F extends FunctorTag, A, B>(m: FFree<F, A>, k: (a: A) => FFree<F, B>): FFree<F, B> => {
  switch (m.tag) {
    case "FPure":
      return k(m.val);
    case "FImpure": {
      const k$ = m.k;
      return FImpure(m.val, kleisli(k$, k));
    }
  }
}