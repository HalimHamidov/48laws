const WORDS_PER_DAY = 15;
const DATA_URL = "./48laws_frequency_ru.json";
const APP_BUILD = "2026-03-16-c";

const STORAGE_KEY = "vocab48_state_v3";
const TODAY_KEY = "vocab48_today_v3";
const REMINDER_KEY = "vocab48_reminder_v1";
const REMINDER_ENABLED_KEY = "vocab48_reminder_enabled_v1";
const REMINDER_ID = 48001;

const $status = document.getElementById("status");
const $cards = document.getElementById("cards");
const $searchInput = document.getElementById("searchInput");
const $reminderTime = document.getElementById("reminderTime");
const $wordCounter = document.getElementById("wordCounter");
const cardTpl = document.getElementById("cardTemplate");

let words = [];
let byKey = new Map();
let state = null;
let currentBatch = [];
let currentIndex = 0;
let currentModeLabel = "Сегодня";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isNativeApp() {
  try {
    if (!window.Capacitor) return false;
    if (typeof window.Capacitor.isNativePlatform === "function") {
      return window.Capacitor.isNativePlatform();
    }
    return true;
  } catch {
    return false;
  }
}

async function clearServiceWorkerCaches() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {}
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
  }
}

function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { progress: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { progress: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getReminderTime() {
  return localStorage.getItem(REMINDER_KEY) || "20:00";
}

function setReminderTime(value) {
  localStorage.setItem(REMINDER_KEY, value);
}

function isReminderEnabled() {
  return localStorage.getItem(REMINDER_ENABLED_KEY) === "1";
}

function setReminderEnabled(enabled) {
  localStorage.setItem(REMINDER_ENABLED_KEY, enabled ? "1" : "0");
}

function progressOf(key) {
  if (!state.progress[key]) {
    state.progress[key] = { timesSeen: 0, dueDate: isoToday(), lastDate: null };
  }
  return state.progress[key];
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

function etaLabel(days) {
  if (days <= 1) return "≈1 день";
  if (days < 5) return `≈${days} дня`;
  return `≈${days} дней`;
}

function estimateReturnDays(wordKey, grade) {
  const p = progressOf(wordKey);
  const nextSeen = p.timesSeen + 1;
  return intervalDays(nextSeen, grade);
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

  if (mode === "review") return dueWords(today, WORDS_PER_DAY);

  const reviewTarget = Math.max(1, Math.round(WORDS_PER_DAY * 0.4));
  const review = dueWords(today, reviewTarget);
  review.forEach((w) => used.add(w.key));
  batch.push(...review);

  if (batch.length < WORDS_PER_DAY) {
    batch.push(...newWords(WORDS_PER_DAY - batch.length, used));
  }
  if (batch.length < WORDS_PER_DAY) {
    batch.push(...oldestWords(WORDS_PER_DAY - batch.length, used));
  }
  return batch.slice(0, WORDS_PER_DAY);
}

function storeTodayBatch(keys) {
  localStorage.setItem(TODAY_KEY, JSON.stringify({ date: isoToday(), keys }));
}

function loadTodayBatch() {
  const raw = localStorage.getItem(TODAY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== isoToday()) return null;
    return parsed.keys.map((k) => byKey.get(k)).filter(Boolean);
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

function enrichWithProgress(list) {
  return list.map((w) => ({ ...w, timesSeen: progressOf(w.key).timesSeen }));
}

function updateCounter() {
  if (!currentBatch.length) {
    $wordCounter.textContent = "0 / 0";
    return;
  }
  $wordCounter.textContent = `${currentIndex + 1} / ${currentBatch.length}`;
}

function setBatch(list, modeLabel) {
  currentBatch = enrichWithProgress(list);
  currentIndex = 0;
  currentModeLabel = modeLabel;
  renderCurrentWord();
}

function renderCurrentWord() {
  $cards.innerHTML = "";
  updateCounter();

  if (!currentBatch.length) {
    $status.textContent = `${currentModeLabel}: 0 слов`;
    return;
  }

  const w = currentBatch[currentIndex];
  $status.textContent = `${currentModeLabel}: слово ${currentIndex + 1} из ${currentBatch.length}`;

  const node = cardTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".idx").textContent = `#${currentIndex + 1}`;
  node.querySelector(".badge").textContent = w.timesSeen > 0 ? "Review" : "New";
  node.querySelector(".word").textContent = w.word;
  node.querySelector(".translation").textContent = w.translation_ru || "—";
  node.querySelector(".example").textContent = w.example_from_book
    ? `Example: ${w.example_from_book}${w.example_page ? ` (p.${w.example_page})` : ""}`
    : "Example: —";

  node.querySelectorAll("button[data-grade]").forEach((btn) => {
    const grade = btn.dataset.grade;
    const eta = estimateReturnDays(w.key, grade);
    btn.querySelector(".eta").textContent = etaLabel(eta);
    btn.addEventListener("click", () => {
      applyGrade(w.key, grade);
      currentBatch[currentIndex].timesSeen = progressOf(w.key).timesSeen;
      goNextWord(true);
    });
  });

  $cards.appendChild(node);
}

function goNextWord(fromGrade = false) {
  if (!currentBatch.length) return;
  if (currentIndex < currentBatch.length - 1) {
    currentIndex += 1;
    renderCurrentWord();
    return;
  }
  if (fromGrade) {
    $status.textContent = `${currentModeLabel}: пачка завершена`;
  }
  renderCurrentWord();
}

function goPrevWord() {
  if (!currentBatch.length) return;
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderCurrentWord();
  }
}

function searchWords(rawQuery, limit = 200) {
  const q = normalizeText(rawQuery);
  if (!q) return [];
  const out = [];
  for (const w of words) {
    if (out.length >= limit) break;
    if (w.searchWord.includes(q) || w.searchTranslation.includes(q)) {
      out.push(w);
    }
  }
  return out;
}

function runSearch() {
  const q = $searchInput.value.trim();
  if (!q) {
    openToday();
    return;
  }
  const found = searchWords(q, 200);
  setBatch(found, `Поиск: найдено ${found.length}`);
}

function statsText() {
  const all = words.length;
  const items = Object.values(state.progress);
  const seen = items.filter((x) => x.timesSeen > 0).length;
  const due = items.filter((x) => x.dueDate <= isoToday()).length;
  return `Всего: ${all}, изучено: ${seen}, к ревью сегодня: ${due}`;
}

function getLocalNotificationsPlugin() {
  return window.Capacitor?.Plugins?.LocalNotifications || null;
}

function nextDateFor(hour, minute) {
  const now = new Date();
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

async function enableDailyReminder(timeValue) {
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    $status.textContent = "Напоминания доступны в Android APK (Capacitor).";
    return;
  }
  const [hourStr, minuteStr] = String(timeValue || "20:00").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    $status.textContent = "Неверный формат времени напоминания.";
    return;
  }

  try {
    const check = await plugin.checkPermissions();
    const perm = check.display === "granted" ? check : await plugin.requestPermissions();
    if (perm.display !== "granted") {
      $status.textContent = "Разрешение на уведомления не выдано.";
      return;
    }

    if (plugin.createChannel) {
      await plugin.createChannel({
        id: "daily_words",
        name: "Daily Words",
        description: "Daily reminder for vocabulary practice",
        importance: 5,
      });
    }

    const at = nextDateFor(hour, minute);
    await plugin.cancel({ notifications: [{ id: REMINDER_ID }] });
    await plugin.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: "48 Laws Vocab",
          body: "Открой приложение и повтори новые слова.",
          channelId: "daily_words",
          schedule: { at, repeats: true, every: "day" },
        },
      ],
    });
    setReminderTime(timeValue);
    setReminderEnabled(true);
    $status.textContent = `Ежедневное напоминание включено на ${timeValue}.`;
  } catch (err) {
    $status.textContent = `Ошибка напоминания: ${err.message}`;
  }
}

