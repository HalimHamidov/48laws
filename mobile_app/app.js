const WORDS_PER_DAY = 15;
const DATA_URL = "./48laws_frequency_ru.json";
const APP_BUILD = "2026-03-16-d";

const STORAGE_KEY = "vocab48_state_v3";
const TODAY_KEY = "vocab48_today_v3";
const REMINDER_KEY = "vocab48_reminder_v1";
const REMINDER_ENABLED_KEY = "vocab48_reminder_enabled_v1";
const REMINDER_ID = 48001;

const AUTO_EXCLUDE_WORDS = new Set([
  "the","to","of","and","a","in","he","his","you","that","it","was","had","for","is","with","s","as","they",
  "on","your","him","but","not","their","this","be","by","would","them","will","who","one","at","from","an",
  "have","are","i","me","my","we","our","ours","us","she","her","hers","itself","himself","themselves","yours",
  "yourselves","if","or","so","than","then","there","these","those","what","when","where","which","while","whom",
  "why","can","could","should","do","does","did","done","into","out","up","down","over","under","before","after",
  "between","through","during","again","further","more","most","some","such","no","nor","too","very","just","am",
  "been","being","were","also","t","d","ll","re","ve","m","o","ii","iii","iv","v","vi","vii","viii","ix","x",
  "xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx","http","www","com"
]);

const AUTO_EXCLUDE_NAMES = new Set([
  "louis","kissinger","napoleon","caesar","borgia","machiavelli","sun","tzu","alexander","cleopatra",
  "metternich","fouquet","versailles","tsao","stalin","hitler","churchill","roosevelt","nixon","mao",
  "socrates","plato","aristotle","seneca","cicero","shakespeare","voltaire","newton","einstein","darwin",
  "washington","lincoln","franklin","medici","richelieu","charles","henry","elizabeth","victoria","joseph",
  "von","de","la","du","ibn"
]);

const AUTO_EXCLUDE_A1 = new Set([
  "go","come","make","take","give","get","put","say","tell","ask","work","play","look","see","watch","read",
  "write","speak","talk","listen","live","love","like","want","need","use","find","call","try","help","start",
  "stop","open","close","walk","run","sit","stand","eat","drink","buy","sell","pay","keep","leave","stay",
  "home","house","room","door","window","table","chair","street","city","country","school","book","water",
  "food","money","time","day","night","morning","evening","year","week","month","today","tomorrow","yesterday",
  "man","woman","boy","girl","child","family","friend","people","person","name","place","thing","world","life",
  "good","bad","big","small","new","old","young","long","short","high","low","right","left","first","last",
  "same","different","important","easy","hard","early","late","happy","sad","hot","cold","full","empty","free",
  "true","false","yes","ok","sorry","please","thanks","hello","hi","bye","maybe","really","always","never",
  "often","sometimes","here","there","inside","outside","around","near","far","next","back","front"
]);

const AUTO_EXCLUDE_STOPWORDS = new Set([
  "about","above","after","against","all","any","both","each","few","more","most","other","some","such","only",
  "own","same","so","than","too","very","can","just","don","should","now","off","once","because","being","below",
  "between","during","further","into","through","until","while","ourselves","yourself","yourselves","himself",
  "herself","itself","themselves","myself","ours","hers","theirs","its","whose","whereas","wherever","whenever",
  "whatever","whoever","whichever","without","within","upon","via","across","along","among","amongst","around",
  "behind","beside","besides","beyond","despite","except","inside","outside","toward","towards","underneath",
  "although","however","therefore","meanwhile","otherwise","perhaps","indeed","already","almost","rather","quite"
]);

