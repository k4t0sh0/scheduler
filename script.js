const database = window.firebase ? firebase.database() : null;
const auth = window.firebase ? firebase.auth() : null;

let currentUser = null;
let isAnonymous = false;
let wheelIndex = 0;
const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"];

let currentStep = 1;
let currentDay = "monday";
let scheduleData = [];
let itemsData = [];
let whiteboardText = "";
let classCount = 6;
let classDuration = 50;
let dismissalHour = 16;
let dismissalMin = 50;
let selectedRecipients = [];
let scheduleDate = "tomorrow";
let customDateValue = "";
let customTimeValue = "";
let lettersData = [];
let testsData = [];
let hasCommittee = false;
let recipientList = ["katokato.s.javas@gmail.com"];

const SUBJECT_LIST = [
  "国語",
  "数学",
  "英語",
  "理科",
  "社会",
  "体育",
  "音楽",
  "美術",
  "技術",
  "家庭科",
  "総合",
  "学活",
  "道徳",
  "委員会",
  "テスト",
  "なし",
];

const SUBJECT_COLOR_KEYS = {
  国語: "kokugo",
  数学: "math",
  英語: "english",
  理科: "science",
  社会: "social",
  体育: "pe",
  音楽: "music",
  美術: "art",
  技術: "technology",
  家庭科: "home-ec",
  総合: "integrated",
  学活: "homeroom",
  道徳: "morals",
  委員会: "committee",
  テスト: "test",
  なし: "none",
};

function applySubjectColor(row, subject) {
  if (!row) return;
  const colorKey = SUBJECT_COLOR_KEYS[subject] || "none";
  row.querySelectorAll(".subject-select, .desc-input").forEach((input) => {
    input.dataset.subjectColor = colorKey;
  });
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function sanitizeMemoHtml(html) {
  const safe = document.createDocumentFragment();
  const parsed = new DOMParser().parseFromString(
    String(html ?? ""),
    "text/html",
  );
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P"]);
  const blocked = new Set([
    "SCRIPT",
    "STYLE",
    "IFRAME",
    "OBJECT",
    "SVG",
    "MATH",
  ]);

  function clone(node, target) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (blocked.has(node.tagName)) return;
    const tag = allowed.has(node.tagName) ? node.tagName.toLowerCase() : "";
    if (!tag) {
      for (const child of node.childNodes) clone(child, target);
      return;
    }
    const el = document.createElement(tag);
    for (const child of node.childNodes) clone(child, el);
    target.appendChild(el);
  }

  for (const child of parsed.body.childNodes) clone(child, safe);
  return safe;
}

function getDefaultSchedule() {
  return [
    { period: 1, subject: "国語", description: "" },
    { period: 2, subject: "数学", description: "" },
    { period: 3, subject: "社会", description: "" },
    { period: 4, subject: "理科", description: "" },
    { period: 5, subject: "英語", description: "" },
    { period: 6, subject: "家庭科", description: "" },
  ];
}

function getErrorMessage(code) {
  const map = {
    "auth/invalid-email": "メールアドレスの形式が正しくありません",
    "auth/user-not-found": "ユーザーが見つかりません",
    "auth/wrong-password": "パスワードが間違っています",
    "auth/email-already-in-use": "このメールアドレスは既に使用されています",
    "auth/weak-password": "パスワードは6文字以上で設定してください",
    "auth/too-many-requests":
      "試行回数が多すぎます。しばらくしてからお試しください",
  };
  return map[code] || `エラーが発生しました: ${code}`;
}

function showAuth() {
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");
  if (authScreen) authScreen.style.display = "flex";
  if (appScreen) appScreen.style.display = "none";
}

function showApp() {
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");
  if (authScreen) authScreen.style.display = "none";
  if (appScreen) appScreen.style.display = "flex";
  displayDate();
  updateUserDisplay();
  showHomeView();
  initDayButtons();
}

function showLogin() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authError = document.getElementById("authError");
  if (loginForm) loginForm.style.display = "block";
  if (registerForm) registerForm.style.display = "none";
  if (authError) authError.textContent = "";
}

function showRegister() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authError = document.getElementById("authError");
  if (loginForm) loginForm.style.display = "none";
  if (registerForm) registerForm.style.display = "block";
  if (authError) authError.textContent = "";
}

