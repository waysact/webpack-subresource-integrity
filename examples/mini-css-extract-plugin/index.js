import("./style.module.css").then((module) => {
  console.log(module["default"] ? "ok" : "error");
});