const AUTO_EXCLUDE_COUNTRIES = new Set([
  "afghanistan","albania","algeria","andorra","angola","argentina","armenia","australia","austria","azerbaijan",
  "bahamas","bahrain","bangladesh","barbados","belarus","belgium","belize","benin","bhutan","bolivia",
  "bosnia","botswana","brazil","brunei","bulgaria","burkina","burundi","cambodia","cameroon","canada",
  "chad","chile","china","colombia","comoros","congo","croatia","cuba","cyprus","czech","denmark","djibouti",
  "dominica","ecuador","egypt","eritrea","estonia","eswatini","ethiopia","fiji","finland","france","gabon",
  "gambia","georgia","germany","ghana","greece","grenada","guatemala","guinea","guyana","haiti","honduras",
  "hungary","iceland","india","indonesia","iran","iraq","ireland","israel","italy","jamaica","japan","jordan",
  "kazakhstan","kenya","kiribati","kuwait","kyrgyzstan","laos","latvia","lebanon","lesotho","liberia","libya",
  "liechtenstein","lithuania","luxembourg","madagascar","malawi","malaysia","maldives","mali","malta",
  "mauritania","mauritius","mexico","moldova","monaco","mongolia","montenegro","morocco","mozambique","myanmar",
  "namibia","nauru","nepal","netherlands","nicaragua","niger","nigeria","norway","oman","pakistan","palau",
  "panama","paraguay","peru","philippines","poland","portugal","qatar","romania","russia","rwanda",
  "samoa","senegal","serbia","seychelles","singapore","slovakia","slovenia","somalia","spain","sudan",
  "suriname","sweden","switzerland","syria","taiwan","tajikistan","tanzania","thailand","togo","tonga",
  "tunisia","turkey","turkmenistan","tuvalu","uganda","ukraine","uruguay","uzbekistan","vanuatu","venezuela",
  "vietnam","yemen","zambia","zimbabwe","england","scotland","wales","britain","uk","usa","america"
]);

const AUTO_EXCLUDE_NAMES_EXTRA = new Set([
  "henri","francois","marie","jean","pierre","antoine","jacques","alfonso","isabella","ferdinand","philip",
  "louie","loui","ludwig","wilhelm","otto","frederick","catherine","romanov","ivan","peter","nicholas",
  "thomas","edward","george","richard","anne","mary","john","paul","michael","william","james","robert",
  "arthur","bismarck","talleyand","talleyrand","metternich","fouche","fouchet","rothschild","medicis",
  "habsburg","prussia","austria","francis","cesare","lorenzo","giuliano","maoism","confucius","han","qin","chu"
]);

// Practical heuristic: remove high-frequency vocabulary (roughly A1-B2 band).
// Approximation: in this corpus, top ~11k frequent words are treated as CEFR A1-B2.
const CEFR_B2_MAX_RANK = 11000;
const ADVANCED_MIN_RANK = CEFR_B2_MAX_RANK + 1;

const LEVELS_100 = [
  { title: "Scout", badge: "Seed Scout 🌱" },
  { title: "Seeker", badge: "Pattern Seeker 🔍" },
  { title: "Practitioner", badge: "Calm Strategist ♟️" },
  { title: "Operator", badge: "Quiet Operator 🛡️" },
  { title: "Tactician", badge: "Tactical Mind 🧭" },
  { title: "Architect", badge: "Influence Architect 🏛️" },
  { title: "Commander", badge: "Precision Commander 🎯" },
  { title: "Strategist", badge: "Long Game Strategist 🧠" },
  { title: "Mastermind", badge: "Power Reader 📜" },
  { title: "Grandmaster", badge: "Iron Will 👑" },
];

