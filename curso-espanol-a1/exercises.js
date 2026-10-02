/* ============================================================
   ejercicios.js — интерактивные задания с автопроверкой + TTS
   Curso de español A1. Без внешних зависимостей.
   Типы: match, gap, mc, select, order, tf, category
   Плюс: озвучка слов (data-speak), диалог «Реальная ситуация»,
   плеер алфавита (A1).
   ============================================================ */
(function () {
  "use strict";

  var KEY_PREFIX = "a1-ex-";

  /* ---------- подсветка испанских вставок (как hl() в генераторе) ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function hl(s) {
    var t = esc(s), stash = [];
    t = t.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m) { stash.push(m); return "\u0001" + (stash.length - 1) + "\u0001"; });
    t = t.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡][A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡'’\-+]*/g, function (w) { return '<span class="es">' + w + "</span>"; });
    t = t.replace(/\u0001(\d+)\u0001/g, function (_, i) { return stash[+i]; });
    return t;
  }

  /* ---------- нормализация ответов ---------- */
  function norm(s) {
    return String(s).toLowerCase().trim()
      .replace(/[¿¡.!?;:,]+/g, "")
      .replace(/\s+/g, " ");
  }
  function normAcc(s) {
    return norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function eqAns(input, accepted) {
    var arr = Array.isArray(accepted) ? accepted : [accepted];
    for (var i = 0; i < arr.length; i++) {
      if (norm(input) === norm(arr[i])) return { ok: true, accent: false };
      if (normAcc(input) === normAcc(arr[i]) && norm(input) !== "") return { ok: true, accent: true };
    }
    return { ok: false, accent: false };
  }

  function trP(txt) { return txt ? el("p", "ex-item-tr tr", esc(txt)) : null; }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function store(k, v) { try { window.localStorage.setItem(KEY_PREFIX + k, v); } catch (e) {} }
  function load(k) { try { return window.localStorage.getItem(KEY_PREFIX + k); } catch (e) { return null; } }

  /* ---------- каркас задания ---------- */
  var TYPE_RU = {
    match: "соедините пары", gap: "впишите", mc: "выберите вариант",
    select: "выберите из списка", order: "соберите фразу",
    tf: "верно / неверно", category: "распределите по группам"
  };

  function Ex(root, cfg, idx, total) {
    this.root = root;
    this.cfg = cfg;
    this.id = root.id.replace(/^ex-/, "");
    this.best = parseInt(load(this.id) || "0", 10) || 0;
    this.checkedOnce = false;
    this.render();
  }

  Ex.prototype.render = function () {
    var self = this;
    var root = this.root;
    root.innerHTML = "";
    var head = el("div", "ex-head");
    head.appendChild(el("span", "ex-type", TYPE_RU[this.cfg.type] || ""));
    head.appendChild(el("span", "ex-title", hl(this.cfg.title || "")));
    var best = el("span", "ex-best", this.best ? "лучший результат: " + this.best + "%" : "");
    head.appendChild(best);
    root.appendChild(head);

    this.body = el("div", "ex-body");
    root.appendChild(this.body);

    var foot = el("div", "ex-foot");
    this.result = el("span", "ex-result", "");
    foot.appendChild(this.result);
    this.actions = el("div", "ex-actions");
    foot.appendChild(this.actions);
    root.appendChild(foot);

    this["render_" + this.cfg.type]();

    if (this.cfg.type !== "match") {
      /* кнопка проверки для всех типов, кроме match (он самопроверяемый) */
      var checkBtn = el("button", "btn-ex", "Comprobar · Проверить");
      checkBtn.type = "button";
      checkBtn.addEventListener("click", function () { self.check(); });
      this.actions.appendChild(checkBtn);
      this.checkBtn = checkBtn;
    }
    var retryBtn = el("button", "btn-ex btn-ghost", "Reintentar · Заново");
    retryBtn.type = "button";
    retryBtn.addEventListener("click", function () { self.retry(); });
    this.actions.appendChild(retryBtn);
  };

  Ex.prototype.check = function () {
    this["check_" + this.cfg.type]();
  };

  Ex.prototype.markBest = function (pct) {
    if (pct > this.best) { this.best = pct; store(this.id, String(pct)); }
    var b = this.root.querySelector(".ex-best");
    if (b) b.textContent = this.best ? "лучший результат: " + this.best + "%" : "";
    if (typeof window.__b1exProgress === "function") window.__b1exProgress();
  };

  Ex.prototype.finish = function (okCount, total, extra) {
    var pct = Math.round(okCount / total * 100);
    var msg;
    if (pct === 100) msg = "¡Perfecto! Всё верно — " + okCount + "/" + total + ".";
    else if (pct >= 70) msg = "¡Muy bien! " + okCount + "/" + total + " — почти идеально, исправьте ошибки.";
    else msg = okCount + "/" + total + " — исправьте выделенное и проверьте снова.";
    if (extra) msg += " " + extra;
    this.result.innerHTML = '<b class="' + (pct === 100 ? "r-ok" : pct >= 70 ? "r-mid" : "r-bad") + '">' + msg + "</b>";
    this.markBest(pct);
    this.checkedOnce = true;
  };

  Ex.prototype.clearMarks = function () {
    Array.prototype.forEach.call(this.root.querySelectorAll(".ok,.bad,.accent-warn,.locked,.revealed"), function (e) {
      e.classList.remove("ok", "bad", "accent-warn", "locked", "revealed");
    });
  };

  Ex.prototype.retry = function () {
    this.result.innerHTML = "";
    this.clearMarks();
    this["reset_" + this.cfg.type]();
  };

  /* ================= MATCH ================= */
  Ex.prototype.render_match = function () {
    var self = this;
    var cfg = this.cfg;
    this.left = [];
    this.right = [];
    this.pickedLeft = null;
    this.matched = 0;
    this.totalPairs = cfg.pairs.length;

    var wrap = el("div", "match-wrap");
    var colA = el("div", "match-col"), colB = el("div", "match-col");
    var itemsA = cfg.pairs.map(function (p, i) { return { t: p[0], i: i }; });
    var itemsB = cfg.pairs.map(function (p, i) { return { t: p[1], i: i }; });
    shuffle(itemsB);

    itemsA.forEach(function (it) {
      var d = el("button", "match-item", '<span lang="es">' + esc(it.t) + "</span>");
      d.type = "button";
      d.dataset.idx = it.i;
      d.addEventListener("click", function () { self.pickMatch(d, colA); });
      colA.appendChild(d);
      self.left.push(d);
    });
    itemsB.forEach(function (it) {
      var d = el("button", "match-item", "<span>" + esc(it.t) + "</span>");
      d.type = "button";
      d.dataset.idx = it.i;
      d.addEventListener("click", function () { self.pickMatch(d, colB); });
      colB.appendChild(d);
      self.right.push(d);
    });
    wrap.appendChild(colA); wrap.appendChild(colB);
    this.body.appendChild(wrap);
    this.matchColA = colA; this.matchColB = colB;
  };
  Ex.prototype.pickMatch = function (btn, col) {
    if (btn.classList.contains("locked")) return;
    var sideClass = col === this.matchColA ? "picked-a" : "picked-b";
    var other = col === this.matchColA ? "picked-b" : "picked-a";
    if (btn.classList.contains(other)) { btn.classList.remove(other); return; }
    Array.prototype.forEach.call(col.querySelectorAll("." + sideClass), function (b) { b.classList.remove(sideClass); });
    btn.classList.add(sideClass);
    var a = this.matchColA.querySelector(".picked-a"), b = this.matchColB.querySelector(".picked-b");
    if (!a || !b) return;
    a.classList.remove("picked-a"); b.classList.remove("picked-b");
    if (a.dataset.idx === b.dataset.idx) {
      a.classList.add("locked", "ok"); b.classList.add("locked", "ok");
      this.matched++;
      if (this.matched === this.totalPairs) { this.result.innerHTML = '<b class="r-ok">¡Perfecto! Все пары найдены — ' + this.totalPairs + "/" + this.totalPairs + ".</b>"; this.markBest(100); }
    } else {
      a.classList.add("bad"); b.classList.add("bad");
      setTimeout(function () { a.classList.remove("bad"); b.classList.remove("bad"); }, 700);
    }
  };
  Ex.prototype.reset_match = function () {
    var self = this;
    this.matched = 0;
    this.left.concat(this.right).forEach(function (b) { b.classList.remove("locked", "ok", "bad"); });
  };

  /* ================= GAP ================= */
  Ex.prototype.render_gap = function () {
    var self = this;
    this.inputs = [];
    var list = el("div", "gap-list");
    this.cfg.items.forEach(function (it, i) {
      var row = el("div", "ex-item");
      var parts = String(it.s).split("___");
      var line = el("p", "gap-sentence", '<span class="num-i">' + (i + 1) + "</span> " + hl(parts[0] || ""));
      var input = document.createElement("input");
      input.type = "text";
      input.className = "gap-input";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      if (it.hint) input.placeholder = it.hint;
      input.dataset.i = i;
      line.appendChild(input);
      if (parts[1]) line.appendChild(document.createTextNode(" ")); 
      if (parts[1]) { var tail = el("span", null, hl(parts[1])); line.appendChild(tail); }
      row.appendChild(line);
      var _tr = trP(it.tr); if (_tr) row.appendChild(_tr);
      list.appendChild(row);
      self.inputs.push(input);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); self.check(); }
      });
    });
    this.body.appendChild(list);
  };
  Ex.prototype.check_gap = function () {
    var ok = 0, acc = 0;
    var self = this;
    this.cfg.items.forEach(function (it, i) {
      var row = self.inputs[i].closest(".ex-item");
      row.classList.remove("ok", "bad", "accent-warn");
      var res = eqAns(self.inputs[i].value, it.a);
      if (res.ok) { ok++; row.classList.add("ok"); if (res.accent) { acc++; row.classList.add("accent-warn"); } }
      else row.classList.add("bad");
    });
    var extra = acc ? "Проверьте ударения (tildes) в отмеченных ответах." : "";
    this.finish(ok, this.cfg.items.length, extra);
  };
  Ex.prototype.reset_gap = function () {
    var self = this;
    this.inputs.forEach(function (inp) { inp.value = ""; inp.closest(".ex-item").classList.remove("ok", "bad", "accent-warn", "revealed"); });
  };
  Ex.prototype.reveal_gap = function () {
    var self = this;
    this.cfg.items.forEach(function (it, i) {
      var row = self.inputs[i].closest(".ex-item");
      row.classList.add("revealed");
      self.inputs[i].value = Array.isArray(it.a) ? it.a[0] : it.a;
    });
  };

  /* ================= MC ================= */
  Ex.prototype.render_mc = function () {
    var self = this;
    this.mcs = [];
    var list = el("div", "mc-list");
    this.cfg.items.forEach(function (it, i) {
      var row = el("div", "ex-item mc-item");
      var q = el("p", "ex-q", '<span class="num-i">' + (i + 1) + "</span> " + hl(it.q));
      row.appendChild(q);
      var opts = el("div", "mc-opts");
      it.opts.forEach(function (o, oi) {
        var lab = el("label", "mc-opt");
        var inp = document.createElement("input");
        inp.type = "radio";
        inp.name = self.id + "-mc-" + i;
        inp.value = oi;
        lab.appendChild(inp);
        var span = el("span", "opt-text", '<span lang="es">' + esc(o) + "</span>");
        lab.appendChild(span);
        if (it.ot && it.ot[oi]) lab.appendChild(el("span", "opt-tr tr", esc(it.ot[oi])));
        opts.appendChild(lab);
      });
      row.appendChild(opts);
      var _tr = trP(it.tr); if (_tr) row.appendChild(_tr);
      var expl = el("p", "ex-explain", (it.ex ? hl(it.ex) : "") + (it.exTr ? '<span class="tr">' + esc(it.exTr) + "</span>" : ""));
      row.appendChild(expl);
      list.appendChild(row);
      self.mcs.push({ row: row, opts: opts, it: it });
    });
    this.body.appendChild(list);
  };
  Ex.prototype.check_mc = function () {
    var ok = 0;
    this.mcs.forEach(function (m) {
      var sel = m.opts.querySelector("input:checked");
      m.row.classList.remove("ok", "bad");
      m.row.classList.remove("show-explain");
      var val = sel ? parseInt(sel.value, 10) : -1;
      if (val === m.it.a) { ok++; m.row.classList.add("ok"); }
      else m.row.classList.add("bad");
      if (m.it.ex && val !== m.it.a) m.row.classList.add("show-explain");
    });
    this.finish(ok, this.mcs.length);
  };
  Ex.prototype.reset_mc = function () {
    this.mcs.forEach(function (m) {
      var sel = m.opts.querySelector("input:checked");
      if (sel) sel.checked = false;
      m.row.classList.remove("ok", "bad", "show-explain", "revealed");
    });
  };
  Ex.prototype.reveal_mc = function () {
    this.mcs.forEach(function (m) {
      m.row.classList.add("revealed", "show-explain");
      var inputs = m.opts.querySelectorAll("input");
      Array.prototype.forEach.call(inputs, function (inp, i) {
        inp.checked = (i === m.it.a);
      });
    });
  };

  /* ================= SELECT ================= */
  Ex.prototype.render_select = function () {
    var self = this;
    this.sels = [];
    var list = el("div", "sel-list");
    this.cfg.items.forEach(function (it, i) {
      var row = el("div", "ex-item");
      var parts = String(it.s).split("___");
      var line = el("p", "sel-sentence", '<span class="num-i">' + (i + 1) + "</span> " + hl(parts[0] || ""));
      var sel = document.createElement("select");
      sel.className = "sel-input";
      sel.appendChild(new Option("—", "-1"));
      it.opts.forEach(function (o, oi) { sel.appendChild(new Option(o, oi)); });
      sel.dataset.i = i;
      sel._cfg = it;
      line.appendChild(sel);
      if (parts[1]) { line.appendChild(document.createTextNode(" ")); line.appendChild(el("span", null, hl(parts[1]))); }
      row.appendChild(line);
      var _tr = trP(it.tr); if (_tr) row.appendChild(_tr);
      list.appendChild(row);
      self.sels.push(sel);
    });
    this.body.appendChild(list);
  };
  Ex.prototype.check_select = function () {
    var ok = 0;
    this.sels.forEach(function (sel) {
      var row = sel.closest(".ex-item");
      row.classList.remove("ok", "bad");
      if (parseInt(sel.value, 10) === sel._cfg.a) { ok++; row.classList.add("ok"); }
      else row.classList.add("bad");
    });
    this.finish(ok, this.sels.length);
  };
  Ex.prototype.reset_select = function () {
    this.sels.forEach(function (sel) { sel.value = "-1"; sel.closest(".ex-item").classList.remove("ok", "bad", "revealed"); });
  };
  Ex.prototype.reveal_select = function () {
    this.sels.forEach(function (sel) { sel.classList.add("revealed"); sel.value = String(sel._cfg.a); });
  };

  /* ================= ORDER ================= */
  Ex.prototype.render_order = function () {
    var self = this;
    this.orders = [];
    var list = el("div", "order-list");
    this.cfg.items.forEach(function (it, i) {
      var row = el("div", "ex-item order-item");
      var built = el("div", "order-built", '<span class="order-ph">Нажимайте слова по порядку…</span>');
      var pool = el("div", "order-pool");
      var words = it.words.map(function (w, wi) { return { w: w, wi: wi }; });
      shuffle(words);
      words.forEach(function (w) {
        var chip = el("button", "word-chip", '<span lang="es">' + esc(w.w) + "</span>");
        chip.type = "button";
        chip.dataset.wi = w.wi;
        chip.addEventListener("click", function () { self.moveChip(chip, pool, built); });
        pool.appendChild(chip);
      });
      row.appendChild(el("p", "ex-q", '<span class="num-i">' + (i + 1) + "</span> " + hl(it.q || "")));
      var _tr = trP(it.tr); if (_tr) row.appendChild(_tr);
      row.appendChild(built);
      row.appendChild(pool);
      list.appendChild(row);
      self.orders.push({ row: row, built: built, pool: pool, it: it });
    });
    this.body.appendChild(list);
  };
  Ex.prototype.moveChip = function (chip, pool, built) {
    if (chip.classList.contains("used")) {
      chip.classList.remove("used");
      var ghost = built.querySelector('[data-wi="' + chip.dataset.wi + '"]');
      if (ghost) ghost.remove();
      if (!built.querySelector(".word-chip")) built.innerHTML = '<span class="order-ph">Нажимайте слова по порядку…</span>';
      return;
    }
    var ph = built.querySelector(".order-ph");
    if (ph) ph.remove();
    chip.classList.add("used");
    var ghost = el("button", "word-chip ghost", chip.innerHTML);
    ghost.type = "button";
    ghost.dataset.wi = chip.dataset.wi;
    ghost.addEventListener("click", function () {
      ghost.remove();
      chip.classList.remove("used");
      if (!built.querySelector(".word-chip")) built.innerHTML = '<span class="order-ph">Нажимайте слова по порядку…</span>';
    });
    built.appendChild(ghost);
    void pool;
  };
  Ex.prototype.check_order = function () {
    var ok = 0;
    this.orders.forEach(function (o) {
      o.row.classList.remove("ok", "bad");
      var got = Array.prototype.map.call(o.built.querySelectorAll(".word-chip"), function (c) { return c.textContent.trim(); }).join(" ");
      if (got && norm(got) === norm(o.it.s)) { ok++; o.row.classList.add("ok"); }
      else { o.row.classList.add("bad"); }
    });
    this.finish(ok, this.orders.length);
  };
  Ex.prototype.reset_order = function () {
    this.orders.forEach(function (o) {
      o.row.classList.remove("ok", "bad", "revealed");
      Array.prototype.forEach.call(o.built.querySelectorAll(".word-chip"), function (c) { c.remove(); });
      if (!o.built.querySelector(".order-ph")) o.built.innerHTML = '<span class="order-ph">Нажимайте слова по порядку…</span>';
      Array.prototype.forEach.call(o.pool.querySelectorAll(".word-chip"), function (c) { c.classList.remove("used"); });
    });
  };
  Ex.prototype.reveal_order = function () {
    this.orders.forEach(function (o) {
      o.row.classList.add("revealed");
      Array.prototype.forEach.call(o.built.querySelectorAll(".word-chip"), function (c) { c.remove(); });
      var ph = o.built.querySelector(".order-ph"); if (ph) ph.remove();
      var target = el("span", "word-chip ghost ok", '<span lang="es">' + esc(o.it.s) + "</span>");
      o.built.appendChild(target);
      Array.prototype.forEach.call(o.pool.querySelectorAll(".word-chip"), function (c) { c.classList.remove("used"); });
    });
  };

  /* ================= TF ================= */
  Ex.prototype.render_tf = function () {
    var self = this;
    this.tfs = [];
    var list = el("div", "tf-list");
    this.cfg.items.forEach(function (it, i) {
      var row = el("div", "ex-item tf-item");
      var q = el("p", "ex-q", '<span class="num-i">' + (i + 1) + "</span> " + hl(it.s));
      var opts = el("div", "tf-opts");
      [["true", "Verdadero"], ["false", "Falso"]].forEach(function (pair) {
        var lab = el("label", "tf-opt");
        var inp = document.createElement("input");
        inp.type = "radio";
        inp.name = self.id + "-tf-" + i;
        inp.value = pair[0];
        lab.appendChild(inp);
        lab.appendChild(el("span", "opt-text", pair[1]));
        opts.appendChild(lab);
      });
      row.appendChild(q);
      row.appendChild(opts);
      var _tr = trP(it.tr); if (_tr) row.appendChild(_tr);
      var expl = el("p", "ex-explain", (it.ex ? hl(it.ex) : "") + (it.exTr ? '<span class="tr">' + esc(it.exTr) + "</span>" : ""));
      row.appendChild(expl);
      list.appendChild(row);
      self.tfs.push({ row: row, opts: opts, it: it });
    });
    this.body.appendChild(list);
  };
  Ex.prototype.check_tf = function () {
    var ok = 0;
    this.tfs.forEach(function (m) {
      var sel = m.opts.querySelector("input:checked");
      m.row.classList.remove("ok", "bad", "show-explain");
      var val = sel ? sel.value : null;
      if (val !== null && ((val === "true") === !!m.it.a)) { ok++; m.row.classList.add("ok"); }
      else m.row.classList.add("bad");
      if (m.it.ex && val !== String(!!m.it.a)) m.row.classList.add("show-explain");
    });
    this.finish(ok, this.tfs.length);
  };
  Ex.prototype.reset_tf = function () {
    this.tfs.forEach(function (m) {
      var sel = m.opts.querySelector("input:checked");
      if (sel) sel.checked = false;
      m.row.classList.remove("ok", "bad", "show-explain", "revealed");
    });
  };
  Ex.prototype.reveal_tf = function () {
    this.tfs.forEach(function (m) {
      m.row.classList.add("revealed", "show-explain");
      var inputs = m.opts.querySelectorAll("input");
      Array.prototype.forEach.call(inputs, function (inp) { inp.checked = (inp.value === String(!!m.it.a)); });
    });
  };

  /* ================= CATEGORY ================= */
  Ex.prototype.render_category = function () {
    var self = this;
    var cfg = this.cfg;
    this.catChips = [];
    var board = el("div", "cat-board");
    var head = el("div", "cat-heads");
    cfg.cols.forEach(function (c) { head.appendChild(el("div", "cat-head", esc(c))); });
    board.appendChild(head);
    var lanes = el("div", "cat-lanes");
    this.catLaneEls = cfg.cols.map(function (_, ci) {
      var lane = el("div", "cat-lane");
      lane.dataset.ci = ci;
      lanes.appendChild(lane);
      return lane;
    });
    board.appendChild(lanes);
    var chips = el("div", "cat-chips");
    var pool = cfg.chips.map(function (c, i) { return { w: c.w, c: c.c, i: i }; });
    shuffle(pool);
    pool.forEach(function (p) {
      var chip = el("button", "cat-chip", '<span lang="es">' + esc(p.w) + "</span>");
      chip.type = "button";
      chip.dataset.correct = p.c;
      chip.dataset.state = "-1";
      chip.addEventListener("click", function () {
        var st = parseInt(chip.dataset.state, 10);
        var next = st + 1;
        if (next >= cfg.cols.length) next = -1;
        chip.dataset.state = next;
        self.catLaneEls.forEach(function (lane) {
          var inside = lane.querySelector('[data-wi="' + p.i + '"]');
          if (inside) inside.remove();
        });
        if (next >= 0) {
          var ghost = el("span", "cat-chip ghost", chip.innerHTML);
          ghost.dataset.wi = p.i;
          self.catLaneEls[next].appendChild(ghost);
        }
      });
      chip.dataset.wi = p.i;
      chips.appendChild(chip);
      self.catChips.push(chip);
    });
    board.appendChild(chips);
    this.body.appendChild(board);
  };
  Ex.prototype.check_category = function () {
    var ok = 0, unanswered = 0;
    this.catChips.forEach(function (chip) {
      chip.classList.remove("ok", "bad");
      var st = parseInt(chip.dataset.state, 10);
      if (st === -1) { unanswered++; chip.classList.add("bad"); return; }
      if (st === parseInt(chip.dataset.correct, 10)) { ok++; chip.classList.add("ok"); }
      else chip.classList.add("bad");
    });
    var extra = unanswered ? "Распределите все слова по группам." : "";
    this.finish(ok, this.catChips.length, extra);
  };
  Ex.prototype.reset_category = function () {
    this.catChips.forEach(function (chip) {
      chip.dataset.state = "-1";
      chip.classList.remove("ok", "bad", "revealed");
    });
    this.catLaneEls.forEach(function (lane) { lane.innerHTML = ""; });
  };
  Ex.prototype.reveal_category = function () {
    this.catChips.forEach(function (chip) {
      chip.classList.add("revealed");
      var c = parseInt(chip.dataset.correct, 10);
      chip.dataset.state = c;
    });
    var self = this;
    this.catChips.forEach(function (chip) {
      var c = parseInt(chip.dataset.correct, 10);
      self.catLaneEls.forEach(function (lane) {
        var inside = lane.querySelector('[data-wi="' + chip.dataset.wi + '"]');
        if (inside) inside.remove();
      });
      var ghost = el("span", "cat-chip ghost", chip.innerHTML);
      ghost.dataset.wi = chip.dataset.wi;
      self.catLaneEls[c].appendChild(ghost);
    });
  };

  /* ---------- reveal-кнопка после первой проверки ---------- */
  Ex.prototype.addReveal = function () {
    if (this.revealBtn) return;
    var self = this;
    var b = el("button", "btn-ex btn-reveal", "Показать ответы");
    b.type = "button";
    b.addEventListener("click", function () { self["reveal_" + self.cfg.type](); });
    this.actions.insertBefore(b, this.actions.firstChild);
    this.revealBtn = b;
  };
  var origFinish = Ex.prototype.finish;
  Ex.prototype.finish = function (ok, total, extra) {
    origFinish.call(this, ok, total, extra);
    if (ok < total) this.addReveal();
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- инициализация всех .ex на странице ---------- */
  function initExercises() {
    var roots = document.querySelectorAll(".ex");
    var n = 0;
    Array.prototype.forEach.call(roots, function (root) {
      var dataTag = root.querySelector('script[type="application/json"]');
      if (!dataTag) return;
      var cfg;
      try { cfg = JSON.parse(dataTag.textContent); } catch (e) { return; }
      new Ex(root, cfg, n, roots.length);
      n++;
    });
  }

  /* ---------- прогресс заданий урока ---------- */
  function initLessonProgress() {
    var strip = document.querySelector(".ex-progress");
    if (!strip) return;
    var fill = strip.querySelector(".bar i");
    var label = strip.querySelector(".ex-progress-label");
    function update() {
      var roots = document.querySelectorAll(".ex");
      var total = roots.length, solved = 0;
      Array.prototype.forEach.call(roots, function (root) {
        var v = parseInt(load(root.id.replace(/^ex-/, "")) || "0", 10);
        if (v === 100) solved++;
      });
      if (fill) fill.style.width = (total ? Math.round(solved / total * 100) : 0) + "%";
      if (label) label.textContent = "Тренажёр урока: идеально решено " + solved + " из " + total + " заданий";
    }
    window.__b1exProgress = update;
    update();
  }

  /* ================= TTS-аудирование ================= */
  var currentVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    var es = voices.filter(function (v) { return /^es/i.test(v.lang); });
    if (!es.length) return null;
    var pref = es.filter(function (v) { return /^es[-_]ES/i.test(v.lang) || v.lang === "es-ES"; });
    var google = pref.filter(function (v) { return /google/i.test(v.name); });
    return google[0] || pref[0] || es[0];
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = function () { currentVoice = pickVoice(); };
  }

  /* ================= Озвучка слов и примеров (data-speak) ================= */
  function speakText(text, rate) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    currentVoice = currentVoice || pickVoice();
    var u = new SpeechSynthesisUtterance(text);
    if (currentVoice) u.voice = currentVoice;
    u.lang = currentVoice ? currentVoice.lang : "es-ES";
    u.rate = rate || 1;
    window.speechSynthesis.speak(u);
  }

  function initSpeakButtons() {
    if (!("speechSynthesis" in window)) {
      document.documentElement.classList.add("no-tts");
      return;
    }
    document.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== document) {
        if (t.getAttribute && t.getAttribute("data-speak")) {
          speakText(t.getAttribute("data-speak"), parseFloat(t.getAttribute("data-rate") || "1") || 1);
          t.classList.add("spk-live");
          setTimeout(function (elx) { return function () { elx.classList.remove("spk-live"); }; }(t), 1500);
          return;
        }
        t = t.parentNode;
      }
    });
  }

  /* ================= Диалог «Реальная ситуация» ================= */
  function icoSpeaker() {
    return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  }

  function initDialogues() {
    if (!("speechSynthesis" in window)) return;
    Array.prototype.forEach.call(document.querySelectorAll(".dlg"), function (box) {
      var dataTag = box.querySelector('script[type="application/json"]');
      if (!dataTag) return;
      var data;
      try { data = JSON.parse(dataTag.textContent); } catch (e) { return; }
      var lines = data.lines || [];
      if (!lines.length) return;

      box.innerHTML = "";

      var bar = el("div", "dlg-bar");
      var btns = el("div", "tts-btns");
      function mkBtn(label, cls) {
        var b = el("button", "btn-tts " + (cls || ""), label);
        b.type = "button";
        btns.appendChild(b);
        return b;
      }
      var playBtn = mkBtn("▶ Слушать диалог", "dlg-play");
      var slowBtn = mkBtn("🐢 Медленно", "tts-slow");
      var roleBtn = mkBtn("🎭 Только собеседник", "dlg-role");
      var stopBtn = mkBtn("■ Стоп", "tts-stop");
      var ruBtn = mkBtn("👁 Скрыть перевод", "dlg-ru-toggle");
      bar.appendChild(btns);
      box.appendChild(bar);

      var rows = lines.map(function (ln) {
        var row = el("div", "dlg-line" + (ln.sp === "Tú" ? " dlg-tu" : ""));
        var head = el("div", "dlg-head");
        head.appendChild(el("span", "dlg-sp", ln.sp));
        var spk = el("button", "spk dlg-spk");
        spk.type = "button";
        spk.setAttribute("data-speak", ln.es);
        spk.setAttribute("aria-label", "Прослушать реплику");
        spk.innerHTML = icoSpeaker();
        head.appendChild(spk);
        var bub = el("div", "dlg-bubble");
        var esp = el("p", "dlg-es", "");
        esp.setAttribute("lang", "es");
        esp.textContent = ln.es;
        bub.appendChild(esp);
        bub.appendChild(el("p", "dlg-ru", ln.ru));
        row.appendChild(head);
        row.appendChild(bub);
        box.appendChild(row);
        return row;
      });

      var playing = false, rate = 1, queue = [], qi = 0;

      function stop() {
        playing = false;
        window.speechSynthesis.cancel();
        Array.prototype.forEach.call(rows, function (r) { r.classList.remove("speaking"); });
        playBtn.textContent = "▶ Слушать диалог";
        roleBtn.textContent = "🎭 Только собеседник";
      }
      function next() {
        if (!playing || qi >= queue.length) { stop(); return; }
        var row = rows[queue[qi]];
        Array.prototype.forEach.call(rows, function (r) { r.classList.remove("speaking"); });
        row.classList.add("speaking");
        var u = new SpeechSynthesisUtterance(lines[queue[qi]].es);
        if (currentVoice) u.voice = currentVoice;
        u.lang = currentVoice ? currentVoice.lang : "es-ES";
        u.rate = rate;
        u.onend = function () { qi++; next(); };
        u.onerror = function () { stop(); };
        window.speechSynthesis.speak(u);
      }
      function playFrom(seq, i) {
        stop();
        playing = true;
        queue = seq; qi = i;
        next();
      }
      function allSeq() {
        var seq = [];
        for (var i = 0; i < lines.length; i++) seq.push(i);
        return seq;
      }
      function partnerSeq() {
        var seq = [];
        for (var i = 0; i < lines.length; i++) { if (lines[i].sp !== "Tú") seq.push(i); }
        return seq;
      }

      playBtn.addEventListener("click", function () {
        if (playing) { stop(); return; }
        currentVoice = currentVoice || pickVoice();
        rate = 1;
        playBtn.textContent = "■ Пауза";
        playFrom(allSeq(), 0);
      });
      slowBtn.addEventListener("click", function () {
        currentVoice = currentVoice || pickVoice();
        rate = 0.7;
        playBtn.textContent = "■ Пауза";
        playFrom(allSeq(), 0);
      });
      roleBtn.addEventListener("click", function () {
        if (playing) { stop(); return; }
        currentVoice = currentVoice || pickVoice();
        rate = 1;
        roleBtn.textContent = "🎭 Стоп";
        playFrom(partnerSeq(), 0);
      });
      stopBtn.addEventListener("click", stop);
      ruBtn.addEventListener("click", function () {
        box.classList.toggle("dlg-hide-ru");
        ruBtn.textContent = box.classList.contains("dlg-hide-ru") ? "👁 Показать перевод" : "👁 Скрыть перевод";
      });
    });
  }

  /* ================= Алфавит (A1, урок 0.1) ================= */
  function initAlphabet() {
    if (!("speechSynthesis" in window)) return;
    Array.prototype.forEach.call(document.querySelectorAll(".alphabet"), function (abc) {
      var names = (abc.getAttribute("data-names") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var cards = abc.querySelectorAll(".abc-card");
      var play = abc.querySelector(".abc-play");
      var stopB = abc.querySelector(".abc-stop");
      if (!play || !names.length) return;
      var playing = false, idx = 0;

      function stop() {
        playing = false;
        window.speechSynthesis.cancel();
        Array.prototype.forEach.call(cards, function (c) { c.classList.remove("speaking"); });
        play.textContent = "▶ Названия букв";
      }
      function next() {
        if (!playing || idx >= names.length) { stop(); return; }
        Array.prototype.forEach.call(cards, function (c) { c.classList.remove("speaking"); });
        if (cards[idx]) cards[idx].classList.add("speaking");
        var u = new SpeechSynthesisUtterance(names[idx]);
        if (currentVoice) u.voice = currentVoice;
        u.lang = currentVoice ? currentVoice.lang : "es-ES";
        u.rate = 0.9;
        u.onend = function () { idx++; next(); };
        u.onerror = function () { stop(); };
        window.speechSynthesis.speak(u);
      }
      play.addEventListener("click", function () {
        if (playing) { stop(); return; }
        currentVoice = currentVoice || pickVoice();
        playing = true;
        play.textContent = "■ Пауза";
        next();
      });
      if (stopB) stopB.addEventListener("click", stop);
    });
  }

  function initTTS() {
    if (!("speechSynthesis" in window)) {
      Array.prototype.forEach.call(document.querySelectorAll(".tts"), function (p) {
        p.innerHTML = '<p class="tts-warn">Аудирование требует голосового движка браузера (speechSynthesis). Этот браузер его не поддерживает — попробуйте Chrome, Edge или Safari, либо откройте транскрипт ниже и прочитайте вслух.</p>';
      });
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".tts"), function (player) {
      var dataTag = player.querySelector('script[type="application/json"]');
      if (!dataTag) return;
      var paragraphs;
      try { paragraphs = JSON.parse(dataTag.textContent); } catch (e) { return; }

      player.innerHTML = "";
      var bar = el("div", "tts-bar");
      var info = el("div", "tts-info",
        '<span class="tts-title">' + icoPlay() + " Аудио · Escucha</span>" +
        '<span class="tts-voice" id="voice-note">голос браузера</span>');
      bar.appendChild(info);
      var btns = el("div", "tts-btns");
      function mkBtn(label, cls) {
        var b = el("button", "btn-tts " + (cls || ""), label);
        b.type = "button";
        btns.appendChild(b);
        return b;
      }
      var playBtn = mkBtn("▶ Слушать", "tts-play");
      var slowBtn = mkBtn("🐢 Медленно", "tts-slow");
      var stopBtn = mkBtn("■ Стоп", "tts-stop");
      bar.appendChild(btns);
      player.appendChild(bar);

      var note = el("p", "tts-note", "Если голос не испанский — установите испанский голос в настройках системы. Скорость можно снизить кнопкой «Медленно».");
      player.appendChild(note);

      var texts = paragraphs.map(function (p) { return el("p", "tts-line", p.replace(/^— /, "— ")); });
      var hidden = el("div", "tts-hidden");
      texts.forEach(function (t) { hidden.appendChild(t); });
      player.appendChild(hidden);

      var playing = false, rate = 1, idx = 0;

      function speakFrom(i) {
        stop();
        playing = true;
        idx = i;
        speakNext();
      }
      function speakNext() {
        if (!playing || idx >= texts.length) { stop(); return; }
        var line = texts[idx];
        Array.prototype.forEach.call(texts, function (t) { t.classList.remove("speaking"); });
        line.classList.add("speaking");
        var u = new SpeechSynthesisUtterance(line.textContent);
        if (currentVoice) u.voice = currentVoice;
        u.lang = currentVoice ? currentVoice.lang : "es-ES";
        u.rate = rate;
        u.onend = function () { idx++; speakNext(); };
        u.onerror = function () { stop(); };
        window.speechSynthesis.speak(u);
      }
      function stop() {
        playing = false;
        window.speechSynthesis.cancel();
        Array.prototype.forEach.call(texts, function (t) { t.classList.remove("speaking"); });
        playBtn.textContent = "▶ Слушать";
      }
      playBtn.addEventListener("click", function () {
        if (playing) { stop(); return; }
        currentVoice = currentVoice || pickVoice();
        var vn = player.parentElement.querySelector(".tts-voice-note") || null;
        var voiceNote = document.getElementById("voice-note");
        if (voiceNote) voiceNote.textContent = currentVoice ? "голос: " + currentVoice.name : "испанский голос не найден — будет использован любой доступный";
        rate = 1;
        playBtn.textContent = "■ Пауза";
        speakFrom(0);
      });
      slowBtn.addEventListener("click", function () {
        currentVoice = currentVoice || pickVoice();
        rate = 0.7;
        playBtn.textContent = "■ Пауза";
        speakFrom(0);
      });
      stopBtn.addEventListener("click", stop);
    });
  }
  function icoPlay() {
    return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  }

  document.addEventListener("DOMContentLoaded", function () {
    initExercises();
    initLessonProgress();
    initTTS();
    initSpeakButtons();
    initDialogues();
    initAlphabet();
  });
})();
