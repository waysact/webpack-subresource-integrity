import "./style.css";

window.addEventListener("load", () => {
  console.log(
    getComputedStyle(document.body).background.match(/rgb\(255, 0, 0\)/)
      ? "ok"
      : "error"
  );
});
