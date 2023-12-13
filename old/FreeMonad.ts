type List<A> = A[];
type Box<A> = {
  val: A;
  map: <B>(f: (a: A) => B) => Box<B>;
};

type State<S, A> = {
  run: (s: S) => [A, S];
  map: <B>(f: (a: A) => B) => State<S, B>;
}

const getF = <S>(): State<S, S> => {
  return {
    run: (s) => [s, s],
  }
}

const putF = <S>(s: S): State<S, null> => {
  return {
    run: () => [null, s]
  }
}

type FunctorsMap<A, B> = {
  List: List<A>;
  Box: Box<A>;
  Free: Free<Functor, A>;
  State: State<A, B>;
};

interface IFunctor<T> {
  map: <U>(f: (a: T) => U) => IFunctor<U>;
}

type Return = <T>(t: T) => IMonad<T>;

interface IMonad<T> {
  bind: <U>(f: (a: T) => IMonad<U>) => IMonad<U>;
}

type Functor = keyof FunctorsMap<any, any>;
type FunctorInstance<Name extends Functor, A = any, B = any> = FunctorsMap<A, B>[Name];

// const functor = <F extends Functor>(funct: FunctorInstance<F, any>): FunctorInstance<F, any> => funct
// functor([1, 2, 3])

// const test = <F extends Functor>(funct: FunctorInstance<F, any>) => {
// }

type Tagged<Tag extends string, val> = Mappable<{
  tag: Tag;
  val: val;
  //map: <B>(f: (a: val) => B) => Tagged<Tag, B>;
}>;
type Pure<A> = Tagged<"Pure", A>;

const Pure = <A>(val: A): Pure<A> => {
  return { tag: "Pure", val, map: (f) => Pure(f(val)) as any};
};
// type Impure<F extends Functor, A> = Tagged<"Impure", FunctorInstance<F, A>>
// type Impure<A> = Tagged<"Impure", A>;
//type Impure<F extends Functor, A> = Mappable<{ tag: "Impure"; val: FunctorInstance<F, Free<F, A>> }>;
type Impure<F extends Functor, A> = Mappable<{
  tag: "Impure";
  val: FunctorInstance<F, A>;
}>;

const Impure = <F extends Functor, A>(
  val: FunctorInstance<F, A>
): Impure<F, A> => {
  return {
    tag: "Impure",
    val,
    map: (f) => {
      return Impure(val.map((val) => val.map(f)) as any) as any;
    },
  };
};

// const Impure = <F extends Functor, A>(f: FunctorInstance<F, any>, val: A): Pure<A> =>
// { return { tag: "Pure", f, val } }

type Mappable<T extends { tag: string; val: any }> = T & {
  map: <B>(f: (a: T["val"]) => B) => Mappable<T & { tag: T["tag"]; val: B }>;
};

type Bindable<T extends { tag: string; val: any }> = T & {
  bind: <U, B extends { tag: string; val: U }>(f: (a: T["val"]) => B) => B;
  map: <B>(f: (a: T["val"]) => B) => Bindable<RowPoly<{ tag: T["tag"]; val: B }, T>>;
};

type RowPoly<T, R> = T & GetExcess<T, R>;
type GetExcess<T, R> = {
  [K in keyof R]: K extends keyof T ? unknown : K;
};

// type Test3 = { val: unknown } & { val: string }
// const Test3: Test3 = void 0 as any
// Test3.val

type Test2 = GetExcess<{ tag: string }, { tag: string; cat: false }>;

const dupTag = <V extends { tag: string }>(
  v: V
): RowPoly<{ tag: Symbol; tag2: string }, V> =>
  void 0 as any;
const test = dupTag({ tag: "a", dog: false });
// type Impure =
type Free<F extends Functor, A> =
  | Pure<A>
  | Mappable<{ tag: "Impure"; val: FunctorInstance<F, Free<F, A>> }>;

const ret = Pure;

type Box2<T> = Bindable<{ tag: "Box"; val: T, name: "Box" }>;
const box = <T>(val: T) => void 0 as any as Box2<T>;
const box1 = box(1);
type BoxT = typeof box1;
box1
  .bind((num) => box(num.toString()))
  .bind((str) => box(str.length))
  .map((num) => num + 1);
// const test = box1.map(x => x + 1).map(x => x.toString())

// type MapT = Box2<number>["map"]

// type List2<A> = null | {car: A, cdr: List2<A>}

// const fmap = <F extends Functor, A, B>(
//   base: Free<F, A>,
//   f: (a: A) => B
// ): Free<F, B> => {
//   return match(base, {
//     Pure: (x) => Pure(f(x)),
//     Impure: (g) => {
//       return Impure(fmap(g, (x) => fmap(x, f)))
//     },
//   });
// };

type AADT = { tag: string; val: any };
type GetTags<ADT extends AADT> = ADT["tag"];
// type Test = GetTags<Free<any, any>>
type MatchHelper<ADT extends AADT, T> = {
  [Tag in GetTags<ADT>]: (val: Extract<ADT, { tag: Tag }>["val"]) => T;
};

const match = <ADT extends AADT, T>(val: ADT, cases: MatchHelper<ADT, T>): T =>
  cases[val.tag](val.val);

//type fmap<F, A, B> = (monad: Free<F, A>, f: (a: A) => B) => Free<F, B>

type StateF<S, A> = {
  get: () => StateF<S, S>;
  put: (s: S) => StateF<S, void>;
  map: <B>(f: (a: A) => B) => StateF<S, B>;
};

export {}