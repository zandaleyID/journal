/* Multimodal Journal: reads plain-text entries, builds the pages, and provides the accessibility tools.
   Content lives in site.txt, entries/contents.txt and entries/*.txt. See EDITING-GUIDE.txt. */
(function () {
  "use strict";

  var SITE = { title: "Multimodal Journal", subtitle: "Multimodal Content for Online Learning", footer: "" };
  var ENTRIES = [];

  var SCALES = [100, 112, 125, 150, 175];
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var content = $("content");
  var settings = { scale: 0, font: false, spacing: false, theme: "auto", motion: null, rate: "1", voice: "" };

  /* ---------- settings (kept in this browser only) ---------- */
  function loadSettings() {
    try { var s = JSON.parse(localStorage.getItem("mj-settings") || "{}"); for (var k in s) settings[k] = s[k]; } catch (e) {}
    if (settings.motion === null) {
      settings.motion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }
  function saveSettings() { try { localStorage.setItem("mj-settings", JSON.stringify(settings)); } catch (e) {} }

  function applySettings() {
    root.style.setProperty("--scale", SCALES[settings.scale] + "%");
    root.classList.toggle("readable", !!settings.font);
    root.classList.toggle("spacing", !!settings.spacing);
    if (settings.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", settings.theme);
    $("aFont").checked = !!settings.font;
    $("aSpacing").checked = !!settings.spacing;
    $("aTheme").value = settings.theme;
    $("aMotion").checked = !!settings.motion;
    $("aRate").value = settings.rate;
    applyMotion();
  }

  /* ---------- animations: GIFs can be paused (swapped for a still image) ---------- */
  function setFigureAnimation(img, paused, btn) {
    if (!img.dataset.still) return;
    if (!img.dataset.anim) img.dataset.anim = img.getAttribute("src");
    img.setAttribute("src", paused ? img.dataset.still : img.dataset.anim);
    if (btn) { btn.setAttribute("aria-pressed", paused ? "true" : "false"); btn.textContent = paused ? "Play animation" : "Pause animation"; }
  }
  function applyMotion() {
    var imgs = content.querySelectorAll("img[data-still]");
    imgs.forEach(function (img) {
      var btn = img.parentNode.querySelector(".fig-tools .anim-btn");
      setFigureAnimation(img, !!settings.motion, btn);
    });
  }

  /* ---------- reading the plain-text files ---------- */
  var KEYS = { title: 1, "short-title": 1, number: 1, subtitle: 1, date: 1, banner: 1, "banner-alt": 1, "banner-caption": 1, "banner-everywhere": 1, footer: 1,
    author: 1, image: 1, still: 1, alt: 1, caption: 1, description: 1, transcript: 1, url: 1, size: 1, file: 1, captions: 1, poster: 1,
    text: 1, reply: 1, heading: 1 };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // **bold**, *italic*, [text](link) and plain web addresses
  function inline(raw) {
    var keep = [];
    function hold(html) { keep.push(html); return "\u0000" + (keep.length - 1) + "\u0000"; }
    var s = esc(raw);
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (m, t, u) {
      return hold('<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>");
    });
    s = s.replace(/https?:\/\/[^\s\u0000]+?(?=&gt;|&lt;|\s|$)/g, function (u) {
      var tail = "", m = u.match(/[.,;:)]+$/);
      if (m) { tail = m[0]; u = u.slice(0, -tail.length); }
      return hold('<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>") + tail;
    });
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
         .replace(/\*(.+?)\*/g, "<em>$1</em>");
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return keep[+i]; });
  }

  // lines of "key: value" (a long value may continue on the next lines)
  function parseKV(lines) {
    var o = {}, last = null;
    lines.forEach(function (ln) {
      var m = ln.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i);
      if (m && KEYS[m[1].toLowerCase()]) { last = m[1].toLowerCase(); o[last] = m[2].trim(); }
      else if (last && ln.trim()) o[last] += " " + ln.trim();
    });
    return o;
  }

  // a file is: optional settings, a line with ---, then the writing
  function parseDoc(text) {
    text = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
    var first = text.split("\n").filter(function (l) { return l.trim(); })[0] || "";
    var i = text.search(/^---\s*$/m);
    if (i < 0 || !/^[a-z][a-z0-9-]*:/i.test(first)) return { meta: {}, body: text };
    return { meta: parseKV(text.slice(0, i).split("\n")), body: text.slice(text.indexOf("\n", i) + 1) };
  }

  var BLOCKS = { figure: 1, embed: 1, video: 1, question: 1, note: 1, references: 1, "image-references": 1 };

  function render(body) {
    var lines = body.replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0, para = [], list = null;
    function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function flushList() {
      if (list) { out.push("<" + list.t + ">" + list.items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</" + list.t + ">"); list = null; }
    }
    while (i < lines.length) {
      var t = lines[i].trim(), m;
      if (!t) { flushPara(); flushList(); i++; continue; }
      if ((m = t.match(/^\[([a-z-]+)\]$/)) && BLOCKS[m[1]]) {
        flushPara(); flushList();
        var name = m[1], inner = []; i++;
        while (i < lines.length && lines[i].trim() !== "[/" + name + "]") { inner.push(lines[i]); i++; }
        i++; out.push(block(name, inner)); continue;
      }
      if ((m = t.match(/^(#{2,3})\s+(.*)$/))) { flushPara(); flushList(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
      if ((m = t.match(/^[-•]\s+(.*)$/)) || (m = t.match(/^\*\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ul") { flushList(); list = { t: "ul", items: [] }; } list.items.push(m[1]); i++; continue; }
      if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.t !== "ol") { flushList(); list = { t: "ol", items: [] }; } list.items.push(m[1]); i++; continue; }
      if (t.charAt(0) === ">") { flushPara(); flushList(); out.push("<blockquote><p>" + inline(t.replace(/^>\s?/, "")) + "</p></blockquote>"); i++; continue; }
      flushList(); para.push(t); i++;
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  function figCaption(o) { return o.caption ? "<figcaption>" + inline(o.caption) + "</figcaption>" : ""; }
  function figDetails(o) {
    var txt = o.description || o.transcript; if (!txt) return "";
    var f = (o.caption || "").match(/^Figure \d+/);
    var label = o.transcript && !o.description ? "Transcript" : "Text description";
    return "<details><summary>" + label + (f ? " of " + f[0] : "") + "</summary><p>" + inline(txt) + "</p></details>";
  }
  function toEmbed(u) {
    var m;
    if ((m = u.match(/drive\.google\.com\/file\/d\/([^\/?#]+)/))) return { src: "https://drive.google.com/file/d/" + m[1] + "/preview", video: true };
    if ((m = u.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([\w-]{6,})/))) return { src: "https://www.youtube-nocookie.com/embed/" + m[1], video: true };
    return { src: u, video: false };
  }

  function block(name, lines) {
    if (name === "note") return '<div class="note">' + render(lines.join("\n")) + "</div>";
    if (name === "references" || name === "image-references") {
      var items = lines.map(function (l) { return l.trim(); }).filter(Boolean);
      return "<h2>" + (name === "references" ? "References" : "Image references") + '</h2><ul class="refs">' +
        items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ul>";
    }
    var o = parseKV(lines);
    if (name === "figure") {
      return "<figure><img src=\"" + esc(o.image || "") + "\" alt=\"" + esc(o.alt || "") + "\"" + (o.still ? " data-still=\"" + esc(o.still) + "\"" : "") + ">" + figCaption(o) + figDetails(o) + "</figure>";
    }
    if (name === "embed") {
      var e = toEmbed(o.url || ""), size = o.size || (e.video ? "video" : "mid");
      var link = ' <span class="embed-links"><a href="' + esc(o.url || "") + '" target="_blank" rel="noopener">Open in a new tab</a>.</span>';
      return '<figure><iframe class="embed ' + esc(size) + '" src="' + esc(e.src) + '" title="' + esc(o.title || o.caption || "Embedded page") + '" loading="lazy" allowfullscreen></iframe>' +
        "<figcaption>" + (o.caption ? inline(o.caption) : "") + link + "</figcaption>" + figDetails(o) + "</figure>";
    }
    if (name === "video") {
      var type = /\.webm$/i.test(o.file || "") ? "video/webm" : "video/mp4";
      return '<figure><video controls preload="metadata" playsinline aria-label="' + esc(o.title || o.caption || "Video") + '"' + (o.poster ? ' poster="' + esc(o.poster) + '"' : "") + '>' +
        '<source src="' + esc(o.file || "") + '" type="' + type + '">' +
        (o.captions ? '<track kind="captions" src="' + esc(o.captions) + '" srclang="en" label="English captions" default>' : "") +
        '<p>Your browser cannot play this video. <a href="' + esc(o.file || "") + '">Download it instead</a>.</p></video>' + figCaption(o) + figDetails(o) + "</figure>";
    }
    if (name === "question") {
      return '<section class="reader-q" data-reply="' + esc(o.reply || "") + '"><h2>' + inline(o.heading || "A question for you") + '</h2><p class="q">' + inline(o.text || "") + "</p></section>";
    }
    return "";
  }

  /* ---------- loading the site ---------- */
  function fetchText(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  var list = $("entryList");

  function init() {
    fetchText("site.txt").then(function (t) {
      var o = parseKV(t.replace(/\r\n?/g, "\n").split("\n")); for (var k in o) SITE[k] = o[k];
    }).catch(function () {}).then(function () {
      return fetchText("entries/contents.txt");
    }).then(function (t) {
      var names = t.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && x.charAt(0) !== "#"; });
      return Promise.all(names.map(function (n) {
        var file = "entries/" + (/\.[a-z0-9]+$/i.test(n) ? n : n + ".txt"), id = n.replace(/\.[a-z0-9]+$/i, "");
        return fetchText(file).then(function (txt) { var d = parseDoc(txt); return { id: id, file: file, meta: d.meta, body: d.body, ok: true }; })
          .catch(function () { return { id: id, file: file, meta: { title: n + " (file not found)" }, body: "", ok: false }; });
      }));
    }).then(function (all) {
      ENTRIES = all; applySite(); buildSidebar(); route(true);
    }).catch(function () {
      content.innerHTML = '<p class="note">The list of entries (entries/contents.txt) could not be loaded. If you opened the files straight from a folder, open the site through its web address instead.</p>';
    });
  }

  function applySite() {
    document.querySelector(".brand-title").textContent = SITE.title;
    document.querySelector(".brand-sub").textContent = SITE.subtitle || "";
    if (SITE.footer) document.querySelector(".foot").textContent = SITE.footer;
  }

  function buildSidebar() {
    list.innerHTML = "";
    ENTRIES.forEach(function (e) {
      var n = e.meta.number || "", li = document.createElement("li"), a = document.createElement("a");
      a.href = "#/" + e.id; a.dataset.id = e.id;
      a.innerHTML = '<span class="num" aria-hidden="true">' + (n ? esc(n) : "⌂") + '</span><span>' +
        (n ? '<span class="sr">Entry ' + esc(n) + ": </span>" : "") + esc(e.meta["short-title"] || e.meta.title || e.id) + "</span>";
      li.appendChild(a); list.appendChild(li);
    });
  }

  function setSidebar(open) {
    $("sidebar").classList.toggle("open", open);
    $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
    $("scrim").hidden = !open;
  }
  $("menuBtn").addEventListener("click", function () { setSidebar(!$("sidebar").classList.contains("open")); });
  $("scrim").addEventListener("click", function () { setSidebar(false); });

  /* ---------- routing ---------- */
  var current = null;
  function currentIndex() { for (var i = 0; i < ENTRIES.length; i++) if (ENTRIES[i].id === current) return i; return 0; }

  function route(initial) {
    if (!ENTRIES.length) return;
    var id = (location.hash || "").replace(/^#\/?/, "") || ENTRIES[0].id, idx = 0;
    ENTRIES.forEach(function (e, i) { if (e.id === id) idx = i; });
    load(ENTRIES[idx], idx, initial);
  }

  function bannerHtml(e, isFirst) {
    var m = e.meta, src = m.banner, alt = m["banner-alt"], cap = m["banner-caption"];
    if (!src && isFirst && SITE.banner) { src = SITE.banner; alt = SITE["banner-alt"]; cap = SITE["banner-caption"]; }
    if (!src) return "";
    return '<figure class="banner"><img src="' + esc(src) + '" alt="' + esc(alt || "") + '">' + (cap ? '<figcaption class="credit">' + inline(cap) + "</figcaption>" : "") + "</figure>";
  }

  function load(e, idx, initial) {
    stopSpeech();
    current = e.id;
    var m = e.meta, title = m.title || e.id;
    list.querySelectorAll("a").forEach(function (a) { if (a.dataset.id === e.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("crumb").textContent = m.number ? "Journal  /  Entry " + m.number : "Journal  /  " + title;
    document.title = title + " | " + SITE.title;
    setSidebar(false);

    var strip = $("siteStrip");
    if (SITE.banner && /^(yes|true|all)$/i.test(SITE["banner-everywhere"] || "") && idx !== 0) {
      strip.innerHTML = '<img src="' + esc(SITE.banner) + '" alt="">'; strip.hidden = false;
      strip.querySelector("img").addEventListener("error", function () { strip.hidden = true; });
    } else { strip.hidden = true; strip.innerHTML = ""; }

    var sub = [m.subtitle ? inline(m.subtitle) : "", m.date ? esc(m.date) : ""].filter(Boolean).join("  ·  ");
    var body = e.ok ? render(e.body) : '<p class="note">This entry file was not found: ' + esc(e.file) + '. Check that the name in entries/contents.txt matches the file name exactly.</p>';
    content.innerHTML = bannerHtml(e, idx === 0) + '<h1 id="page-title" tabindex="-1">' + esc(title) + "</h1>" + (sub ? '<p class="kicker">' + sub + "</p>" : "") + body;
    enhance();
    updatePager();
    if (!initial) { var h = $("page-title"); h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }

  function updatePager() {
    var i = currentIndex(), p = $("prevLink"), n = $("nextLink");
    function nm(x) { return (x.meta["short-title"] || x.meta.title || x.id); }
    if (i > 0) { p.hidden = false; p.href = "#/" + ENTRIES[i - 1].id; p.textContent = "← Previous: " + nm(ENTRIES[i - 1]); } else p.hidden = true;
    if (i < ENTRIES.length - 1) { n.hidden = false; n.href = "#/" + ENTRIES[i + 1].id; n.textContent = "Next: " + nm(ENTRIES[i + 1]) + " →"; } else n.hidden = true;
  }

  /* ---------- enhance each loaded page ---------- */
  function enhance() {
    // pause/play buttons for animated images
    content.querySelectorAll("img[data-still]").forEach(function (img) {
      var tools = document.createElement("div"); tools.className = "fig-tools";
      var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost anim-btn"; b.setAttribute("aria-pressed", "false"); b.textContent = "Pause animation";
      b.addEventListener("click", function () { setFigureAnimation(img, b.getAttribute("aria-pressed") !== "true", b); });
      tools.appendChild(b); img.parentNode.insertBefore(tools, img.nextSibling);
    });
    // missing media: show a clear placeholder instead of a broken picture
    content.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () {
        if (img.closest(".banner")) { img.closest(".banner").remove(); return; }
        var d = document.createElement("div"); d.className = "missing"; d.setAttribute("role", "img"); d.setAttribute("aria-label", img.alt || "Image");
        d.textContent = "Image not added yet: " + (img.dataset.anim || img.getAttribute("src"));
        img.replaceWith(d);
      });
    });
    content.querySelectorAll("video").forEach(function (v) {
      var s = v.querySelector("source");
      if (s) s.addEventListener("error", function () {
        var p = document.createElement("p"); p.className = "note"; p.textContent = "The video file has not been added yet: " + s.getAttribute("src");
        v.parentNode.insertBefore(p, v.nextSibling);
      });
    });
    // reader question with an automated reply (nothing is stored or sent)
    content.querySelectorAll(".reader-q").forEach(function (box, i) {
      var q = box.querySelector(".q"); var reply = box.dataset.reply || "Thank you for thinking about this. There are no right or wrong answers.";
      var qid = "rq" + i; q.id = qid + "-q";
      var ta = document.createElement("textarea"); ta.id = qid; ta.setAttribute("aria-labelledby", qid + "-q");
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn"; btn.textContent = "Share my thoughts";
      var small = document.createElement("p"); small.className = "small"; small.textContent = "Your answer stays on this page. It is not saved or sent anywhere.";
      var out = document.createElement("div"); out.className = "reply"; out.hidden = true; out.setAttribute("role", "status");
      btn.addEventListener("click", function () { out.textContent = reply; out.hidden = false; });
      box.appendChild(ta); box.appendChild(small); box.appendChild(btn); box.appendChild(out);
    });
    applyMotion();
  }

  /* ---------- read aloud ---------- */
  var synth = window.speechSynthesis;
  var queue = [], qi = 0, state = "idle", currentEl = null;

  function collect() {
    var items = [];
    content.querySelectorAll("h1,h2,h3,p,li,figcaption,blockquote,img[alt],iframe[title],video[aria-label]").forEach(function (el) {
      if (el.closest("[data-noread],.fig-tools,.small,.reply,.banner figcaption")) return;
      var d = el.closest("details"); if (d && !d.open) return;
      var text = "", target = el;
      if (el.tagName === "IMG") { if (!el.alt) return; text = "Image description. " + el.alt; target = el.closest("figure") || el; }
      else if (el.tagName === "IFRAME") { text = "Interactive page: " + el.title + ". A text description follows."; target = el; }
      else if (el.tagName === "VIDEO") { text = "Video: " + el.getAttribute("aria-label"); target = el.closest("figure") || el; }
      else text = el.innerText.replace(/\s+/g, " ").trim();
      if (text) items.push({ el: target, text: text });
    });
    return items;
  }

  function label(s) {
    state = s;
    var play = s === "playing" ? "Pause" : (s === "paused" ? "Resume" : "Play");
    $("aPlay").textContent = play;
    $("listenBtn").textContent = s === "playing" ? "Pause listening" : (s === "paused" ? "Resume listening" : "Listen to this entry");
    $("listenBtn").setAttribute("aria-pressed", s === "playing" ? "true" : "false");
  }
  function clearMark() { if (currentEl) currentEl.classList.remove("reading"); currentEl = null; }
  function speakNext() {
    clearMark();
    if (qi >= queue.length) { label("idle"); return; }
    var it = queue[qi], u = new SpeechSynthesisUtterance(it.text);
    u.rate = parseFloat(settings.rate) || 1;
    if (settings.voice) { var v = synth.getVoices().filter(function (x) { return x.voiceURI === settings.voice; })[0]; if (v) u.voice = v; }
    u.lang = (u.voice && u.voice.lang) || "en";
    u.onend = function () { if (state === "playing") { qi++; speakNext(); } };
    u.onerror = function () { if (state === "playing") { qi++; speakNext(); } };
    currentEl = it.el; it.el.classList.add("reading");
    it.el.scrollIntoView({ block: "center", behavior: settings.motion ? "auto" : "smooth" });
    synth.speak(u);
  }
  function stopSpeech() { if (!synth) return; synth.cancel(); queue = []; qi = 0; clearMark(); label("idle"); }
  function togglePlay() {
    if (!synth) return;
    if (state === "idle") { queue = collect(); qi = 0; if (!queue.length) return; label("playing"); speakNext(); }
    else if (state === "playing") { synth.pause(); label("paused"); }
    else { synth.resume(); label("playing"); }
  }

  function fillVoices() {
    if (!synth) return;
    var sel = $("aVoice"), vs = synth.getVoices();
    if (!vs.length) return;
    sel.innerHTML = '<option value="">Default voice</option>';
    vs.slice().sort(function (a, b) { return (b.lang.indexOf("en") === 0) - (a.lang.indexOf("en") === 0) || a.name.localeCompare(b.name); })
      .forEach(function (v) { var o = document.createElement("option"); o.value = v.voiceURI; o.textContent = v.name + " (" + v.lang + ")"; sel.appendChild(o); });
    sel.value = settings.voice || "";
  }

  /* ---------- wire up controls ---------- */
  loadSettings();
  if (!synth) {
    $("aPlay").disabled = true; $("listenBtn").disabled = true;
    $("aHint").textContent = "Your browser does not offer read-aloud. You can still use your device's own screen reader or reading tools.";
  } else {
    $("aHint").textContent = "Reads this entry aloud, including the descriptions of images. The voice comes from your device.";
    fillVoices(); synth.addEventListener && synth.addEventListener("voiceschanged", fillVoices);
  }
  $("aPlay").addEventListener("click", togglePlay);
  $("listenBtn").addEventListener("click", togglePlay);
  $("aStop").addEventListener("click", stopSpeech);
  $("aRate").addEventListener("change", function (e) { settings.rate = e.target.value; saveSettings(); });
  $("aVoice").addEventListener("change", function (e) { settings.voice = e.target.value; saveSettings(); });
  $("aLarger").addEventListener("click", function () { settings.scale = Math.min(SCALES.length - 1, settings.scale + 1); saveSettings(); applySettings(); });
  $("aSmaller").addEventListener("click", function () { settings.scale = Math.max(0, settings.scale - 1); saveSettings(); applySettings(); });
  $("aReset").addEventListener("click", function () { settings.scale = 0; saveSettings(); applySettings(); });
  $("aFont").addEventListener("change", function (e) { settings.font = e.target.checked; saveSettings(); applySettings(); });
  $("aSpacing").addEventListener("change", function (e) { settings.spacing = e.target.checked; saveSettings(); applySettings(); });
  $("aTheme").addEventListener("change", function (e) { settings.theme = e.target.value; saveSettings(); applySettings(); });
  $("aMotion").addEventListener("change", function (e) { settings.motion = e.target.checked; saveSettings(); applyMotion(); });

  $("a11yBtn").addEventListener("click", function () {
    var open = $("a11y").hidden; $("a11y").hidden = !open; $("a11yBtn").setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("a11y").hidden) { $("a11y").hidden = true; $("a11yBtn").setAttribute("aria-expanded", "false"); $("a11yBtn").focus(); }
    setSidebar(false);
  });
  window.addEventListener("hashchange", function () { route(false); });
  window.addEventListener("beforeunload", function () { if (synth) synth.cancel(); });

  applySettings();
  init();
})();