const LAW_MORALS = [
  "Сила в сдержанности: не затмевай того, кто выше тебя.",
  "Доверяй делам, а не красивым словам.",
  "Скрывай намерения, пока не пришло время действия.",
  "Говори меньше, чтобы вес твоих слов рос.",
  "Репутация — щит: береги ее как капитал.",
  "Внимание — валюта влияния: умей быть заметным.",
  "Используй рычаги, а не только собственные силы.",
  "Пусть люди сами приходят к тебе на твоих условиях.",
  "Побеждай результатом, не спором.",
  "Эмоции заразны: держись подальше от хаоса.",
  "Делай так, чтобы людям было выгодно быть рядом с тобой.",
  "Честность сигнала важнее объема обещаний.",
  "Проси точечно: удар в слабое место эффективнее лобовой атаки.",
  "Вежливость может быть формой стратегии.",
  "Уничтожай риск до того, как он окрепнет.",
  "Отсутствие делает ценность выше.",
  "Непредсказуемость ломает чужой контроль.",
  "Изоляция ослабляет: сохраняй сеть контактов.",
  "Знай собеседника глубже, чем он ожидает.",
  "Не привязывайся к одному сценарию — адаптируйся.",
  "Иногда слабость на показ экономит силы.",
  "Сдайся вовремя, чтобы выиграть позже.",
  "Концентрируй ресурсы в точке максимального эффекта.",
  "Действуй как мастер, даже когда учишься.",
  "Меняй образ, если он мешает росту.",
  "Руки чистые, но контроль полный.",
  "Используй потребность людей в надежде.",
  "Входи в действие смело, иначе не входи вовсе.",
  "Планируй до финала, а не до первого успеха.",
  "Победа должна выглядеть естественно.",
  "Контролируй варианты выбора у других.",
  "Игра с воображением сильнее сухих приказов.",
  "Находи болевую точку системы, не только человека.",
  "Будь зеркалом: отражение обезоруживает.",
  "Соблюдай момент: время решает половину исхода.",
  "Пренебрежение иногда сильнее ответа.",
  "Создай зрелище, чтобы усилить смысл.",
  "Мысли свободно, но говори с учетом среды.",
  "Взбалтывай устойчивые схемы, когда нужен прорыв.",
  "Не презирай то, что пока мало: из малого растет крупное.",
  "Подача важна не меньше содержания.",
  "Бей пастуха — стадо рассеется.",
  "Работай по сердцам и чувствам, не только по логике.",
  "Разоружай подарком там, где ждут удара.",
  "Проповедуй перемены, но дозируй их.",
  "Не залезай в грязь, если хочешь остаться опорой.",
  "Не давай себе застыть в одной роли.",
  "Точность и мера превращают силу в искусство."
];

const $status = document.getElementById("status");
const $cards = document.getElementById("cards");
const $searchInput = document.getElementById("searchInput");
const $reminderTime = document.getElementById("reminderTime");
const $wordCounter = document.getElementById("wordCounter");
const $helpDialog = document.getElementById("helpDialog");
const cardTpl = document.getElementById("cardTemplate");

let words = [];
let byKey = new Map();
let state = null;
let currentBatch = [];
let currentIndex = 0;
let currentModeLabel = "Сегодня";

function setStatusText(message) {
  $status.classList.remove("status-card");
  $status.textContent = message;
}

function setStatusHtml(html) {
  $status.classList.add("status-card");
  $status.innerHTML = html;
}

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
    state.progress[key] = { timesSeen: 0, dueDate: isoToday(), lastDate: null, excluded: false };
  }
  return state.progress[key];
}

