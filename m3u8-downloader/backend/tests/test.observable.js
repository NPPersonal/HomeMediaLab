import { Observable } from "object-observer";

const tasks = {
  queued: [{ name: "aaa", states: ["init", "start"] }],
  completed: [{ name: "bbb" }],
  canceled: [{ name: "ccc" }],
};

const observableTasks = Observable.from(tasks);

const makeCallback = (name) => {
  return (changes) => {
    changes.forEach((change) => {
      console.log(`in ${name}`, change);
    });
  };
};

Observable.observe(observableTasks.queued, makeCallback("queued"), {
  pathsOf: "",
});

Observable.observe(observableTasks.completed, makeCallback("completed"), {
  pathsOf: "",
});

Observable.observe(observableTasks.canceled, makeCallback("canceled"), {
  pathsOf: "",
});

// observableTasks.queued.push({ name: "4rrr4", states: ["init", "start"] });
// observableTasks.queued.unshift({ name: "4rrr4", states: ["init", "start"] });
// observableTasks.queued.splice(0, 1);
// observableTasks.queued.splice(0, 1, {
//   name: "4rrr4",
//   states: ["init", "start"],
// });
// observableTasks.queued[0].states.push("see");

// console.log(Object.keys(observableTasks));