async function disableDailyReminder() {
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    $status.textContent = "Напоминания доступны в Android APK (Capacitor).";
    return;
  }
  try {
    await plugin.cancel({ notifications: [{ id: REMINDER_ID }] });
    setReminderEnabled(false);
    $status.textContent = "Ежедневное напоминание выключено.";
  } catch (err) {
    $status.textContent = `Ошибка отключения: ${err.message}`;
  }
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить JSON");
  const payload = await res.json();
  const rows = Array.isArray(payload) ? payload : payload.words;
  if (!Array.isArray(rows)) throw new Error("Неверная структура JSON");

  words = rows
    .map((r, i) => {
      const word = r.word || r.term || "";
      const tr = r.translation_ru || r.translation || "";
      return {
        key: String(word).trim().toLowerCase(),
        rank: Number(r.rank || i + 1),
        word,
        translation_ru: tr || null,
        example_from_book: r.example_from_book || r.example || null,
        example_page: r.example_page || null,
        searchWord: normalizeText(word),
        searchTranslation: normalizeText(tr),
      };
    })
    .filter((w) => w.key);

  words.sort((a, b) => a.rank - b.rank);
  byKey = new Map(words.map((w) => [w.key, w]));
}

function openToday() {
  const cached = loadTodayBatch();
  const batch = cached || pickBatch("today");
  if (!cached) storeTodayBatch(batch.map((x) => x.key));
  setBatch(batch, "Сегодня");
}

