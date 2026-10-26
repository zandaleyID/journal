/* Multimodal Journal: routing, accessibility tools and media helpers.
   To add an entry: add a line to ENTRIES below and put its page in the entries folder. */
(function () {
  "use strict";

  var ENTRIES = [
    { id: "start",   num: "",  title: "Start here",                                   file: "entries/start.html" },
    { id: "entry-5", num: "5", title: "From Ideal Design to Workable Design",         file: "entries/entry-5.html" },
    { id: "entry-6", num: "6", title: "When Cutting Load Cuts Access",                file: "entries/entry-6.html" },
    { id: "entry-7", num: "7", title: "Does the Agent Earn Its Place?",               file: "entries/entry-7.html" }
  ];

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

  /* ---------- sidebar ---------- */
  var list = $("entryList");
  ENTRIES.forEach(function (e) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#/" + e.id; a.dataset.id = e.id;
    a.innerHTML = '<span class="num" aria-hidden="true">' + (e.num || "★") + '</span><span>' +
      (e.num ? '<span class="sr">Entry ' + e.num + ': </span>' : "") + e.title + "</span>";
    li.appendChild(a); list.appendChild(li);
  });

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
    var id = (location.hash || "").replace(/^#\/?/, "") || "start";
    var idx = 0;
    ENTRIES.forEach(function (e, i) { if (e.id === id) idx = i; });
    load(ENTRIES[idx], initial);
  }

  function load(e, initial) {
    stopSpeech();
    current = e.id;
    list.querySelectorAll("a").forEach(function (a) { if (a.dataset.id === e.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("crumb").textContent = e.num ? "Journal  /  Entry " + e.num : "Journal  /  " + e.title;
    document.title = e.title + " | Multimodal Journal";
    setSidebar(false);
    content.innerHTML = '<p class="kicker">Loading…</p>';
    fetch(e.file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      content.innerHTML = '<h1 id="page-title" tabindex="-1">' + e.title + "</h1>" + html;
      enhance();
      updatePager();
      if (!initial) { var h = $("page-title"); h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    }).catch(function () {
      content.innerHTML = '<h1 id="page-title" tabindex="-1">' + e.title + '</h1><p class="note">This entry could not be loaded. If you are opening the files directly from a folder, view the site through its web address instead.</p>';
      updatePager();
    });
  }

  function updatePager() {
    var i = currentIndex(), p = $("prevLink"), n = $("nextLink");
    if (i > 0) { p.hidden = false; p.href = "#/" + ENTRIES[i - 1].id; p.textContent = "← Previous: " + ENTRIES[i - 1].title; } else p.hidden = true;
    if (i < ENTRIES.length - 1) { n.hidden = false; n.href = "#/" + ENTRIES[i + 1].id; n.textContent = "Next: " + ENTRIES[i + 1].title + " →"; } else n.hidden = true;
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
      if (el.closest("[data-noread],.fig-tools,.small,.reply")) return;
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
  route(true);
})();
