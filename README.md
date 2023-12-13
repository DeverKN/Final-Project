# F.ts

## Installation

Note: The instructions below are for Bun which is the JavaScript runtime I used when creating and testing this project. It probably works with Node too but I haven't tested it and the steps may very

#### Step 0.

Install Bun if you haven't already (https://bun.sh/docs/installation)

#### Step 1.

Clone this project

#### Step 2.

Navigate to the project and run `bun install` to install the dependencies.
Note: you might get a FileNotFound error when installing typescript. This shouldn't actually effect anything but if it does run `bunt install typescript` to fix it

#### Step 3.

Run it! Use `bun test` to verify that the tests in the test folder produce the expected output. If you write your own code using effects you can run it with `bun run ${FILENAME}` ex. `bun run index.ts`

## Usage

#### Examples

For examples of this library in action check `index.ts` and the tests `test/effect.text.ts`. For a more in-depth explanation read below.

#### Defining Effects

The first step is declaring your Effects signatures. There are declared as TypeScript types. Here's example of simple effects for state.

```ts
import { Effect } from "Effect";
type Get<T> = Effect<"get", never, T>;
type Set<T> = Effect<"set", [val: T], void>;
```

The first effect gets the stored state value and the second effect updates the stored value. Effects can carry data as arguments and also have a return type. The first effect `Get` doesn't take any arguments (represented by `never`) but returns a value of `T` whereas the `Set` effect takes an argument `val` of type `T` and returns nothing (represented by `void`). These effects don't do anythingt by themselves, they need a handler to implement the actual behaviour. By itself an effect just represents a contract with the handler, similar to an interface. Usually effects have implied behaviour, in this case it's implied that if you do `Set` and then `Get` you'll get back the set value, but it's up to the handlers implementation to ensure this.

Right now these effects are just TypeScript types and types can't have any runtime behavior. In order to actually use the effects you need to make constructors for them. You can use the `eff` helper function to easily create constructors for effects as shown below

```ts
import { Effect, eff } from "Effect";
type LaunchMissiles = Effect<
  "launchMissiles",
  [numOfMissiles: number],
  boolean
>;
const launch = eff<LaunchMissiles>("launchMissiles");
const test = launch(52);
const test2 = launch("21"); /* <-- this will type error */
```

`eff` will create an effect constructor that makes sure you pass the right type of arguments to the effect. However, for polymorphic effects, like `Get<T>` you need to use the more verbose syntax shown below.

```ts
import { eff } from "Effect";
const get = <T>() => eff<Get<T>>("get")();
const set = <T>(val: T) => eff<Get<T>>("set")(val);
```

#### Defining Tasks

Now that we've defined our effects it's time to use them! These effects can't just be used inside normal functions, they need to be used as part of a Task. A Task is a computation that has some effects and gives back a result. For example a `Task<Get<number>, string>` represents a computation that uses the `Get<number>` effect and returns a string. Tasks also make sure that all the effects needed are handled, there is no way to turn a `Task<Get<number>, string>` into a string without using a handler for the `Get<number>` effect. There are three ways to construct task: bind, chaining, and do-notation

1. Bind

```ts
const bindTask = bind(get(),
    (v) => bind(set(v + 2),
    () => bind(get(),
    (v) => bind(set(v + 1),
    () => get()
    (v) => Pure(`Count is ${v}`)))))
```

This is similar to the `>>=` operator from Haskell, the left side is an Effect or a Task (spoiler: Effects are just Tasks with a single Effect) and the right side is a lambda the gets passed the result as an argument. You can use `Pure` to lift pure values, such as the result, similar to `return` in Haskell. This syntax works but it's pretty complicated and hard to reason about. The other two options (chaining and do-notation) address these issues and should be preferred over bind

2. Chaining

```ts
const chainTask = chain(get())
  .bind((v) => set(v + 2))
  .bind(() => get())
  .bind((v) => set(v + 1))
  .bind(() => get())
  .bind((v) => Pure(`Count is ${v}`))
  .end();
```

This is similar to the bind except instead of the continuation lambda being the second argument it is instead passed using the `.bind` method. If you're familiar with promises this is similar to `.then` chaining as opposed to the callback hell of bind. Once you're done you need to call `.end()` to end the chain and convert it back to a regular task. However, there are a several issues with this syntax (unsuprisingly these are many of the same issues there were with promise chaining) the biggest is that there is no way to access previous values. For example this code is not possible since v1 is out of scope in the lambda with v2:

