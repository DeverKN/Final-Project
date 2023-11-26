var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/immutagen/immutagen.js
var require_immutagen = __commonJS((exports, module) => {
  (function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = f();
    } else if (typeof define === "function" && define.amd) {
      define([], f);
    } else {
      var g;
      if (typeof window !== "undefined") {
        g = window;
      } else if (typeof global !== "undefined") {
        g = global;
      } else if (typeof self !== "undefined") {
        g = self;
      } else {
        g = this;
      }
      g.immutagen = f();
    }
  })(function() {
    var define2, module2, exports2;
    return function() {
      function r(e, n, t) {
        function o(i2, f) {
          if (!n[i2]) {
            if (!e[i2]) {
              var c = typeof require == "function" && require;
              if (!f && c)
                return c(i2, true);
              if (u)
                return u(i2, true);
              var a = new Error("Cannot find module '" + i2 + "'");
              throw a.code = "MODULE_NOT_FOUND", a;
            }
            var p = n[i2] = { exports: {} };
            e[i2][0].call(p.exports, function(r2) {
              var n2 = e[i2][1][r2];
              return o(n2 || r2);
            }, p, p.exports, r, e, n, t);
          }
          return n[i2].exports;
        }
        for (var u = typeof require == "function" && require, i = 0;i < t.length; i++)
          o(t[i]);
        return o;
      }
      return r;
    }()({ 1: [function(require2, module3, exports3) {
      Object.defineProperty(exports3, "__esModule", {
        value: true
      });
      exports3.immutagen = exports3["default"] = undefined;
      var next = function next(regen) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1;_key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        return function(data) {
          var gen = regen.apply(undefined, args);
          return gen.next(data), gen;
        };
      };
      var immutagen = function immutagen(regen) {
        return function() {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0;_key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          return function loop(regen2) {
            return function(gen, data) {
              var _gen$next = gen.next(data), value = _gen$next.value, done = _gen$next.done;
              if (done)
                return {
                  value,
                  next: null,
                  mutable: gen
                };
              var replay = false;
              var recur = loop(next(regen2, data));
              var mutable = function mutable() {
                return replay ? regen2(data) : replay = gen;
              };
              var result = {
                value,
                next: function next(value2) {
                  return recur(mutable(), value2);
                }
              };
              return Object.defineProperty(result, "mutable", {
                get: mutable
              });
            };
          }(next.apply(undefined, [regen].concat(args)))(regen.apply(undefined, args));
        };
      };
      exports3.immutagen = exports3["default"] = immutagen;
    }, {}] }, {}, [1])(1);
  });
});

// Effect.ts
var import_immutagen = __toESM(require_immutagen(), 1);
var HIDDEN_TYPE_TAG = Symbol("HIDDEN_TYPE_TAG");
var FPure = (val) => {
  return { tag: "FPure", val, [HIDDEN_TYPE_TAG]: undefined };
};
var FImpure = (val, k) => {
  return { tag: "FImpure", val, k, [HIDDEN_TYPE_TAG]: undefined };
};
var kleisli = (f, g) => {
  return (a) => bind(f(a), g);
};
var bind = (m, k) => {
  switch (m.tag) {
    case "FPure":
      return k(m.val);
    case "FImpure": {
      const k$ = m.k;
      return FImpure(m.val, kleisli(k$, k));
    }
  }
};
var etaF = (fa) => {
  return FImpure(fa, FPure);
};
var runTask = (task, handlers) => {
  switch (task.tag) {
    case "FPure":
      return handlers.return(task.val);
    case "FImpure": {
      const k = (v) => {
        const [x, handlers$] = v;
        const newHandlers = { ...handlers, ...handlers$ };
        return runTask(task.k(x), newHandlers);
      };
      return handlers[task.val.tag](k, ...task.val.val);
    }
  }
};
var taskDo = (gen) => {
  const immut = import_immutagen.immutagen(gen);
  const { value, next } = immut();
  if (!next) {
    return FPure(value);
  } else {
    return bind(value, taskDoHelper(next));
  }
};
var typedTaskDo = (gen) => {
  return w(taskDo(gen));
};
var taskDoHelper = (iter) => {
  return (val = undefined) => {
    const { value, next } = iter(val);
    if (!next) {
      return FPure(value);
    } else {
      return bind(value, taskDoHelper(next));
    }
  };
};
var wrapEff = (t) => {
  return function* () {
    const val = yield t;
    return val;
  }();
};
var handle = (task, handlers) => {
  switch (task.tag) {
    case "FPure":
      return FPure(handlers.return(task.val));
    case "FImpure": {
      const k = (v) => {
        const [x, handlers$] = v;
        const newHandlers = { ...handlers, ...handlers$ };
        return handle(task.k(x), newHandlers);
      };
      if (task.val.tag in handlers) {
        return handlers[task.val.tag](k, ...task.val.val);
      } else {
        const k$ = (v) => {
          return handle(task.k(v), handlers);
        };
        return FImpure(task.val, k$);
      }
    }
  }
};
var typedEff = (tag) => {
  const e = (...v) => w(etaF({ tag, val: v, resume: null }));
  return e;
};
var w = wrapEff;