async function login() {
  const email = document.getElementById("loginEmail")?.value || "";
  const password = document.getElementById("loginPassword")?.value || "";
  try {
    if (!auth) return;
    await auth.signInWithEmailAndPassword(email, password);
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = "";
  } catch (e) {
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = getErrorMessage(e.code);
  }
}

async function register() {
  const email = document.getElementById("registerEmail")?.value || "";
  const password = document.getElementById("registerPassword")?.value || "";
  try {
    if (!auth) return;
    await auth.createUserWithEmailAndPassword(email, password);
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = "";
  } catch (e) {
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = getErrorMessage(e.code);
  }
}

async function anonymousLogin() {
  try {
    if (!auth) return;
    await auth.signInAnonymously();
  } catch (_) {
    const authError = document.getElementById("authError");
    if (authError) authError.textContent = "ログインに失敗しました";
  }
}

async function logout() {
  saveMemo();
  if (auth) await auth.signOut();
}

function displayDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const w = days[today.getDay()];
  const dateDisplay = document.getElementById("dateDisplay");
  if (dateDisplay) dateDisplay.textContent = `${y}-${m}-${d}（${w}）`;
}

function updateUserDisplay() {
  const userEmail = document.getElementById("userEmail");
  if (userEmail) {
    userEmail.textContent = isAnonymous
      ? "匿名ユーザー"
      : currentUser?.email || "";
  }
}

function loadData() {
  if (!database) return;
  database.ref("schoolSchedule/shared").once("value", (snapshot) => {
    const data = snapshot.val() || {};

    if (data.memo) {
      const memoBox = document.getElementById("memoBox");
      if (memoBox) {
        memoBox.innerHTML = "";
        memoBox.appendChild(sanitizeMemoHtml(data.memo));
      }
    }

    if (Array.isArray(data.recipients)) recipientList = data.recipients;
    if (Array.isArray(data.letters)) lettersData = data.letters;
    if (Array.isArray(data.tests)) testsData = data.tests;
    if (
      typeof data.scheduledDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate)
    ) {
      customDateValue = data.scheduledDate;
    }
    if (["tomorrow", "nextMonday", "custom"].includes(data.scheduleDateType)) {
      scheduleDate = data.scheduleDateType;
    }

    loadDayData(currentDay, data);
    updateSelectedDateDisplay();
  });
}

function loadDayData(day, data) {
  if (!data || !data[day]) {
    scheduleData = getDefaultSchedule();
    itemsData = [];
    whiteboardText = "";
    classCount = 6;
    classDuration = 50;
    dismissalHour = 16;
    dismissalMin = 50;
    hasCommittee = false;
    renderCurrentStep();
    return;
  }

  const dayData = data[day];
  scheduleData = Array.isArray(dayData.schedule)
    ? dayData.schedule
    : getDefaultSchedule();
  itemsData = Array.isArray(dayData.items) ? dayData.items : [];
  whiteboardText = typeof dayData.event === "string" ? dayData.event : "";
  classCount = dayData.classCount ?? 6;
  classDuration = dayData.classDuration ?? 50;
  dismissalHour = dayData.dismissalHour ?? 16;
  dismissalMin = dayData.dismissalMin ?? 50;
  hasCommittee = Boolean(dayData.hasCommittee);
  renderCurrentStep();
}

function saveMemo() {
  if (!database || !currentUser || isAnonymous) return;
  const memoBox = document.getElementById("memoBox");
  if (memoBox) {
    database.ref("schoolSchedule/shared/memo").set(memoBox.innerHTML);
  }
}

function saveToFirebase() {
  if (!database || !currentUser || isAnonymous) return;
  database.ref(`schoolSchedule/shared/${currentDay}`).set({
    schedule: scheduleData,
    items: itemsData,
    event: whiteboardText,
    classDuration,
    classCount,
    dismissalHour,
    dismissalMin,
    hasCommittee,
  });
  database.ref("schoolSchedule/shared/recipients").set(recipientList);
  database.ref("schoolSchedule/shared/letters").set(lettersData);
  database.ref("schoolSchedule/shared/tests").set(testsData);
  const scheduledDate = getScheduledDateForFirebase();
  if (scheduledDate) {
    database.ref("schoolSchedule/shared").update({
      scheduledDate,
      scheduleDateType: scheduleDate,
    });
  }
  saveMemo();
}

