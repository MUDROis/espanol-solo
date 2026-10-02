/* Curso de español B1 — прогресс обучения (localStorage, без зависимостей) */
(function () {
  "use strict";

  var KEY_PREFIX = "a1-";

  function storeGet(key) {
    try { return window.localStorage.getItem(KEY_PREFIX + key) === "1"; }
    catch (e) { return false; }
  }
  function storeSet(key, on) {
    try {
      if (on) { window.localStorage.setItem(KEY_PREFIX + key, "1"); }
      else { window.localStorage.removeItem(KEY_PREFIX + key); }
    } catch (e) { /* приватный режим — прогресс просто не сохранится */ }
  }
  function storeClearAll() {
    try {
      var doomed = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(KEY_PREFIX) === 0) { doomed.push(k); }
      }
      doomed.forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { }
  }

  /* Чек-боксы с сохранением состояния (чек-листы уроков, юнитов, CEFR) */
  function bindPersistentChecks() {
    var boxes = document.querySelectorAll("input[data-check]");
    for (var i = 0; i < boxes.length; i++) {
      (function (input) {
        var key = "check-" + input.getAttribute("data-check");
        input.checked = storeGet(key);
        input.addEventListener("change", function () {
          storeSet(key, input.checked);
        });
      })(boxes[i]);
    }
  }

  /* Страница урока */
  function initLessonPage() {
    var code = document.body.getAttribute("data-lesson");
    if (!code) { return; }
    var toggle = document.querySelector(".done-toggle");
    var cb = document.getElementById("done");
    if (!cb || !toggle) { return; }
    var key = "lesson-" + code;
    function sync() {
      var done = storeGet(key);
      cb.checked = done;
      toggle.classList.toggle("is-done", done);
    }
    sync();
    cb.addEventListener("change", function () {
      storeSet(key, cb.checked);
      sync();
    });
  }

  /* Главная страница: прогресс по юнитам и общий */
  function initIndexPage() {
    var data = window.LESSONS;
    if (!data || !data.length) { return; }

    var doneCount = 0;
    data.forEach(function (l) {
      if (storeGet("lesson-" + l.code)) { doneCount++; }
    });

    /* Общий прогресс */
    var fill = document.querySelector(".overall-progress .bar i");
    var label = document.querySelector(".progress-label");
    var pct = Math.round(doneCount / data.length * 100);
    if (fill) { fill.style.width = pct + "%"; }
    if (label) {
      label.textContent = "Пройдено " + doneCount + " из " + data.length + " уроков (" + pct + "%)";
    }

    /* Отметки у уроков */
    var links = document.querySelectorAll("a[data-lesson-link]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var code = a.getAttribute("data-lesson-link");
      if (storeGet("lesson-" + code)) { a.classList.add("done"); }
    }

    /* Прогресс по юнитам */
    var perUnit = {};
    var totalUnit = {};
    data.forEach(function (l) {
      totalUnit[l.unit] = (totalUnit[l.unit] || 0) + 1;
      if (storeGet("lesson-" + l.code)) { perUnit[l.unit] = (perUnit[l.unit] || 0) + 1; }
    });
    var unitEls = document.querySelectorAll("[data-unit-progress]");
    for (var j = 0; j < unitEls.length; j++) {
      var el = unitEls[j];
      var u = el.getAttribute("data-unit-progress");
      var d = perUnit[u] || 0;
      var t = totalUnit[u] || 0;
      var bar = el.querySelector(".bar i");
      var span = el.querySelector(".up-count");
      if (bar) { bar.style.width = (t ? Math.round(d / t * 100) : 0) + "%"; }
      if (span) { span.textContent = d + "/" + t; }
    }

    /* Сброс прогресса */
    var reset = document.getElementById("reset-progress");
    if (reset) {
      reset.addEventListener("click", function () {
        if (window.confirm("Сбросить весь прогресс курса (уроки и чек-листы)?")) {
          storeClearAll();
          window.location.reload();
        }
      });
    }
  }

  /* Тумблер «Перевод»: показывает русские переводы примеров, текстов и вопросов */
  function initTrToggle() {
    var cb = document.getElementById("tr-switch");
    if (!cb) { return; }
    var on = storeGet("tr-on");
    cb.checked = on;
    document.body.classList.toggle("show-tr", on);
    cb.addEventListener("change", function () {
      storeSet("tr-on", cb.checked);
      document.body.classList.toggle("show-tr", cb.checked);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindPersistentChecks();
    initTrToggle();
    var page = document.body.getAttribute("data-page");
    if (page === "lesson") { initLessonPage(); }
    if (page === "index") { initIndexPage(); }
  });
})();
