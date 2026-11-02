/* Statusleiste, Nachrichten und Statusseite (Vertrag: VERTRAG-STATUSSEITE.md).
   Ohne Token und ohne ?statusdemo=1 passiert nichts: kein Netzwerkaufruf, Bereiche bleiben ausgeblendet. */
(function () {
  "use strict";
  var cfg = window.WORKBADGE_STATUS || {};
  var demo = /[?&]statusdemo=1(&|$)/.test(location.search);
  var hasToken = typeof cfg.apiToken === "string" && cfg.apiToken.trim() !== "";
  if (!demo && !hasToken) return;
  var $ = function (s) { return document.querySelector(s); };
  var bar = $("[data-wb-statusbar]"), notices = $("[data-wb-notices]");
  var gameList = $("[data-wb-games]"), noticeList = $("[data-wb-notice-list]"), stamp = $("[data-wb-stamp]");
  var offline = $("[data-wb-offline]");

  var GAMES = [["encounters", "Begegnungen"], ["bingo", "Icebreaker-Bingo"], ["buddy", "Momo (BadgeBuddies)"], ["memory", "Gedächtnisrunde"], ["halves", "Halbe Sachen"]];
  var DEFAULT_NOTE = "Dieses Spiel wird gerade überarbeitet und ist kurz pausiert. Bitte versuche es später noch einmal.";
  var LOCKED_NOTE = "Dieses Spiel ist vorerst gesperrt. Dein Spielstand bleibt erhalten.";
  var TIMEOUT = 5000, EVERY = 5 * 60 * 1000;
  var lastLoad = 0, timer = null, db = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function dot(cls) { var d = el("span", "wb-dot " + (cls || "")); d.setAttribute("aria-hidden", "true"); return d; }
  function safeUrl(u) {
    try { var p = new URL(String(u)); return p.protocol === "https:" ? p.href : null; } catch (e) { return null; }
  }
  function val(rec, name) { var f = rec && rec.fields && rec.fields[name]; return f ? f.value : undefined; }
  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, TIMEOUT); })]);
  }
  function fmt(ms) {
    try { return new Date(ms).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return ""; }
  }

  /* blocked: "bingo,buddy,lock:memory,until:bingo:1790000000" (siehe GameAvailability.swift) */
  function parseBlocked(text, now) {
    var ids = {}, locked = {}, until = {};
    String(text || "").split(",").forEach(function (t) {
      var p = t.trim().split(":");
      if (p.length === 1 && p[0]) ids[p[0]] = true;
      else if (p.length === 2 && p[0] === "lock") locked[p[1]] = true;
      else if (p.length === 3 && p[0] === "until" && isFinite(Number(p[2]))) until[p[1]] = Number(p[2]) * 1000;
    });
    return GAMES.map(function (g) {
      var id = g[0], mode = "ok";
      if (locked[id]) mode = "locked";
      else if (ids[id] && !(until[id] && until[id] <= now)) mode = "paused";
      return { id: id, title: g[1], mode: mode, until: mode === "paused" ? until[id] : null };
    });
  }
  function noteFor(note, mode) {
    var t = String(note || "").trim().slice(0, 200);
    return t || (mode === "locked" ? LOCKED_NOTE : DEFAULT_NOTE);
  }

  function renderGames(games, note, updated) {
    var bad = games.filter(function (g) { return g.mode !== "ok"; });
    if (bar) {
      bar.textContent = "";
      var shell = el("div", "shell"), msg = el("span");
      if (!bad.length) {
        msg.appendChild(dot()); msg.appendChild(document.createTextNode("Alle Spiele verfügbar"));
      } else {
        var allPaused = bad.every(function (g) { return g.mode === "paused"; });
        msg.appendChild(dot(allPaused ? "is-paused" : "is-locked"));
        msg.appendChild(document.createTextNode(bad.map(function (g) { return g.title; }).join(", ") +
          (allPaused ? " vorübergehend pausiert" : " nicht verfügbar") + " – " + noteFor(note, bad[0].mode)));
      }
      shell.appendChild(msg);
      var a = el("a", null, "Status ansehen"); a.href = "/status/"; shell.appendChild(a);
      bar.appendChild(shell); bar.hidden = false;
    }
    if (gameList) {
      gameList.textContent = "";
      games.forEach(function (g) {
        var li = el("li"), row = el("div", "row");
        row.appendChild(el("span", null, g.title));
        row.appendChild(el("span", "state is-" + g.mode, g.mode === "ok" ? "Verfügbar" : g.mode === "locked" ? "Vorerst gesperrt" : "Vorübergehend pausiert"));
        li.appendChild(row);
        if (g.mode !== "ok") {
          li.appendChild(el("p", null, noteFor(note, g.mode)));
          if (g.until) li.appendChild(el("p", null, "Voraussichtlich bis: " + fmt(g.until)));
        }
        gameList.appendChild(li);
      });
      gameList.hidden = false;
      if (stamp) stamp.textContent = updated ? "Stand: " + fmt(updated) : "";
    }
  }

  function dismissed(id) { try { return sessionStorage.getItem("wb-dismiss-" + id) === "1"; } catch (e) { return false; } }
  function dismiss(id) { try { sessionStorage.setItem("wb-dismiss-" + id, "1"); } catch (e) {} }

  function noticeBody(n, cls) {
    var body = el("div", cls);
    body.appendChild(el("strong", null, n.title));
    if (n.text) body.appendChild(el("span", null, n.text));
    var u = n.ctaUrl && safeUrl(n.ctaUrl);
    if (u) {
      body.appendChild(document.createTextNode(" "));
      var a = el("a", null, n.ctaLabel || "Mehr erfahren");
      a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; body.appendChild(a);
    }
    return body;
  }
  function renderNotices(list) {
    if (notices) {
      notices.textContent = "";
      var top = list.filter(function (n) { return !dismissed(n.key); })[0];
      if (top) {
        var box = el("div", "wb-notice k-" + top.kind), shell = el("div", "shell");
        box.setAttribute("role", top.kind === "important" ? "alert" : "status");
        shell.appendChild(noticeBody(top, "wb-notice-body"));
        var x = el("button", "wb-notice-close", "×"); x.type = "button"; x.setAttribute("aria-label", "Nachricht schließen");
        x.addEventListener("click", function () { dismiss(top.key); notices.hidden = true; notices.textContent = ""; });
        shell.appendChild(x); box.appendChild(shell); notices.appendChild(box); notices.hidden = false;
      } else notices.hidden = true;
    }
    if (noticeList) {
      noticeList.textContent = "";
      if (!list.length) noticeList.appendChild(el("p", "wb-empty", "Aktuell gibt es keine Nachrichten."));
      list.forEach(function (n) { noticeList.appendChild(noticeBody(n, "wb-list-notice k-" + n.kind)); });
    }
  }

  function hideAll() {
    if (bar) { bar.hidden = true; bar.textContent = ""; }
    if (notices) { notices.hidden = true; notices.textContent = ""; }
    if (gameList) { gameList.hidden = true; gameList.textContent = ""; }
    if (stamp) stamp.textContent = "";
    if (noticeList) noticeList.textContent = "";
    if (offline) offline.hidden = false;
  }

  function normalizeNotices(records, now) {
    var kinds = { news: 1, update: 1, maintenance: 1, important: 1 };
    return records.map(function (r) {
      var k = val(r, "kind");
      return {
        key: (r.recordName || "") + ":" + (val(r, "updatedAt") || ""),
        status: val(r, "status"), website: val(r, "website"),
        title: String(val(r, "title") || "").slice(0, 200), text: String(val(r, "text") || "").slice(0, 1000),
        kind: kinds[k] ? k : "news",
        ctaLabel: String(val(r, "ctaLabel") || "").slice(0, 60), ctaUrl: val(r, "ctaUrl"),
        priority: Number(val(r, "priority")) || 0, updated: Number(val(r, "updatedAt")) || 0,
        start: val(r, "startAt"), end: val(r, "endAt")
      };
    }).filter(function (n) {
      return n.status === "published" && n.website === "show" && n.title &&
        (!n.start || n.start <= now) && (!n.end || n.end > now);
    }).sort(function (a, b) { return b.priority - a.priority || b.updated - a.updated; });
  }

  function demoData() {
    var now = Date.now();
    var f = function (o) { var r = { recordName: o.n, fields: {} }; Object.keys(o.f).forEach(function (k) { r.fields[k] = { value: o.f[k] }; }); return r; };
    return {
      games: { blocked: "bingo,until:bingo:" + Math.floor((now + 7200000) / 1000), note: "Wir verbessern gerade die Rundenauswertung.", updated: now - 600000 },
      notices: [
        f({ n: "demo1", f: { status: "published", website: "show", title: "Geplante Wartung", text: "Am Samstag ist die Rangliste kurz nicht erreichbar.", kind: "maintenance", priority: 5, ctaLabel: "Mehr dazu", ctaUrl: "https://workbadge.de/" } }),
        f({ n: "demo2", f: { status: "published", website: "show", title: "Neue App-Version", text: "Verbesserungen für Autopilot und Spiele.", kind: "update", priority: 1 } })
      ]
    };
  }

  function loadCloudKit() {
    if (window.CloudKit) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js"; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error("load")); };
      document.head.appendChild(s);
    });
  }
  function getDb() {
    if (db) return db;
    window.CloudKit.configure({ containers: [{ containerIdentifier: cfg.containerIdentifier, apiTokenAuth: { apiToken: cfg.apiToken, persist: false }, environment: cfg.environment || "production" }] });
    db = window.CloudKit.getDefaultContainer().publicCloudDatabase;
    return db;
  }
  function fetchLive() {
    return withTimeout(loadCloudKit().then(function () {
      var d = getDb();
      return Promise.all([
        d.fetchRecords([{ recordName: "games" }]).catch(function () { return { records: [] }; }),
        d.performQuery({ recordType: "WorkBadgeAnnouncement", filterBy: [{ fieldName: "website", comparator: "EQUALS", fieldValue: { value: "show" } }] })
      ]);
    })).then(function (r) {
      var rec = (r[0].records || [])[0], ok = rec && !rec.serverErrorCode;
      return {
        games: { blocked: ok ? val(rec, "blocked") : "", note: ok ? val(rec, "note") : "", updated: ok ? (val(rec, "updatedAt") || (rec.modified && rec.modified.timestamp)) : null },
        notices: (r[1].records || []).filter(function (x) { return !x.serverErrorCode; })
      };
    });
  }

  function run() {
    var now = Date.now();
    return (demo ? Promise.resolve(demoData()) : fetchLive()).then(function (d) {
      renderGames(parseBlocked(d.games.blocked, now), d.games.note, d.games.updated);
      renderNotices(normalizeNotices(d.notices, now));
      if (offline) offline.hidden = true;
    }).catch(hideAll).then(function () { lastLoad = Date.now(); });
  }
  function schedule() {
    clearTimeout(timer);
    if (document.visibilityState !== "visible") return;
    timer = setTimeout(function () { run().then(schedule); }, EVERY);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") { clearTimeout(timer); return; }
    if (Date.now() - lastLoad >= EVERY) run().then(schedule); else schedule();
  });

  if (demo) {
    var m = $("[data-wb-demo]");
    if (m) m.hidden = false;
    else if (bar) bar.insertAdjacentElement("beforebegin", el("div", "wb-demo", "Demo-Modus mit Beispieldaten (?statusdemo=1)"));
  }
  run().then(schedule);
})();