function showHomeView() {
  const homeView = document.getElementById("homeView");
  const wizardView = document.getElementById("wizardView");
  const calendarView = document.getElementById("calendarView");
  const headerCenter = document.getElementById("headerCenter");
  if (homeView) homeView.style.display = "flex";
  if (wizardView) wizardView.style.display = "none";
  if (calendarView) calendarView.style.display = "none";
  if (headerCenter) {
    headerCenter.innerHTML = `<button class="header-mode-btn ai" data-action="show-calendar">📅 カレンダー</button>`;
  }
}

function showCalendarView() {
  const homeView = document.getElementById("homeView");
  const wizardView = document.getElementById("wizardView");
  const calendarView = document.getElementById("calendarView");
  const headerCenter = document.getElementById("headerCenter");
  if (homeView) homeView.style.display = "none";
  if (wizardView) wizardView.style.display = "none";
  if (calendarView) calendarView.style.display = "flex";
  if (headerCenter) {
    headerCenter.innerHTML = `<button class="header-mode-btn ai" data-action="show-home">⌂ ホーム</button>`;
  }
}

function startManual() {
  const homeView = document.getElementById("homeView");
  const wizardView = document.getElementById("wizardView");
  const calendarView = document.getElementById("calendarView");
  const headerCenter = document.getElementById("headerCenter");
  if (homeView) homeView.style.display = "none";
  if (wizardView) wizardView.style.display = "flex";
  if (calendarView) calendarView.style.display = "none";
  if (headerCenter) {
    headerCenter.innerHTML = `<button class="header-mode-btn manual" data-action="show-home">⌨️ 自分で入力</button>`;
  }
  currentStep = 1;
  updateStepIndicator();
  renderCurrentStep();
}

function prevStep() {
  if (currentStep === 1) {
    showHomeView();
    return;
  }
  currentStep -= 1;
  updateStepIndicator();
  renderCurrentStep();
}

function nextStep() {
  if (currentStep >= 5) return;
  saveCurrentStepData();
  saveToFirebase();
  currentStep += 1;
  updateStepIndicator();
  renderCurrentStep();
}

function goToStep(step) {
  saveCurrentStepData();
  currentStep = step;
  updateStepIndicator();
  renderCurrentStep();
}

function saveCurrentStepData() {
  if (currentStep === 1) {
    scheduleData = scheduleData.map((p, i) => ({
      period: p.period,
      subject: document.getElementById(`subject${i}`)?.value ?? p.subject,
      description: document.getElementById(`desc${i}`)?.value ?? p.description,
    }));
  } else if (currentStep === 2) {
    const inputs = document.querySelectorAll(".item-edit-input");
    itemsData = Array.from(inputs)
      .map((el) => el.value)
      .filter((v) => v.trim());
    classCount =
      Number(document.getElementById("classCount")?.value || classCount) || 6;
    classDuration =
      Number(
        document.getElementById("classDuration")?.value || classDuration,
      ) || 50;
    dismissalHour =
      Number(
        document.getElementById("dismissalHour")?.value || dismissalHour,
      ) || 16;
    dismissalMin =
      Number(document.getElementById("dismissalMin")?.value || dismissalMin) ||
      50;
    whiteboardText = document.getElementById("whiteboardText")?.value || "";
  }
}

function updateStepIndicator() {
  for (let i = 1; i <= 5; i += 1) {
    const el = document.getElementById(`si${i}`);
    if (!el) continue;
    el.className = "step-item";
    if (i < currentStep) el.classList.add("completed");
    else if (i === currentStep) el.classList.add("active");
  }
}

function renderCurrentStep() {
  for (let i = 1; i <= 5; i += 1) {
    const el = document.getElementById(`step${i}Content`);
    if (el) el.style.display = i === currentStep ? "block" : "none";
  }
  if (currentStep === 1) renderStep1();
  else if (currentStep === 2) renderStep2();
  else if (currentStep === 3) renderStep3();
  else if (currentStep === 4) renderManageView();
  else if (currentStep === 5) renderStep4();
}