// Observable.ts
class Observable {
  data;
  observers = [];
  constructor(data) {
    this.data = data;
  }
  subscribe(observer) {
    this.observers.push(observer);
    observer.update(this.data);
  }
  update(data) {
    this.data = data;
    this.observers.forEach((o) => o.update(data));
  }
}
var forwardObservable = (o1, o2) => {
  o1.subscribe({
    update: (data) => o2.update(data)
  });
  return o1;
};

// Impulse.ts
var ref = (v) => typedEff("ref")(v);
var setRef = (token, v) => typedEff("setRef")(token, v);
var getRef = (token) => typedEff("getRef")(token);
var stateAnchor = () => typedEff("stateAnchor")();
var endStateAnchor = () => typedEff("endStateAnchor")();
var start = typedEff("start");
var end = typedEff("end");
var timeout = typedEff("timeout");
var doInterval = (t, interval = 1000) => typedTaskDo(function* () {
  let b = yield* timeout(interval);
  if (b)
    yield* t;
});
var handleRef = (s, k$ = null, rerun = false, oldCache = null, newCache = []) => ({
  ref: (k, v) => {
    if (oldCache) {
      const token = oldCache.pop();
      return k([
        token,
        handleRef(s, k$, rerun, oldCache, [token, ...newCache])
      ]);
    } else {
      const token = Symbol();
      return k([
        token,
        handleRef({ ...s, [token]: v }, k$, rerun, oldCache, [
          token,
          ...newCache
        ])
      ]);
    }
  },
  getRef: (k, token) => {
    return k([s[token], handleRef(s, k$, rerun, oldCache, newCache)]);
  },
  setRef: (k, token, v) => {
    return k([
      undefined,
      handleRef({ ...s, [token]: v }, k$, true, oldCache, newCache)
    ]);
  },
  stateAnchor: (k) => {
    return k([undefined, handleRef(s, k, false, oldCache, newCache)]);
  },
  endStateAnchor: (k) => {
    if (rerun) {
      return k$([undefined, handleRef(s, k$, false, newCache, [])]);
    } else {
      return k([undefined, handleRef(s, k$, false, oldCache, newCache)]);
    }
  },
  return: (v) => v
});
var useState = (defaultVal) => {
  return typedTaskDo(function* () {
    const token = yield* ref(defaultVal);
    const val = yield* getRef(token);
    const set = (val2) => {
      if (typeof val2 === "function") {
        return typedTaskDo(function* () {
          const oldVal = yield* getRef(token);
          const newVal = val2(oldVal);
          yield* setRef(token, newVal);
        });
      } else {
        return setRef(token, val2);
      }
    };
    const result = [val, set];
    return result;
  });
};
var h = (tag, props, children) => {
  return {
    tag,
    props,
    children
  };
};
var counter = taskDo(function* () {
  yield* stateAnchor();
  const [count, setCount] = yield* useState(0);
  yield* endStateAnchor();
  return h("div", {}, [
    h("button", { onClick: () => setCount(count + 1) }, ["+"]),
    `count is ${count}`,
    h("button", { onClick: () => setCount(count + 1) }, ["-"])
  ]);
});
var test = taskDo(function* () {
  yield* stateAnchor();
  const [count, setCount] = yield* useState(0);
  yield* doInterval(typedTaskDo(function* () {
    yield* setCount(count + 1);
  }));
  yield* endStateAnchor();
  return `count: ${count}`;
});
var runTimeout = (t) => {
  const handle2 = {
    timeout: (k, interval) => {
      const obs = k([false, handle2]);
      setTimeout(() => {
        forwardObservable(k([true, handle2]), obs);
      }, interval);
      return obs;
    },
    return: (v) => new Observable(v)
  };
  return runTask(t, handle2);
};
runTimeout(handle(test, handleRef({}))).subscribe({
  update: (data) => console.log(data)
});

// index.ts
var counter2 = taskDo(function* () {
  yield* stateAnchor();
  const [count, setCount] = yield* useState(0);
  yield* endStateAnchor();
  return h("div", {}, [
    h("button", { onClick: () => setCount(count + 1) }, ["+"]),
    `count is ${count}`,
    h("button", { onClick: () => setCount(count + 1) }, ["-"])
  ]);
});
console.log("test");
