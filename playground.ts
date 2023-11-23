const ite = <Cond, Then, Else>(cond: Cond, then: () => Then, else_: () => Else): Cond extends true ? Then : Else => cond ? then() : else_() as any

// const test = ite<true, string, number>(true, () => "true", (): number => 1)

const test = <const B1, const B2>(b1: B1, b2: B2) => {
  return ite(b1, 
    () => ite(b2, 
      () => "TT" as const,
      () => "TF" as const),
    () => "F" as const)
}

type Case<R> = () => R
type CaseH<T, R> = {
  t: T,
  r: R
}
type Cases<C extends CaseH<any, any>> = {
  [caseName in C["t"]]: () => Extract<C, CaseH<caseName, any>>["r"]
}


const match = <const C extends CaseH<any, any>, T extends string>(t: T, cases: Cases<C>): Extract<C, CaseH<T, any>>["r"] => {
  return cases[t]
}

// type Uncases<M> = CaseH<keyof M, ReturnType<M[keyof M]>>

// const matches =  <C extends Cases<any>>(cases: C): Uncases<C> => {
//   return void 0 as any
// }

// const test9 = matches({
//   "dog": () => true as const,
//   "cat": () => true as const,
//   "rhino": () => false as const,
// })

const eq = <const A, const B>(a: A, b: B): A extends B ? B extends A ? true : false : false => {
  return (a === b as any) as any
}

// type Test = Cases<"dog" | "cat" | "rhino">
const test3 = <const A extends string>(a: A) => {
  return match(a, {
    "dog": () => true as const,
    "cat": () => true as const,
    "rhino": () => false as const,
  })
}

const test5 = test3("dog")

const test6 = <const A, const B>(a: A, b: B) => {
  return ite(eq(a, b), () => "yes" as const, () => "no" as const)
}

const test7 = test6("dog", "cat")

const test2 = test(true, false)