function shouldAutoExclude(word, rank) {
  if (!word) return true;
  if (AUTO_EXCLUDE_WORDS.has(word)) return true;
  if (AUTO_EXCLUDE_NAMES.has(word)) return true;
  if (AUTO_EXCLUDE_NAMES_EXTRA.has(word)) return true;
  if (AUTO_EXCLUDE_A1.has(word)) return true;
  if (AUTO_EXCLUDE_STOPWORDS.has(word)) return true;
  if (AUTO_EXCLUDE_COUNTRIES.has(word)) return true;
  if (Number.isFinite(rank) && rank > 0 && rank <= CEFR_B2_MAX_RANK) return true;
  if (/^[a-z]$/.test(word)) return true;
  if (/^[ivxlcdm]+$/.test(word)) return true;
  if (/^[a-z]{1,2}$/.test(word)) return true;
  if (word.length <= 1) return true;
  return false;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function intervalDays(timesSeen, grade) {
  if (grade === "exclude") return 99999;
  const map = {
    again: 1,
    hard: Math.max(1, Math.floor(timesSeen <= 2 ? 2 : 3)),
    good: 3,
    easy: [4, 7, 14, 30, 45][Math.min(timesSeen, 4)],
  };
  return map[grade] || 2;
}

function etaLabel(days) {
  if (days <= 1) return "\u22481 day";
  return `\u2248${days} days`;
}

function showIpaForWord(w) {
  return Number.isFinite(w.rank) && w.rank >= ADVANCED_MIN_RANK && Boolean(w.ipa);
}

function estimateReturnDays(wordKey, grade) {
  if (grade === "exclude") return 99999;
  const p = progressOf(wordKey);
  const nextSeen = p.timesSeen + 1;
  return intervalDays(nextSeen, grade);
}

function dueWords(today, limit) {
  return words
    .filter((w) => {
      const p = progressOf(w.key);
      return !p.excluded && p.dueDate <= today;
    })
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
    const p = progressOf(w.key);
    if (!p.excluded && p.timesSeen === 0) {
      list.push(w);
      usedSet.add(w.key);
    }
  }
  return list;
}

function oldestWords(limit, usedSet) {
  return words
    .filter((w) => !usedSet.has(w.key) && !progressOf(w.key).excluded)
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
  if (grade === "exclude") {
    p.excluded = true;
    p.lastDate = today;
    p.dueDate = "9999-12-31";
    saveState();
    return;
  }
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
    setStatusText(`${currentModeLabel}: 0 слов`);
    return;
  }

  const w = currentBatch[currentIndex];
  setStatusText(`${currentModeLabel}: слово ${currentIndex + 1} из ${currentBatch.length}`);
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".idx").textContent = `#${currentIndex + 1}`;
  const badge = node.querySelector(".badge");
  const isReview = w.timesSeen > 0;
  badge.textContent = isReview ? "REVIEW" : "NEW";
  badge.classList.add(isReview ? "badge-review" : "badge-new");
  node.querySelector(".word").textContent = w.word;
  const ipaDetailsEl = node.querySelector(".ipa-details");
  const ipaEl = node.querySelector(".ipa");
  if (showIpaForWord(w)) {
    ipaEl.textContent = `IPA: /${w.ipa}/`;
    ipaDetailsEl.style.display = "";
  } else {
    ipaDetailsEl.style.display = "none";
  }
  node.querySelector(".translation").textContent = w.translation_ru || "—";
  node.querySelector(".example").textContent = w.example_from_book
    ? `Example: ${w.example_from_book}${w.example_page ? ` (p.${w.example_page})` : ""}`
    : "Example: —";

  node.querySelectorAll("button[data-grade]").forEach((btn) => {
    const grade = btn.dataset.grade;
    if (grade === "exclude") {
      btn.querySelector(".eta").textContent = "no repeats";
    } else if (grade === "good") {
      btn.querySelector(".eta").textContent = "\u22483 days";
    } else {
      const eta = estimateReturnDays(w.key, grade);
      btn.querySelector(".eta").textContent = etaLabel(eta);
    }
    btn.addEventListener("click", () => {
      applyGrade(w.key, grade);
      currentBatch[currentIndex].timesSeen = progressOf(w.key).timesSeen;
      goNextWord(true);
    });
  });

  node.querySelectorAll("button[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    if (action === "review") {
      btn.addEventListener("click", () => {
        openReview();
      });
    }
  });

  attachSwipeNavigation(node);
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
    setStatusText(`${currentModeLabel}: пачка завершена`);
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