function renderStep1() {
  while (scheduleData.length < 6) {
    scheduleData.push({
      period: scheduleData.length + 1,
      subject: "なし",
      description: "",
    });
  }

  const scheduleInputs = document.getElementById("scheduleInputs");
  if (!scheduleInputs) return;

  scheduleInputs.innerHTML = scheduleData
    .map(
      (p, i) => `
        <div class="schedule-row">
          <div class="period-label">${i + 1}限</div>
          <select id="subject${i}" class="subject-select" data-index="${i}">
            ${SUBJECT_LIST.map(
              (s) =>
                `<option value="${s}" ${s === p.subject ? "selected" : ""}>${s}</option>`,
            ).join("")}
          </select>
          <input type="text" id="desc${i}" class="desc-input" data-index="${i}" value="${escHtml(p.description)}" placeholder="内容" />
        </div>
      `,
    )
    .join("");

  scheduleInputs.querySelectorAll(".schedule-row").forEach((row, index) => {
    applySubjectColor(row, scheduleData[index]?.subject);
  });

  scheduleInputs.querySelectorAll(".subject-select").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.index);
      if (!Number.isNaN(index) && scheduleData[index]) {
        scheduleData[index].subject = select.value;
        applySubjectColor(select.closest(".schedule-row"), select.value);
        saveToFirebase();
      }
    });
  });

  scheduleInputs.querySelectorAll(".desc-input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.index);
      if (!Number.isNaN(index) && scheduleData[index]) {
        scheduleData[index].description = input.value;
        saveToFirebase();
      }
    });
  });
}

function renderStep2() {
  const itemsEditList = document.getElementById("itemsEditList");
  if (!itemsEditList) return;

  itemsEditList.innerHTML = itemsData
    .map(
      (item, i) => `
        <li class="item-edit-row">
          <span class="item-bullet">・</span>
          <input type="text" class="item-edit-input" value="${escHtml(item)}" data-index="${i}" />
          <button class="item-delete-btn" data-remove-index="${i}" data-action="remove-item">×</button>
        </li>
      `,
    )
    .join("");

  itemsEditList.querySelectorAll(".item-edit-input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.index);
      if (!Number.isNaN(index)) {
        itemsData[index] = input.value;
      }
      saveToFirebase();
    });
  });

  const btn = document.getElementById("committeeBtn");
  if (btn) {
    btn.textContent = hasCommittee ? "あり" : "なし";
    btn.style.background = hasCommittee ? "var(--green)" : "#eee";
    btn.style.color = hasCommittee ? "#333" : "#888";
  }
  const classCountEl = document.getElementById("classCount");
  const classDurationEl = document.getElementById("classDuration");
  const dismissalHourEl = document.getElementById("dismissalHour");
  const dismissalMinEl = document.getElementById("dismissalMin");
  const whiteboardTextEl = document.getElementById("whiteboardText");
  if (classCountEl) classCountEl.value = classCount;
  if (classDurationEl) classDurationEl.value = classDuration;
  if (dismissalHourEl) dismissalHourEl.value = dismissalHour;
  if (dismissalMinEl) dismissalMinEl.value = dismissalMin;
  if (whiteboardTextEl) {
    whiteboardTextEl.value = whiteboardText;
    whiteboardTextEl.addEventListener("input", () => {
      whiteboardText = whiteboardTextEl.value;
      saveToFirebase();
    });
  }
}

function toggleCommittee() {
  hasCommittee = !hasCommittee;
  renderStep2();
  saveToFirebase();
}

function addItem() {
  itemsData.push("");
  renderStep2();
  const all = document.querySelectorAll(".item-edit-input");
  if (all.length) all[all.length - 1].focus();
}

function removeItem(index) {
  itemsData.splice(index, 1);
  renderStep2();
  saveToFirebase();
}

function renderStep3() {
  const recipientListEl = document.getElementById("recipientList");
  if (!recipientListEl) return;

  recipientListEl.innerHTML = recipientList
    .map(
      (email, index) => `
        <button class="recipient-btn ${selectedRecipients.includes(email) ? "selected" : ""}" data-recipient-index="${index}" data-action="toggle-recipient" data-email="${escHtml(email)}">
          ${escHtml(email)}
        </button>
      `,
    )
    .join("");

  const tomorrowBtn = document.getElementById("tomorrowBtn");
  const nextMondayBtn = document.getElementById("nextMondayBtn");
  const customDateBtn = document.getElementById("customDateBtn");
  const customDateInput = document.getElementById("customDate");
  const customDateTimeWrap = document.getElementById("customDateTimeWrap");
  if (tomorrowBtn)
    tomorrowBtn.classList.toggle("active", scheduleDate === "tomorrow");
  if (nextMondayBtn)
    nextMondayBtn.classList.toggle("active", scheduleDate === "nextMonday");
  if (customDateBtn)
    customDateBtn.classList.toggle("active", scheduleDate === "custom");
  if (customDateInput) customDateInput.value = customDateValue;
  if (customDateTimeWrap)
    customDateTimeWrap.style.display =
      scheduleDate === "custom" ? "block" : "none";
  updateSelectedDateDisplay();
}

