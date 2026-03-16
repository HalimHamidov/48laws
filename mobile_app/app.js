const WORDS_PER_DAY = 15;
const DATA_URL = "./48laws_frequency_ru.json";

const $status = document.getElementById("status");
const $cards = document.getElementById("cards");
const cardTpl = document.getElementById("cardTemplate");

const STORAGE_KEY = "vocab48_state_v1";
const TODAY_KEY = "vocab48_today_v1";

let words = [];
let byKey = new Map();
let state = null;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { progress: {} };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { progress: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function intervalDays(timesSeen, grade) {
  const map = {
    again: 1,
    hard: Math.max(1, Math.floor(timesSeen <= 2 ? 2 : 3)),
    good: [2, 4, 7, 14, 30][Math.min(timesSeen, 4)],
    easy: [4, 7, 14, 30, 45][Math.min(timesSeen, 4)],
  };
  return map[grade] || 2;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function progressOf(key) {
  if (!state.progress[key]) {
    state.progress[key] = { timesSeen: 0, dueDate: isoToday(), lastDate: null };
  }
  return state.progress[key];
}

function dueWords(today, limit) {
  return words
    .filter((w) => progressOf(w.key).dueDate <= today)
    .sort((a, b) => {
      const pa = progressOf(a.key);
      const pb = progressOf(b.key);
      if (pa.dueDate !== pb.dueDate) return pa.dueDate.localeCompare(pb.dueDate);
      return a.rank - b.rank;
    })
    .slice(0, limit);
}

function newWords(limit, usedSet) {
  const list = [];
  for (const w of words) {
    if (list.length >= limit) break;
    if (usedSet.has(w.key)) continue;
    if (progressOf(w.key).timesSeen === 0) {
      list.push(w);
      usedSet.add(w.key);
    }
  }
  return list;
}

function oldestWords(limit, usedSet) {
  return words
    .filter((w) => !usedSet.has(w.key))
    .sort((a, b) => {
      const pa = progressOf(a.key).lastDate || "1970-01-01";
      const pb = progressOf(b.key).lastDate || "1970-01-01";
      if (pa !== pb) return pa.localeCompare(pb);
      return a.rank - b.rank;
    })
    .slice(0, limit);
}

function pickBatch(mode) {
  const today = isoToday();
  const used = new Set();
  let batch = [];

  if (mode === "review") {
    batch = dueWords(today, WORDS_PER_DAY);
    return batch;
  }

  const reviewTarget = Math.max(1, Math.round(WORDS_PER_DAY * 0.4));
  const rev = dueWords(today, reviewTarget);
  rev.forEach((w) => used.add(w.key));
  batch.push(...rev);

  if (batch.length < WORDS_PER_DAY) {
    batch.push(...newWords(WORDS_PER_DAY - batch.length, used));
  }
  if (batch.length < WORDS_PER_DAY) {
    batch.push(...oldestWords(WORDS_PER_DAY - batch.length, used));
  }
  return batch.slice(0, WORDS_PER_DAY);
}

function storeTodayBatch(keys) {
  localStorage.setItem(
    TODAY_KEY,
    JSON.stringify({
      date: isoToday(),
      keys,
    })
  );
}

function loadTodayBatch() {
  const raw = localStorage.getItem(TODAY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== isoToday()) return null;
    return parsed.keys
      .map((k) => byKey.get(k))
      .filter(Boolean);
  } catch {
    return null;
  }
}

function applyGrade(wordKey, grade) {
  const today = isoToday();
  const p = progressOf(wordKey);
  p.timesSeen += 1;
  p.lastDate = today;
  p.dueDate = addDays(today, intervalDays(p.timesSeen, grade));
  saveState();
}

function renderCards(batch, modeLabel) {
  $cards.innerHTML = "";
  $status.textContent = `${modeLabel}: ${batch.length} слов`;

  batch.forEach((w, i) => {
    const node = cardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector(".idx").textContent = `#${i + 1}`;
    node.querySelector(".badge").textContent = w.timesSeen > 0 ? "Review" : "New";
    node.querySelector(".word").textContent = w.word;
    node.querySelector(".translation").textContent = w.translation_ru || "—";
    node.querySelector(".example").textContent = w.example_from_book
      ? `Example: ${w.example_from_book}${w.example_page ? " (p." + w.example_page + ")" : ""}`
      : "Example: —";

    node.querySelectorAll("button[data-grade]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyGrade(w.key, btn.dataset.grade);
        btn.textContent = "Saved";
        btn.disabled = true;
      });
    });

    $cards.appendChild(node);
  });
}

function statsText() {
  const all = words.length;
  const items = Object.values(state.progress);
  const seen = items.filter((x) => x.timesSeen > 0).length;
  const due = items.filter((x) => x.dueDate <= isoToday()).length;
  return `Всего: ${all}, изучено: ${seen}, к ревью сегодня: ${due}`;
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось прочитать JSON");
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : payload.words;
  if (!Array.isArray(rows)) throw new Error("Неверная структура JSON");

  words = rows
    .map((r, i) => ({
      key: String((r.word || r.term || "")).trim().toLowerCase(),
      rank: Number(r.rank || i + 1),
      word: r.word || r.term || "",
      translation_ru: r.translation_ru || r.translation || null,
      example_from_book: r.example_from_book || r.example || null,
      example_page: r.example_page || null,
      timesSeen: 0,
    }))
    .filter((w) => w.key);

  words.sort((a, b) => a.rank - b.rank);
  byKey = new Map(words.map((w) => [w.key, w]));
}

function enrichWithProgress(batch) {
  return batch.map((w) => ({
    ...w,
    timesSeen: progressOf(w.key).timesSeen,
  }));
}

function initButtons() {
  document.getElementById("btnToday").addEventListener("click", () => {
    const cached = loadTodayBatch();
    const batch = cached || pickBatch("today");
    if (!cached) storeTodayBatch(batch.map((x) => x.key));
    renderCards(enrichWithProgress(batch), "Сегодня");
  });

  document.getElementById("btnNext").addEventListener("click", () => {
    const batch = pickBatch("next");
    renderCards(enrichWithProgress(batch), "Следующая пачка");
  });

  document.getElementById("btnReview").addEventListener("click", () => {
    const batch = pickBatch("review");
    renderCards(enrichWithProgress(batch), "Ревью");
  });

  document.getElementById("btnStats").addEventListener("click", () => {
    $status.textContent = statsText();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TODAY_KEY);
    state = readState();
    $cards.innerHTML = "";
    $status.textContent = "Прогресс сброшен";
  });
}

async function bootstrap() {
  try {
    state = readState();
    await loadData();
    initButtons();
    const firstBatch = loadTodayBatch() || pickBatch("today");
    storeTodayBatch(firstBatch.map((x) => x.key));
    renderCards(enrichWithProgress(firstBatch), "Сегодня");
    $status.textContent = `Готово. ${statsText()}`;
  } catch (err) {
    $status.textContent = "Ошибка: " + err.message;
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

bootstrap();