function attachSwipeNavigation(cardEl) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let decided = false;
  let isHorizontal = false;
  const MIN_SWIPE_X = 55;
  const MIN_AXIS_DIFF = 16;

  cardEl.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
    decided = false;
    isHorizontal = false;
  }, { passive: true });

  cardEl.addEventListener("touchmove", (e) => {
    if (!tracking || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (!decided && (Math.abs(dx) > MIN_AXIS_DIFF || Math.abs(dy) > MIN_AXIS_DIFF)) {
      decided = true;
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
  }, { passive: true });

  cardEl.addEventListener("touchend", (e) => {
    if (!tracking || !e.changedTouches || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    tracking = false;

    if (!isHorizontal || Math.abs(dx) < MIN_SWIPE_X || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    if (dx < 0) {
      goNextWord(false); // swipe left -> next
    } else {
      goPrevWord(); // swipe right -> previous
    }
  }, { passive: true });
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

function collectStats() {
  const all = words.length;
  const today = isoToday();
  let excluded = 0;
  let seenActive = 0;
  let dueActive = 0;

  for (const w of words) {
    const p = progressOf(w.key);
    if (p.excluded) {
      excluded += 1;
      continue;
    }
    if (p.timesSeen > 0) seenActive += 1;
    if (p.dueDate <= today) dueActive += 1;
  }

  const activeTotal = Math.max(0, all - excluded);
  const percent = activeTotal > 0 ? ((seenActive / activeTotal) * 100).toFixed(1) : "0.0";

  const milestone = 100;
  const completedHundreds = Math.floor(seenActive / milestone);
  const inCurrentHundred = seenActive % milestone;
  const toNextHundred = inCurrentHundred === 0 ? (seenActive === 0 ? milestone : 0) : (milestone - inCurrentHundred);

  let levelTitle = "Starter";
  let achievement = "First Steps \u{1F9E9}";
  let moral = "Consistency beats intensity. Secure your first 100 words.";

  if (completedHundreds > 0) {
    const levelIdx = (completedHundreds - 1) % LEVELS_100.length;
    const prestige = Math.floor((completedHundreds - 1) / LEVELS_100.length);
    const base = LEVELS_100[levelIdx];
    levelTitle = prestige > 0 ? `${base.title}+${prestige}` : base.title;
    achievement = base.badge;
    moral = LAW_MORALS[(completedHundreds - 1) % LAW_MORALS.length];
  }

  const stars = completedHundreds > 0 ? "\u2B50".repeat(Math.min(completedHundreds, 10)) : "\u2014";

  return {
    all,
    excluded,
    activeTotal,
    seenActive,
    percent,
    dueActive,
    inCurrentHundred,
    toNextHundred,
    levelTitle,
    achievement,
    stars,
    moral,
  };
}

function statsText() {
  const s = collectStats();

  return [
    `Total words: ${s.all}`,
    `Excluded: ${s.excluded}`,
    `Active words: ${s.activeTotal}`,
    `Learned (active): ${s.seenActive} (${s.percent}%)`,
    `Due today: ${s.dueActive}`,
    `100-block progress: ${s.inCurrentHundred}/100`,
    `To next level (100): ${s.toNextHundred}`,
    `Level: ${s.levelTitle}`,
    `Achievement: ${s.achievement}`,
    `Stars: ${s.stars}`,
    `Moral of this stage: ${s.moral}`,
  ].join("\n");
}

function statsHtml() {
  const s = collectStats();
  return `
<strong>Statistics</strong>
<br>Words: ${s.seenActive}/${s.activeTotal} (${s.percent}%)
<br>Review today: ${s.dueActive}
<br>Progress 100-block: ${s.inCurrentHundred}/100
<br>Next level in: ${s.toNextHundred}
<br>Level: ${s.levelTitle}
<br>Achievement: ${s.achievement}
<br>Stars: ${s.stars}
<br>Moral: ${s.moral}
  `.trim();
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
    setStatusText("Напоминания доступны в Android APK (Capacitor).");
    return;
  }
  const [hourStr, minuteStr] = String(timeValue || "20:00").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    setStatusText("Неверный формат времени напоминания.");
    return;
  }

  try {
    const check = await plugin.checkPermissions();
    const perm = check.display === "granted" ? check : await plugin.requestPermissions();
    if (perm.display !== "granted") {
      setStatusText("Разрешение на уведомления не выдано.");
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
    setStatusText(`Ежедневное напоминание включено на ${timeValue}.`);
  } catch (err) {
    setStatusText(`Ошибка напоминания: ${err.message}`);
  }
}

async function disableDailyReminder() {
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    setStatusText("Напоминания доступны в Android APK (Capacitor).");
    return;
  }
  try {
    await plugin.cancel({ notifications: [{ id: REMINDER_ID }] });
    setReminderEnabled(false);
    setStatusText("Ежедневное напоминание выключено.");
  } catch (err) {
    setStatusText(`Ошибка отключения: ${err.message}`);
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
        ipa: String(r.ipa || "").trim() || null,
        example_from_book: r.example_from_book || r.example || null,
        example_page: r.example_page || null,
        searchWord: normalizeText(word),
        searchTranslation: normalizeText(tr),
      };
    })
    .filter((w) => w.key);

  words.sort((a, b) => a.rank - b.rank);
  byKey = new Map(words.map((w) => [w.key, w]));

  for (const w of words) {
    if (shouldAutoExclude(w.key, w.rank)) {
      const p = progressOf(w.key);
      p.excluded = true;
      if (p.dueDate <= isoToday()) {
        p.dueDate = "9999-12-31";
      }
    }
  }
  saveState();
}

