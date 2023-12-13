import { Effect, TypedEffTask, taskDo, typedTaskDo } from "../src/Effect";
import { stateAnchor, endStateAnchor, h, useState, JSF } from "./Impulse";

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

// const render = <E extends Effect<any, any, any>>(j: JSF<E>): TypedEffTask<E, HTMLElement> => {
//   return typedTaskDo(function* () {
//     if (typeof j === "string") return document.createTextNode(j);
//     if (typeof j === "number") return document.createTextNode(j.toString());

//     const { tag, props, children } = j;
//     const el = document.createElement(tag);

//     for (const [k, v] of Object.entries(props)) {
//       if (k.startsWith("on")) {
//         const eventName = k.slice(2).toLowerCase();
//         el.addEventListener(eventName, () => yield* v());
//       } else {
//         el.setAttribute(k, v);
//       }
//     }

//     for (const child of children) {
//       el.appendChild(yield* render(child));
//     }

//     return el;
//   });
// }
// console.log("test");
