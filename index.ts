import {
  EffTask,
  Effect,
  PartialHandler,
  PartialHandlers,
  Task,
  TypedEffTask,
  handle,
  run,
  taskDo,
  typedEff,
  typedTaskDo,
  u,
} from "Effect";

type Store<K, V> = Effect<"Store", [key: K, val: V], void>;
type Get<K, V> = Effect<"Get", [key: K], V | undefined>;
const get = <K, V>(key: K) => typedEff<Get<K, V>>("Get")(key);
const store = <K, V>(key: K, val: V) =>
  typedEff<Store<K, V>>("Store")(key, val);

const fib = (
  n: number
): TypedEffTask<Get<number, number> | Store<number, number>, number> =>
  typedTaskDo(function* () {
    const memo = yield* get<number, number>(n);
    if (memo != undefined) {
      return memo;
    } else {
      const result = (yield* fib(n - 1)) + (yield* fib(n - 2));
      yield* store(n, result);
      return result;
    }
  });

const handleMemo = <T, K extends string | symbol | number, V>(
  store: Record<K, V>
): PartialHandlers<Store<K, V> | Get<K, V>, T, T> => ({
  Get: (k, key) => {
    return k(store[key]);
  },
  Store: (k, key, val) => {
    const store$: Record<K, V> = { ...store, [key]: val }
    return k(void 0, handleMemo(store$));
  },
  return: (v) => v,
});

const result = run(handle(u(fib(1000)), handleMemo<number, number, number>({0: 0, 1: 1})))
console.log(result)

const naiveFib = (n: number): number => {
  if (n <= 1) return n;
  return naiveFib(n - 1) + naiveFib(n - 2);
}

// console.log(naiveFib(45))