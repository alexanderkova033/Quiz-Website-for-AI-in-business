/* AI × UK Politics quiz. No backend, no storage, no analytics. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screens = ["landing", "round", "question", "results", "share"];
  const SITE_URL = location.origin + location.pathname.replace(/index\.html$/, "");

  const RANKS = [
    { min: 0.875, title: "Fact-check legend", blurb: "Hardly anything gets past you. Campaign marketers and deepfake makers will have to try a lot harder." },
    { min: 0.625, title: "Sharp sceptic", blurb: "You spot most of the tricks. Keep asking who made it and who else is reporting it." },
    { min: 0.375, title: "Curious voter", blurb: "Some of these surprised you, and that's the point. The real stories are often stranger than the fakes." },
    { min: 0, title: "Fresh recruit", blurb: "AI politics is full of surprises. Now you know the tricks, you're a much harder target." },
  ];

  let data = null;
  let order = [];
  let idx = 0;
  let score = 0;
  let roundScore = 0;
  let shareBlob = null;
  let shareUrl = null;

  function show(name) {
    for (const s of screens) $("screen-" + s).hidden = s !== name;
    $("progressWrap").hidden = name !== "question";
    const heading = $("screen-" + name).querySelector("[tabindex='-1']");
    window.scrollTo({ top: 0 });
    if (heading) heading.focus({ preventScroll: true });
  }

  function roundOf(id) { return data.rounds.find((r) => r.id === id); }

  async function load() {
    try {
      const res = await fetch("questions.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      data = await res.json();
      order = [...data.questions].sort((a, b) => a.round - b.round);
      $("startBtn").textContent = "Start the quiz";
      $("startBtn").disabled = false;
      $("scoreTotal").textContent = order.length;
      $("pillQuestions").textContent = `${order.length} questions`;
      $("pillRounds").textContent = `${data.rounds.length} rounds`;
      $("progressBar").setAttribute("aria-valuemax", order.length);
    } catch (err) {
      $("startBtn").textContent = "Couldn't load";
      $("loadError").hidden = false;
      $("loadError").textContent = "The questions didn't load. Check your connection and refresh the page.";
    }
  }

  function start() {
    idx = 0; score = 0; roundScore = 0;
    showRound(order[0].round, null);
  }

  function showRound(roundId, prevRound) {
    const r = roundOf(roundId);
    const total = data.rounds.length;
    $("roundEyebrow").textContent = `Round ${roundId} of ${total}`;
    $("roundTitle").textContent = r.title;
    $("roundIntro").textContent = r.intro;
    const rs = $("roundScore");
    if (prevRound) {
      rs.hidden = false;
      rs.textContent = `Round ${prevRound.id}: ${roundScore} of ${prevRound.count} right · running total ${score}`;
    } else {
      rs.hidden = true;
    }
    roundScore = 0;
    show("round");
  }

  function renderQuestion() {
    const q = order[idx];
    const r = roundOf(q.round);
    $("qMeta").textContent = `Round ${q.round} · ${r.title}`;
    $("qText").textContent = q.question;
    $("progressLabel").textContent = `Question ${idx + 1} of ${order.length}`;
    $("progressBar").setAttribute("aria-valuenow", idx);
    $("progressFill").style.width = (idx / order.length) * 100 + "%";

    const box = $("qOptions");
    box.className = "options" + (q.type === "realfake" ? " realfake" : "");
    box.replaceChildren();
    q.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.dataset.value = opt;
      if (q.type === "mcq") {
        const key = document.createElement("span");
        key.className = "opt-key";
        key.setAttribute("aria-hidden", "true");
        key.textContent = "ABCD"[i];
        b.append(key);
      }
      const label = document.createElement("span");
      label.className = "opt-label";
      label.textContent = opt;
      b.append(label);
      b.addEventListener("click", () => answer(b, q));
      box.append(b);
    });
    $("feedback").hidden = true;
    $("liveRegion").textContent = "";
    show("question");
  }

  function mark(btn, text) {
    const m = document.createElement("span");
    m.className = "opt-mark";
    m.textContent = text;
    btn.append(m);
  }

  function answer(chosen, q) {
    const correct = chosen.dataset.value === q.answer;
    if (correct) { score++; roundScore++; }
    for (const b of $("qOptions").children) {
      b.disabled = true;
      if (b.dataset.value === q.answer) { b.classList.add("is-correct"); mark(b, "✓ Answer"); }
      else if (b === chosen) { b.classList.add("is-wrong"); mark(b, "✗ Your pick"); }
      else b.classList.add("is-dim");
    }
    const v = $("verdict");
    v.className = "verdict " + (correct ? "good" : "bad");
    v.textContent = correct ? "✓ Correct!" : `✗ Not quite. It's ${q.type === "realfake" ? q.answer.toUpperCase() : "“" + q.answer + "”"}.`;
    $("explain").textContent = q.explanation;
    const a = $("sourceLink");
    a.href = q.source_url;
    a.textContent = q.source_name;
    const last = idx === order.length - 1;
    const endOfRound = !last && order[idx + 1].round !== q.round;
    $("nextBtn").textContent = last ? "See my result" : endOfRound ? "Finish this round" : "Next question";
    $("feedback").hidden = false;
    $("progressBar").setAttribute("aria-valuenow", idx + 1);
    $("progressFill").style.width = ((idx + 1) / order.length) * 100 + "%";
    $("liveRegion").textContent = v.textContent + " " + q.explanation;
    $("nextBtn").focus({ preventScroll: true });
    $("feedback").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function next() {
    const q = order[idx];
    idx++;
    if (idx >= order.length) return showResults();
    if (order[idx].round !== q.round) {
      const count = order.filter((x) => x.round === q.round).length;
      return showRound(order[idx].round, { id: q.round, count });
    }
    renderQuestion();
  }

  function rank() {
    const ratio = score / order.length;
    return RANKS.find((r) => ratio >= r.min);
  }

  function showResults() {
    const r = rank();
    $("scoreNum").textContent = score;
    $("resultTitle").textContent = r.title;
    $("resultBlurb").textContent = r.blurb;
    show("results");
  }

  /* ── Share card ─────────────────────────────────────── */
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  async function buildCard() {
    try {
      await Promise.all([
        document.fonts.load('800 80px "DM Sans"'),
        document.fonts.load('500 200px "Literata"'),
        document.fonts.load('italic 400 40px "Literata"'),
      ]);
    } catch (_) { /* fall back to system fonts */ }

    // Always draw the card in the dark Souldraft palette so it looks the same everywhere.
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const bg = "#090f08", accent = "#68aa6e", text = "#dde5de", muted = "#a3b8a5";

    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, col, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col + a); g.addColorStop(1, col + "00");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };
    glow(160, 120, 760, accent, "55");
    glow(1000, 420, 620, "#6b8cff", "30");
    glow(420, 1360, 620, "#c490e8", "26");
    ctx.fillStyle = "rgba(104,170,110,0.22)";
    for (let y = 30; y < H * 0.6; y += 36) for (let x = 30; x < W; x += 36) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }

    // frame
    ctx.strokeStyle = "rgba(221,229,222,0.14)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(40, 40, W - 80, H - 80, 36); ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = muted; ctx.font = '700 34px "DM Sans", system-ui, sans-serif';
    ctx.fillText("ai × uk", 100, 140);
    const w1 = ctx.measureText("ai × uk ").width;
    ctx.fillStyle = accent; ctx.font = 'italic 400 36px "Literata", Georgia, serif';
    ctx.fillText("politics", 100 + w1, 140);

    ctx.fillStyle = text; ctx.font = '800 92px "DM Sans", system-ui, sans-serif';
    ctx.fillText("I scored", 100, 330);

    ctx.fillStyle = accent; ctx.font = '500 300px "Literata", Georgia, serif';
    const sNum = String(score);
    ctx.fillText(sNum, 92, 640);
    const sw = ctx.measureText(sNum).width;
    ctx.fillStyle = muted; ctx.font = '500 120px "Literata", Georgia, serif';
    ctx.fillText("/" + order.length, 92 + sw + 12, 640);

    const r = rank();
    ctx.fillStyle = text; ctx.font = '800 76px "DM Sans", system-ui, sans-serif';
    ctx.fillText(r.title, 100, 790);

    ctx.fillStyle = muted; ctx.font = 'italic 400 44px "Literata", Georgia, serif';
    wrapLines(ctx, "on the AI × UK Politics quiz. Game-changer or democracy-breaker?", W - 200)
      .forEach((l, i) => ctx.fillText(l, 100, 880 + i * 60));

    // CTA pill
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.roundRect(100, 1040, W - 200, 170, 24); ctx.fill();
    ctx.fillStyle = "#07110a"; ctx.textAlign = "center"; ctx.font = '800 48px "DM Sans", system-ui, sans-serif';
    ctx.fillText("Can you beat me?", W / 2, 1110);
    const host = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    let fs = 36;
    ctx.font = `600 ${fs}px "DM Sans", system-ui, sans-serif`;
    while (ctx.measureText(host).width > W - 260 && fs > 22) { fs -= 2; ctx.font = `600 ${fs}px "DM Sans", system-ui, sans-serif`; }
    ctx.fillText(host, W / 2, 1168);

    return new Promise((resolve) => c.toBlob(resolve, "image/png"));
  }

  async function openShare() {
    $("shareBtn").disabled = true;
    $("shareStatus").textContent = "";
    shareBlob = await buildCard();
    $("shareBtn").disabled = false;
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = URL.createObjectURL(shareBlob);
    const img = $("shareImg");
    img.src = shareUrl;
    img.alt = `Share card: I scored ${score} out of ${order.length}, ${rank().title}, on the AI × UK Politics quiz.`;
    $("downloadBtn").href = shareUrl;
    const file = new File([shareBlob], "ai-uk-politics-quiz.png", { type: "image/png" });
    $("shareNativeBtn").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    show("share");
  }

  async function nativeShare() {
    const file = new File([shareBlob], "ai-uk-politics-quiz.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "AI × UK Politics quiz", text: `I scored ${score}/${order.length}. Can you beat me? ${SITE_URL}` });
      $("shareStatus").textContent = "Shared.";
    } catch (err) {
      if (err && err.name !== "AbortError") $("shareStatus").textContent = "Sharing didn't work here. Use Download PNG instead.";
    }
  }

  $("startBtn").addEventListener("click", start);
  $("roundBtn").addEventListener("click", renderQuestion);
  $("nextBtn").addEventListener("click", next);
  $("shareBtn").addEventListener("click", openShare);
  $("shareNativeBtn").addEventListener("click", nativeShare);
  $("backBtn").addEventListener("click", () => show("results"));
  $("restartBtn").addEventListener("click", () => show("landing"));
  $("downloadBtn").addEventListener("click", () => { $("shareStatus").textContent = "Saved to your downloads."; });

  load();

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
