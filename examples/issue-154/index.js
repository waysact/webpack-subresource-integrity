import "./style.css";

window.addEventListener("DOMContentLoaded", () => {
  console.log(
    getComputedStyle(document.body).background.match(/rgb\(255, 0, 0\)/)
      ? "ok"
      : "error"
  );
});