function openToday() {
  const cached = loadTodayBatch();
  const filteredCached = cached ? cached.filter((w) => !progressOf(w.key).excluded) : null;
  const batch = (filteredCached && filteredCached.length > 0) ? filteredCached : pickBatch("today");
  if (!filteredCached) storeTodayBatch(batch.map((x) => x.key));
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

function openHelpDialog() {
  if (!$helpDialog) return;
  if (typeof $helpDialog.showModal === "function") {
    $helpDialog.showModal();
    return;
  }
  $helpDialog.setAttribute("open", "open");
}

function closeHelpDialog() {
  if (!$helpDialog) return;
  if (typeof $helpDialog.close === "function") {
    $helpDialog.close();
    return;
  }
  $helpDialog.removeAttribute("open");
}

function initButtons() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };

  on("btnToday", openToday);
  on("btnNext", openNextBatch);
  on("btnReview", openReview);

  on("btnBottomToday", openToday);
  on("btnBottomReview", openReview);
  on("btnBottomSearch", () => {
    $searchInput.focus();
    runSearch();
  });

  on("btnPrevWord", goPrevWord);
  on("btnNextWord", () => goNextWord(false));

  on("btnStats", () => {
    setStatusHtml(statsHtml());
  });
  on("btnHelp", openHelpDialog);
  on("btnCloseHelp", closeHelpDialog);
  $helpDialog?.addEventListener("click", (e) => {
    if (e.target === $helpDialog) closeHelpDialog();
  });

  on("btnReset", () => {
    if (!confirm("Сбросить весь прогресс?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TODAY_KEY);
    state = readState();
    currentBatch = [];
    currentIndex = 0;
    renderCurrentWord();
    setStatusText("Прогресс сброшен.");
  });

  on("btnEnableReminder", async () => {
    await enableDailyReminder($reminderTime.value || "20:00");
  });

  on("btnDisableReminder", async () => {
    await disableDailyReminder();
  });

  on("btnClearSearch", () => {
    $searchInput.value = "";
    openToday();
  });

  on("btnSearch", runSearch);

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
    setStatusText(`Ready (build ${APP_BUILD}). Tap Stats for summary.`);
    if (isReminderEnabled()) {
      await enableDailyReminder($reminderTime.value || "20:00");
    }
  } catch (err) {
    setStatusText(`Ошибка: ${err.message}`);
  }
}

if ("serviceWorker" in navigator && !isNativeApp()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

bootstrap();