function openReview() {
  const batch = pickBatch("review");
  setBatch(batch, "Ревью");
}

function openNextBatch() {
  const batch = pickBatch("next");
  setBatch(batch, "Следующая пачка");
}

function initButtons() {
  document.getElementById("btnToday").addEventListener("click", openToday);
  document.getElementById("btnNext").addEventListener("click", openNextBatch);
  document.getElementById("btnReview").addEventListener("click", openReview);

  document.getElementById("btnBottomToday").addEventListener("click", openToday);
  document.getElementById("btnBottomReview").addEventListener("click", openReview);
  document.getElementById("btnBottomSearch").addEventListener("click", () => {
    $searchInput.focus();
    runSearch();
  });

  document.getElementById("btnPrevWord").addEventListener("click", goPrevWord);
  document.getElementById("btnNextWord").addEventListener("click", () => goNextWord(false));

  document.getElementById("btnStats").addEventListener("click", () => {
    $status.textContent = statsText();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TODAY_KEY);
    state = readState();
    currentBatch = [];
    currentIndex = 0;
    renderCurrentWord();
    $status.textContent = "Прогресс сброшен.";
  });

  document.getElementById("btnEnableReminder").addEventListener("click", async () => {
    await enableDailyReminder($reminderTime.value || "20:00");
  });

  document.getElementById("btnDisableReminder").addEventListener("click", async () => {
    await disableDailyReminder();
  });

  document.getElementById("btnClearSearch").addEventListener("click", () => {
    $searchInput.value = "";
    openToday();
  });

  document.getElementById("btnSearch").addEventListener("click", runSearch);

  $searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });
}

async function bootstrap() {
  try {
    if (isNativeApp()) {
      await clearServiceWorkerCaches();
    }

    state = readState();
    await loadData();
    $reminderTime.value = getReminderTime();
    initButtons();
    openToday();
    $status.textContent = `Готово (build ${APP_BUILD}). ${statsText()}`;

    if (isReminderEnabled()) {
      await enableDailyReminder($reminderTime.value || "20:00");
    }
  } catch (err) {
    $status.textContent = `Ошибка: ${err.message}`;
  }
}

if ("serviceWorker" in navigator && !isNativeApp()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

bootstrap();