function toggleRecipient(email) {
  const idx = selectedRecipients.indexOf(email);
  if (idx >= 0) selectedRecipients.splice(idx, 1);
  else selectedRecipients.push(email);
  renderStep3();
}

function addCustomRecipient() {
  const email = window.prompt("送信先メールアドレスを入力してください:");
  if (!email || !email.includes("@")) return;
  if (!recipientList.includes(email)) recipientList.push(email);
  if (!selectedRecipients.includes(email)) selectedRecipients.push(email);
  renderStep3();
  saveToFirebase();
}

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getNextSchoolDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function getScheduledDateForFirebase() {
  let date;
  if (scheduleDate === "nextMonday") date = getNextMonday();
  else if (scheduleDate === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDateValue)) return null;
    date = new Date(`${customDateValue}T00:00:00`);
  } else date = getNextSchoolDay();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function updateSelectedDateDisplay() {
  const el = document.getElementById("selectedDateDisplay");
  if (!el) return;

  if (scheduleDate === "tomorrow") {
    const t = getNextSchoolDay();
    el.textContent = `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`;
  } else if (scheduleDate === "nextMonday") {
    const nm = getNextMonday();
    el.textContent = `${nm.getFullYear()}/${nm.getMonth() + 1}/${nm.getDate()}（月）`;
  } else if (scheduleDate === "custom" && customDateValue) {
    const parts = customDateValue.split("-");
    el.textContent = `${parts[0]}/${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  } else {
    el.textContent = "日時を指定してください";
  }
}

function selectDateType(type) {
  scheduleDate = type;
  const wrap = document.getElementById("customDateTimeWrap");
  if (wrap) wrap.style.display = type === "custom" ? "block" : "none";
  updateSelectedDateDisplay();
  renderStep3();
  if (type !== "custom" || customDateValue) saveToFirebase();
}

function confirmDateTime() {
  if (scheduleDate === "custom")
    customDateValue = document.getElementById("customDate")?.value || "";
  updateSelectedDateDisplay();
  saveToFirebase();
}

function getTargetDate() {
  if (scheduleDate === "nextMonday") return getNextMonday();
  if (scheduleDate === "custom" && customDateValue) {
    if (customTimeValue)
      return new Date(`${customDateValue}T${customTimeValue}`);
    return new Date(customDateValue);
  }
  return getNextSchoolDay();
}

function renderManageView() {
  const letterList = document.getElementById("letterList");
  if (letterList) {
    letterList.innerHTML = lettersData
      .map(
        (l, i) => `
          <li class="manage-row">
            <input class="manage-input" placeholder="名前（例：手紙1）" value="${escHtml(l.name || "")}" data-letter-index="${i}" data-field="name" />
            <input class="manage-input date" type="date" value="${escHtml(l.date || "")}" data-letter-index="${i}" data-field="date" />
            <button class="item-delete-btn" data-action="remove-letter" data-index="${i}">×</button>
          </li>
        `,
      )
      .join("");

    letterList
      .querySelectorAll(".manage-input[data-field]")
      .forEach((input) => {
        input.addEventListener("input", () => {
          const index = Number(input.dataset.letterIndex);
          const field = input.dataset.field;
          if (Number.isNaN(index) || !field) return;
          lettersData[index][field] = input.value;
          saveToFirebase();
        });
      });
  }

  const testList = document.getElementById("testList");
  if (testList) {
    testList.innerHTML = testsData
      .map(
        (t, i) => `
          <li style="border:1px solid #eee; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <select class="manage-input select-test" style="flex:1;" data-test-index="${i}" data-field="testName">
                <option value="">テスト名を選択</option>
                ${[
                  "前期中間テスト",
                  "前期期末技能テスト",
                  "前期期末テスト",
                  "後期中間テスト",
                  "後期期末技能テスト",
                  "学年末テスト",
                  "単元テスト",
                  "実力テスト",
                ]
                  .map(
                    (n) =>
                      `<option value="${n}" ${t.testName === n ? "selected" : ""}>${n}</option>`,
                  )
                  .join("")}
              </select>
              <button class="item-delete-btn" data-action="remove-test" data-index="${i}">×</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <select class="manage-input select-test" style="width:90px; flex:none;" data-test-index="${i}" data-field="subject">
                <option value="">科目（任意）</option>
                ${[
                  "英語",
                  "数学",
                  "国語",
                  "理科",
                  "社会",
                  "技術",
                  "家庭科",
                  "音楽",
                  "美術",
                  "保体",
                ]
                  .map(
                    (s) =>
                      `<option value="${s}" ${t.subject === s ? "selected" : ""}>${s}</option>`,
                  )
                  .join("")}
              </select>
              <input class="manage-input" placeholder="内容（任意）" value="${escHtml(t.content || "")}" data-test-index="${i}" data-field="content" style="flex:1; min-width:100px;" />
              <input class="manage-input date" type="date" value="${escHtml(t.date || "")}" data-test-index="${i}" data-field="date" />
            </div>
            <input class="manage-input" placeholder="範囲表URL（省略可）" value="${escHtml(t.driveUrl || "")}" data-test-index="${i}" data-field="driveUrl" style="width:100%;" />
          </li>
        `,
      )
      .join("");

    testList.querySelectorAll(".manage-input[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.dataset.testIndex);
        const field = input.dataset.field;
        if (Number.isNaN(index) || !field) return;
        testsData[index][field] = input.value;
        saveToFirebase();
      });
    });
  }
}

function renderStep4() {
  const targetDate = getTargetDate();
  const month = targetDate.getMonth() + 1;
  const date = targetDate.getDate();
  const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

  let text = `【${month}月${date}日の予定】\n\n`;
  const validSchedule = scheduleData.filter(
    (p) => !(p.subject === "なし" && !String(p.description || "").trim()),
  );
  if (validSchedule.length) {
    text += "【時間割】\n";
    text += validSchedule
      .map((p) => {
        const num = circled[p.period - 1] || p.period;
        if (p.subject === "なし") return `${num}${p.description || ""}`;
        return `${num}${p.subject}${p.description ? ` - ${p.description}` : ""}`;
      })
      .join("\n");
    text += "\n\n";
  }

  text += `授業数：${String(classCount).padStart(1, "0")}分×${String(classDuration).padStart(2, "0")}\n`;
  text += `下校時間：${String(dismissalHour).padStart(2, "0")}:${String(dismissalMin).padStart(2, "0")}\n\n`;

  const validItems = itemsData.filter((i) => String(i || "").trim());
  if (validItems.length) {
    text += "【持ち物】\n";
    text += validItems.map((i) => `・${i}`).join("\n");
    text += "\n\n";
  }

  if (whiteboardText.trim()) {
    text += `【ホワイトボード】\n${whiteboardText}\n\n`;
  }

  if (hasCommittee) text += "委員会：あり\n\n";

  const validLetters = lettersData.filter((l) => l.name || l.date);
  if (validLetters.length) {
    text += "【手紙・提出物】\n";
    text += validLetters
      .map((l) => `・${l.name}${l.date ? `（${l.date}）` : ""}`)
      .join("\n");
    text += "\n\n";
  }

  const validTests = testsData.filter((t) => t.testName || t.subject);
  if (validTests.length) {
    text += "【テスト】\n";
    text += validTests
      .map((t) => {
        const name = t.testName || "";
        const subject = t.subject ? `【${t.subject}】` : "";
        const content = t.content ? ` ${t.content}` : "";
        const date = t.date ? `（${t.date}）` : "";
        const url = t.driveUrl ? `\n  範囲表：${t.driveUrl}` : "";
        return `・${name}${subject}${content}${date}${url}`;
      })
      .join("\n");
    text += "\n\n";
  }

  const previewBox = document.getElementById("previewBox");
  if (previewBox) previewBox.textContent = text;
}

function sendEmail() {
  if (!selectedRecipients.length) {
    alert("送信先を選択してください（ステップ③）");
    goToStep(3);
    return;
  }

  const bodyText = document.getElementById("previewBox")?.textContent || "";
  const toEmail = selectedRecipients.join(",");
  const subject = encodeURIComponent("3-2");
  const body = encodeURIComponent(bodyText);
  saveToFirebase();
  window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
}

function initDayButtons() {
  const selector = document.getElementById("dayWheelWrapper");
  if (!selector || selector.dataset.bound === "true") return;
  selector.dataset.bound = "true";

  selector.querySelectorAll(".day-wheel-item").forEach((button) => {
    button.addEventListener("click", () => selectDay(button.dataset.day));
  });
  updateDayButtons();
}

function updateDayButtons() {
  document.querySelectorAll(".day-wheel-item").forEach((button) => {
    const isSelected = button.dataset.day === currentDay;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

async function selectDay(day) {
  if (!dayKeys.includes(day) || day === currentDay) return;

  const previousDay = currentDay;
  saveCurrentStepData();
  saveToFirebase();
  currentDay = day;
  wheelIndex = dayKeys.indexOf(day);
  updateDayButtons();

  const homeView = document.getElementById("homeView");
  const shouldOpenEditor = homeView && homeView.style.display !== "none";
  const buttons = document.querySelectorAll(".day-wheel-item");
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    if (database) {
      const snapshot = await database
        .ref("schoolSchedule/shared")
        .once("value");
      if (day !== currentDay) return;
      loadDayData(day, snapshot.val() || {});
    } else {
      loadDayData(day, {});
    }
    if (shouldOpenEditor) startManual();
  } catch (error) {
    currentDay = previousDay;
    wheelIndex = dayKeys.indexOf(previousDay);
    updateDayButtons();
    console.error("曜日データの読み込みに失敗しました", error);
    alert("曜日データを読み込めませんでした。通信状態を確認してください。");
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function addLetter() {
  lettersData.push({ name: "", date: "" });
  saveToFirebase();
  renderManageView();
}

function removeLetter(index) {
  lettersData.splice(index, 1);
  saveToFirebase();
  renderManageView();
}

function addTest() {
  testsData.push({ subject: "", content: "", date: "", driveUrl: "" });
  saveToFirebase();
  renderManageView();
}

function removeTest(index) {
  testsData.splice(index, 1);
  saveToFirebase();
  renderManageView();
}

function handleDocumentClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  event.preventDefault();
  const action = trigger.dataset.action;
  if (!action) return;

  switch (action) {
    case "login":
      login();
      break;
    case "register":
      register();
      break;
    case "show-register":
      showRegister();
      break;
    case "show-login":
      showLogin();
      break;
    case "anonymous-login":
      anonymousLogin();
      break;
    case "logout":
      logout();
      break;
    case "start-manual":
      startManual();
      break;
    case "show-home":
      showHomeView();
      break;
    case "show-calendar":
      showCalendarView();
      break;
    case "add-item":
      addItem();
      break;
    case "toggle-committee":
      toggleCommittee();
      break;
    case "add-custom-recipient":
      addCustomRecipient();
      break;
    case "select-date-type":
      selectDateType(trigger.dataset.dateType);
      break;
    case "confirm-date-time":
      confirmDateTime();
      break;
    case "add-letter":
      addLetter();
      break;
    case "add-test":
      addTest();
      break;
    case "remove-letter":
      removeLetter(Number(trigger.dataset.index));
      break;
    case "remove-test":
      removeTest(Number(trigger.dataset.index));
      break;
    case "remove-item":
      removeItem(Number(trigger.dataset.removeIndex));
      break;
    case "go-step":
      goToStep(Number(trigger.dataset.step));
      break;
    case "send-email":
      sendEmail();
      break;
    case "next-step":
      nextStep();
      break;
    case "prev-step":
      prevStep();
      break;
    case "toggle-recipient": {
      const email = trigger.dataset.email
        ? decodeURIComponent(trigger.dataset.email)
        : "";
      if (email) toggleRecipient(email);
      break;
    }
    default:
      break;
  }
}

function init() {
  document.addEventListener("click", handleDocumentClick);

  if (auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        isAnonymous = user.isAnonymous;
        showApp();
        loadData();
      } else {
        showAuth();
      }
    });
  } else {
    showApp();
    loadData();
  }

  document.addEventListener("keydown", (event) => {
    const wizardView = document.getElementById("wizardView");
    if (!wizardView || wizardView.style.display === "none") return;
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prevStep();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nextStep();
    }
  });
}

init();