```ts
const chainTask = chain(get())
  .bind((v1) => set(v1 + 2))
  .bind(() => get())
  .bind((v2) => set(v1 + v2))
  .bind(() => get())
  .bind((v) => Pure(`Count is ${v}`))
  .end();
```

do-notation addresses this issue while also being much closer to "normal programming" syntax.

##### Sidenote 1:

[This video](https://www.youtube.com/watch?v=rivBfgaEyWQ) is a great overview of the evolution of async in JavaScript. TLDW: Promises are JavaScript's "monad" and async/await is JavaScript's version of do-notation.

3. do-notation

```ts
const doTask = taskDo(function* () {
  let v = yield get();
  yield set(v + 2);
  v = yield get();
  yield set(v + 1);
  return `Count is ${yield get()}`;
});
```

If you've worked with monads at all before this probably the part you've been waiting for. JavaScript (and by extension TypeScript) don't have support for do-notation however, it's possible to emulate it by using generators. Anytime you use an Effect or a Task you need to use `yield` however, other than that it's basically the same as writing TypeScript. The return value is automatically wrapped in `Pure` aswell so you don't need to explictly use `Pure`. If you use the code above you will notice that v has type `any` rather than `number` like it did in the other examples. This is due to how TypeScript handles generators but it is possible to get proper type inference with a little bit more work.

```ts
import { w } from "Effect";
const doTask = taskDo(function* () {
  let v = yield* w(get());
  yield* w(set(v + 2));
  v = yield* w(get());
  yield* w(set(v + 1));
  return `Count is ${yield* w(get())}`;
});
```

If you use `yield*` instead of `yield` and wrap the tasks and effects you use with `w()` you can get proper type inference. You can also use `typedEff` instead of `eff` to avoid having to use `w`. For example, the above could be rewritten as.

```ts
import { Effect, typedEff } from "Effect";

type Get<T> = Effect<"get", never, T>;
type Set<T> = Effect<"set", [val: T], void>;
const get = <T>() => typedEff<Get<T>>("get")();
const set = <T>(val: T) => typedEff<Get<T>>("set")(val);

const doTask = taskDo(function* () {
  let v = yield* get();
  yield* set(v + 2);
  v = yield* get();
  yield* set(v + 1);
  return `Count is ${yield* get()}`;
});
```

(if you're wondering why you have to use a weird star or how generators can do all this stuff, check out the Implementation Details section below)

#### Defining Handlers

Now we have effects and we have tasks that use those effects however, there is no way to actually run the task we've made! In order to do this we have to define handlers. Handlers give meaning to effects. Without handlers effects are just a contract but with handlers effects can have actual _effects_. Here's an example of a set of handlers for get and set

```ts
const handleState = (s: number): Handlers<Set | Get> => ({
  get: (k) => k(s),
  set: (k, val) => k(undefined, handleState(val)),
  return: (v) => v,
});
```

The handlers specify what to do with each type of effect and also what to do with pure values (this is what the `return` handler does). The handler functions are passed a continuation that can be used to resume from the effect with the specified result. Additionally, if the effect has any parameters those are also passed to the handler. The result of the handler becomes the result of the entire task, usually the handler will call the continuation and use it's result however, it doesn't have to. In this case both of the handlers do call the continuation. The continuation takes a value to resume with (this is the result of the effect) and optionally a new handler to replace the existing on with. If a new handler isn't given the existing handler is used. For example in the `get` handler the continuation is resumed with whatever that current state value is and the handler is left unchange. However, in the `set` handler the existing handler is replaced with a new one with the new state value. The `return` handler handles pure values, in this case we just return them as is.

It's also possible to call the continuation multiple times as shown below.

```ts
const handleChoose = (): Handlers<Choose<unknown>> => ({
  choose: (k, options) => {
    return options.flatMap((option) => k(option));
  },
  return: (v) => [v],
});
```

This is a handler that simulates non-determinism by resuming with all the possible options and then appending the results together. This handler also has a special case for `return`. Because we are appending the results together the result must be an array to ensure this the `return` handler wraps the returned value in a singleton array.

#### Putting it all Together

Now that we have handlers for our effects we can actually run the task we made. To do this use `run(task, handlers)` with a task and a set of handlers for it

```ts
import { runTask } from "Effect";
const result = runTask(doTask, handleState(0));
result = 3;

const result2 = runTask(chainTask, handleState(2));
result2 = 5;
```

Voila!

Unfortunately, there's one big issue with `runTask`. It requires that you give it a handler that can handle all the effects from the task you gave it. This means that you can't compose smaller handlers, you need one big handle that handles everything. Fortunately there is a solution. `handle(task, handle)` allows you to handle some but not all of the effects of a task. For example if `task$` has type `Task<Get<number> | Choose<String>, number>` then `handle(task$, handleState())` would result in a task of type `Task<Choose<String>, number>` and `handle(handle(task$, handleState()), handleChoose())` would result in a task of type `Task<never, number>` (meaning it has no effects). When you have a task with effects you can use `run(task)` to run it. This allows you to compose smaller handlers. The order of the composition matters, for examples of this look at the tests in the tests folder. There are couple of differences between full handlers and partial handlers. The first is that instead of their type being `Handlers<Effects>` it is `PartialHandlers<Effects, Input, Output>`. This is because partial handlers can change the type of the result using the `return` handler. For example, the handler for choose above would be

```ts
//NOTE: There are still other changes that need to be made for this to be valid
const handleChoose = (): PartialHandlers<Choose<unknown>, T, T[]> => ({
  choose: (k, options) => {
    return options.flatMap((option) => k(option));
  },
  return: (v) => [v],
});
```

As you can see from the type this changes an input of `T` to `T[]`. This is important since the next handler will be dealing with `T[]` instead of `T`. In general partial handlers should be polymorphic over their input type (like this one is).

There is also another difference when dealing with partial handlers. Since there are other unknown effects, the continuation passed to the handler returns a task rather than a value. This means that in order to access the values in it you need to use `bind`, `chain`, or do-notation. The example above should actually be.

```ts
const handleChoose = <T>(): PartialHandlers<Choose<unknown>, T, T[]> => ({
  choose: (k, options) => {
    return taskDo(function* () {
      const res = [];
      for (const option of options) {
        res.push(yield* w(k(option)));
      }
      return res.flat();
    });
  },
  return: (v) => [v],
});
```

## Implementation Details

### Tasks

Taks are implemented using the Freer Monad as described by Oleg Kiseylov ([source])(https://okmij.org/ftp/Computation/free-monad.html). This is what it looks like in Haskell

```hs
data FFree g a where
       FPure   :: a -> FFree g a
       FImpure :: g x -> (x -> FFree g a) -> FFree g a
```

and here is the equivalent version in TypeScript (it's a bit more complicated but it's basically equivalent)

```ts
type FFree<F extends HKTTag, A, ParamTypes extends any[] = [], X = any> =
  | { tag: "FPure"; 
      val: A; 
      [HIDDEN_TYPE_TAG]: F }
  | {
      tag: "FImpure";
      val: Apply<F, X, ParamTypes>;
      k: (a: X) => FFree<F, A, ParamTypes>;
      [HIDDEN_TYPE_TAG]: F;
    };
```

The Free-er Monad has two constructors. FPure which holds Pure values, and FImpure which stores an impure value container (in our case this is an effect) and a continuation that represents what to do with that effect. When you run a task whenever it encounters a FImpure it tags the effect in it, looks at it's name to find the right handler. When the handler calls the continuation that value is passed to the contination FImpure and the result is handled in the same way. This continues until and FPure is reached. This represents the end of the task. This value is passed to the `return` handler to get the final result.

### Do-Notation

#### How generators

Note: For a much more in depth explanation check out the paper [Yield: Mainstream Delimited Continuations](http://parametricity.net/dropbox/yield.subc.pdf) which was the inspiration for all of this

Generators are a JavaScript feature that are designed to represent a lazy stream of values. When you call `.next()` on a generator it runs the generator until it reaches a `yield` statement, returns the yielded value and pauses the generator until next is called again. If this was all generators could do then they wouldn't be very useful to us. However, in addition to getting values out of generator you can also pass values back into a generator. If you do `.next("foo")` then the value "foo" will be passsed back into the generator at the point where yield was called. For example:

```ts
const gen = function* () {
  let four = yield 2
  //  yield replaced with the value passed to next (in this case 4) thus,
  //  four = 4
  //  as it should!
  return four + 5
}

const instance = gen()

let val = instance.next()
let result = instance.next(val * 2)
//  result = 9
```

You can think of `yield` as suspending a function at a point in time and `.next()` as _continuing_ it with a specific value. For those of you familiar with CPS this should set off alarm bells. Basically `yield` allows you to create a continuation at any point in (generator) function. We can use these continuation to serve as the second part of `bind` by creating a function that wraps `.next()`. This is the basis behind the do-notation.

There is however one issue, calling `.next()` on a generator permanently mutates it. Once you've called `.next()` calling `.next()` again will instead refer to the next `yield` statement. This means that the continuations from this are single-shot, which is not sufficient for our use case.

Fortunately, there is a solution. If you store the values that are passed into the generator you can "replay" the generator up to a specific point in time by calling `.next()` with the stored values. This allows you to resume a generator from the same point multiple times. Fortunately there's a library that implements this called [immutagen](https://github.com/pelotom/immutagen). The creator of this library also created another library based on it called [burrido](https://github.com/pelotom/burrido) which uses generators for do-notation in JavaScript which was the inspiration for my implementation here.

#### Why do I need `yield*` and `w` ?

This is due to the limitations of how TypeScript handles generators. The type for generators in TypeScript is `Generator<YieldType, ResumeType, ReturnType>` where `YieldType` is the type of things it yields, `ResumeType` is the type that `yield` statements are resumed with and `ReturnType` is the final return type. This means that every `yield` must be resumed with the same type which poses a problem when dealing with effects with different return types. Fortunately, there is a solution `yield*` takes another generator yields through all it's values and returns it's final result. Here's an example of it in action:

```ts
const stringGen: Generator<..., ..., string> = ...
let str = yield* stringGen
//  ^string
const numberGen: Generator<..., ..., number> = ...
let num = yield* numberGen
//  ^number
```

as you can see this solves the problem of differing yield types. The job of `w` is to convert a `Task<E, T>` to a `Generator<E, ..., T>` which is actually a very simple process. Combining these two allows for full type inference with effects.
## Benefits of working with TypeScript

There are a couple of TypeScript features that made implementing this in TypeScript easier than the Haskell implementation. 

The biggest is open unions. In Haskell once you've declared a union there's no way to expand it. In TypeScript you can easily create a new union with elements from an old one and new elements. Example:

```ts
type Pets = Dog | Cat
type EvenMorePets = Pets | Sloth | Lemur 
```
This makes it much easier to implement the effect list for tasks.

## Future Steps/Open Issues

### Partial Handler Type Inference
As I mentioned above, partial handler need to specify their input and ouput type and they should be polymorphic on their input type. This means that using a partial handler you have to specify the type of the input which is tedious. I think there's probably a way to infer the type or otherwise get around this limitation but I haven't yet been able to figure it out 

### Partial Handler handlers
The other problem with partial handlers is that the results of the continuation are tasks rather than normal values. This means you have to use `bind` and do notation to work with them. This is annoying but it isn't a major issue. The bigger issue is that since they are monadic values they don't play nice with things like promises. There is definitely more expirimentation to be done here and I think it's the biggest rough edge with the current implementation.

### Proper Do notation for JavaScript
Generators and and `yield` can do a convincing impression of do notation. However there are some rough edges. For one, having to wrap everthing in `taskDo(function* () { ... })` and `yield *` is tedious. But this mostly a syntax issue. The bigger problem is that `yield*` can only be used inside a generator function, it can't be used in a callback. This is why the code for `handleChoose` above has to use a loop rather than `flatMap` which would be much cleaner.

```ts
//Note: this doesn't work
const handleChoose = <T>(): PartialHandlers<Choose<unknown>, T, T[]> => ({
  choose: (k, options) => {
    return taskDo(function* () {
      return options.flatMap((option) => {
        return yield* w(k(option)) //syntax error here
      })
    });
  },
  return: (v) => [v],
});
```

## Bonus: Lying About Types for Fun and Profit
