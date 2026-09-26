const database = firebase.database();
const auth = firebase.auth();
let currentUser = null;
let isAnonymous = false;

let wheelIndex = 0;
const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"];

// ウィザード状態
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

// 送信先リスト（Firebaseから読み込み・保存）
let recipientList = ["katokato.s.javas@gmail.com"];

// ========== 初期化 ==========
function init() {
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
}

// ========== 認証 ==========
function showAuth() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("appScreen").style.display = "none";
}

function showApp() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("appScreen").style.display = "flex";
  displayDate();
  updateUserDisplay();
  showHomeView();
  initDayWheel();
}

function showLogin() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("authError").textContent = "";
}

function showRegister() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
  document.getElementById("authError").textContent = "";
}

async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    document.getElementById("authError").textContent = "";
  } catch (e) {
    document.getElementById("authError").textContent = getErrorMessage(e.code);
  }
}

async function register() {
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    document.getElementById("authError").textContent = "";
  } catch (e) {
    document.getElementById("authError").textContent = getErrorMessage(e.code);
  }
}

async function anonymousLogin() {
  try {
    await auth.signInAnonymously();
  } catch (e) {
    document.getElementById("authError").textContent = "ログインに失敗しました";
  }
}

async function logout() {
  saveMemo();
  await auth.signOut();
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
  return map[code] || "エラーが発生しました: " + code;
}

// ========== 曜日変更・日付・ユーザー表示 ==========
function displayDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const w = days[today.getDay()];
  document.getElementById("dateDisplay").textContent = `${y}-${m}-${d}（${w}）`;
}

function updateUserDisplay() {
  document.getElementById("userEmail").textContent = isAnonymous
    ? "匿名ユーザー"
    : currentUser?.email || "";
}

// ① loadData はメモ・送信先など「共通データ」だけ読む
function loadData() {
  const ref = database.ref("schoolSchedule/shared");
  ref.once("value", (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      scheduleData = getDefaultSchedule();
      return;
    }

    // メモ
    if (data.memo) {
      const el = document.getElementById("memoBox");
      if (el) el.innerHTML = data.memo;
    }

    // 送信先リスト
    if (data.recipients && Array.isArray(data.recipients)) {
      recipientList = data.recipients;
    }
    // 曜日データを読み込む（初回はmonday固定）
    loadDayData(currentDay, data);

    if (data.letters) lettersData = Object.values(data.letters);

    if (data.tests) testsData = Object.values(data.tests);
  });
}

// ② 曜日ごとのデータ読み込みを独立した関数に
function loadDayData(day, data) {
  if (data && data[day]) {
    scheduleData = data[day].schedule || getDefaultSchedule();
    itemsData = data[day].items || [];
    whiteboardText = data[day].event || "";
    classDuration = data[day].classDuration || 50;
    classCount = data[day].classCount || 6;
    dismissalHour = data[day].dismissalHour || 16;
    dismissalMin = data[day].dismissalMin || 50;
    hasCommittee = data[day].hasCommittee || false;
  } else {
    scheduleData = getDefaultSchedule();
    itemsData = [];
    whiteboardText = "";
    classDuration = 50;
    classCount = 6;
    dismissalHour = 16;
    dismissalMin = 50;
    hasCommittee = false;
  }
}

// ③ 曜日切り替え時はFirebaseを再取得して loadDayData を呼ぶ
function switchDay(day) {
  saveCurrentStepData(); // 現在の入力内容を先に保存
  saveToFirebase();
  currentDay = day;

  database.ref("schoolSchedule/shared").once("value", (snapshot) => {
    loadDayData(day, snapshot.val());

    // Step2表示中なら入力欄を再描画
    if (currentStep === 2) renderStep2();
    if (currentStep === 1) renderStep1();
  });

  document.querySelectorAll(".day-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.day === day);
  });
}

// ========== 曜日変更 ==========
// スクロールで回す
function getTodayKey() {
  const keys = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return keys[new Date().getDay()];
}

function getDefaultSchedule() {
  const subjects = ["国語", "数学", "社会", "理科", "英語", "家庭科"];
  return subjects.map((s, i) => ({
    period: i + 1,
    subject: s,
    description: "",
  }));
}

// ========== データ保存 ==========
function saveToFirebase() {
  if (isAnonymous || !currentUser) return;
  database.ref(`schoolSchedule/shared/${currentDay}`).set({
    schedule: scheduleData,
    items: itemsData,
    event: whiteboardText,
    classDuration: classDuration,
    classCount: classCount,
    dismissalHour: dismissalHour,
    dismissalMin: dismissalMin,
    hasCommittee: hasCommittee,
  });
  database.ref("schoolSchedule/shared/recipients").set(recipientList);
  database.ref("schoolSchedule/shared/letters").set(lettersData);
  database.ref("schoolSchedule/shared/tests").set(testsData);
  saveMemo();
}

function saveMemo() {
  if (isAnonymous || !currentUser) return;
  const el = document.getElementById("memoBox");
  if (el) {
    database.ref("schoolSchedule/shared/memo").set(el.innerHTML);
  }
}

// ========== 画面切り替え ==========
function showHomeView() {
  document.getElementById("homeView").style.display = "flex";
  document.getElementById("wizardView").style.display = "none";
  document.getElementById("headerCenter").innerHTML = `
    <button class="header-mode-btn ai" onclick="openAIImagePicker()">🔍📊 AI画像解析</button>
  `;
}
function startManual() {
  document.getElementById("homeView").style.display = "none";
  document.getElementById("wizardView").style.display = "flex";
  document.getElementById("headerCenter").innerHTML = `
    <button class="header-mode-btn manual" onclick="showHomeView()">⌨️ 自分で入力</button>
  `;
  currentStep = 1;
  updateStepIndicator();
  renderCurrentStep();
}

// ========== ステップナビ ==========
function prevStep() {
  if (currentStep === 1) {
    showHomeView();
    return;
  }
  currentStep--;
  updateStepIndicator();
  renderCurrentStep();
}

function nextStep() {
  if (currentStep >= 5) return;
  saveCurrentStepData();
  saveToFirebase();
  currentStep++;
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
    classCount = parseInt(document.getElementById("classCount")?.value) || 6;
    classDuration =
      parseInt(document.getElementById("classDuration")?.value) || 50;
    dismissalHour =
      parseInt(document.getElementById("dismissalHour")?.value) || 16;
    dismissalMin =
      parseInt(document.getElementById("dismissalMin")?.value) || 50;
    whiteboardText = document.getElementById("whiteboardText")?.value || "";
  }
}

function updateStepIndicator() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`si${i}`);
    el.className = "step-item";
    if (i < currentStep) el.classList.add("completed");
    else if (i === currentStep) el.classList.add("active");
  }
}

function renderCurrentStep() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step${i}Content`);
    if (el) el.style.display = i === currentStep ? "block" : "none";
  }
  if (currentStep === 1) renderStep1();
  else if (currentStep === 2) renderStep2();
  else if (currentStep === 3) renderStep3();
  else if (currentStep === 4) renderManageView();
  else if (currentStep === 5) renderStep4();
}

// ========== Step 1: 時間割 ==========
function renderStep1() {
  // scheduleData が足りない場合に補完
  while (scheduleData.length < 6) {
    const n = scheduleData.length + 1;
    scheduleData.push({ period: n, subject: "なし", description: "" });
  }

  document.getElementById("scheduleInputs").innerHTML = scheduleData
    .map(
      (p, i) => `
  <div class="schedule-row">
    <div class="period-num">${i + 1}</div>
    <select id="subject${i}" class="subject-select">
      ${SUBJECT_LIST.map(
        (s) =>
          `<option value="${s}" ${s === p.subject ? "selected" : ""}>${s}</option>`,
      ).join("")}
    </select>
    <input type="text" id="desc${i}" class="desc-input"
      value="${escHtml(p.description)}"
      placeholder="内容">
  </div>
`,
    )
    .join("");
}

// ========== Step 2: 持ち物 ==========
function renderStep2() {
  document.getElementById("itemsEditList").innerHTML = itemsData
    .map(
      (item, i) => `
    <li class="item-edit-row">
      <span class="item-bullet">・</span>
      <input type="text" class="item-edit-input" value="${escHtml(item)}">
      <button class="item-delete-btn" onclick="removeItem(${i})">×</button>
    </li>
  `,
    )
    .join("");

  document.getElementById("classCount").value = classCount;
  document.getElementById("classDuration").value = classDuration;
  document.getElementById("dismissalHour").value = dismissalHour;
  document.getElementById("dismissalMin").value = dismissalMin;
  document.getElementById("whiteboardText").value = whiteboardText;

  const btn = document.getElementById("committeeBtn");
  if (btn) {
    btn.textContent = hasCommittee ? "あり" : "なし";
    btn.style.background = hasCommittee ? "var(--green)" : "#eee";
    btn.style.color = hasCommittee ? "#333" : "#888";
  }
}

function toggleCommittee() {
  hasCommittee = !hasCommittee;
  const btn = document.getElementById("committeeBtn");
  if (btn) {
    btn.textContent = hasCommittee ? "あり" : "なし";
    btn.style.background = hasCommittee ? "var(--green)" : "#eee";
    btn.style.color = hasCommittee ? "#333" : "#888";
  }
  saveToFirebase();
}

function addItem() {
  const inputs = document.querySelectorAll(".item-edit-input");
  itemsData = Array.from(inputs).map((el) => el.value);
  itemsData.push("");
  renderStep2();
  const all = document.querySelectorAll(".item-edit-input");
  if (all.length) all[all.length - 1].focus();
}

function removeItem(index) {
  const inputs = document.querySelectorAll(".item-edit-input");
  itemsData = Array.from(inputs).map((el) => el.value);
  itemsData.splice(index, 1);
  renderStep2();
}

// ========== Step 3: 送信先 ==========
function renderStep3() {
  document.getElementById("recipientList").innerHTML = recipientList
    .map(
      (email) => `
    <button class="recipient-btn ${selectedRecipients.includes(email) ? "selected" : ""}"
      onclick="toggleRecipient('${escHtml(email)}')">
      ${escHtml(email)}
    </button>
  `,
    )
    .join("");

  document
    .getElementById("tomorrowBtn")
    .classList.toggle("active", scheduleDate === "tomorrow");
  document
    .getElementById("customDateBtn")
    .classList.toggle("active", scheduleDate === "custom");
  updateSelectedDateDisplay();
}

function toggleRecipient(email) {
  const idx = selectedRecipients.indexOf(email);
  if (idx >= 0) selectedRecipients.splice(idx, 1);
  else selectedRecipients.push(email);
  renderStep3();
}

function addCustomRecipient() {
  const email = prompt("送信先メールアドレスを入力してください:");
  if (email && email.includes("@")) {
    if (!recipientList.includes(email)) recipientList.push(email);
    if (!selectedRecipients.includes(email)) selectedRecipients.push(email);
    renderStep3();
  }
}

function selectDateType(type) {
  scheduleDate = type;
  const wrap = document.getElementById("customDateTimeWrap");
  wrap.style.display = type === "custom" ? "block" : "none";
  document
    .getElementById("tomorrowBtn")
    .classList.toggle("active", type === "tomorrow");
  document
    .getElementById("nextMondayBtn")
    .classList.toggle("active", type === "nextMonday");
  document
    .getElementById("customDateBtn")
    .classList.toggle("active", type === "custom");
  updateSelectedDateDisplay();
}

function confirmDateTime() {
  if (scheduleDate === "custom") {
    customDateValue = document.getElementById("customDate").value;
    const timeEl = document.getElementById("customTime");
    customTimeValue = timeEl ? timeEl.value : "";
  }
  updateSelectedDateDisplay();

  // Firebaseに送信予定日を保存
  const target = getTargetDate();
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  database
    .ref("schoolSchedule/shared/scheduledDate")
    .set(`${yyyy}-${mm}-${dd}`);

  // 曜日ホイールを対象日に自動で合わせる
  const dayKeys2 = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDayKey = dayKeys2[target.getDay()];
  const wheelIdx = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ].indexOf(targetDayKey);
  if (wheelIdx >= 0) {
    wheelIndex = wheelIdx;
    currentDay = targetDayKey;
    updateWheelDisplay();
    database.ref("schoolSchedule/shared").once("value", (snapshot) => {
      loadDayData(currentDay, snapshot.val());
    });
  }
}

function updateSelectedDateDisplay() {
  const el = document.getElementById("selectedDateDisplay");
  if (!el) return;

  if (scheduleDate === "tomorrow") {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    el.textContent =
      t.getFullYear() + "/" + (t.getMonth() + 1) + "/" + t.getDate();
  } else if (scheduleDate === "nextMonday") {
    const nm = getNextMonday();
    el.textContent =
      nm.getFullYear() +
      "/" +
      (nm.getMonth() + 1) +
      "/" +
      nm.getDate() +
      "（月）";
  } else if (scheduleDate === "custom" && customDateValue) {
    const parts = customDateValue.split("-");
    el.textContent =
      parts[0] + "/" + parseInt(parts[1]) + "/" + parseInt(parts[2]);
  } else {
    el.textContent = "日時を指定してください";
  }
}

function getNextMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=日 1=月 ... 6=土
  const diff = (8 - day) % 7 || 7; // 次の月曜まで何日か
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ========== Step 4: プレビュー ==========
function renderStep4() {
  const targetDate = getTargetDate();
  const month = targetDate.getMonth() + 1;
  const date = targetDate.getDate();

  const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

  let text = `【${month}月${date}日の予定】\n\n`;

  const validSchedule = scheduleData.filter(
    (p) => !(p.subject === "なし" && !p.description.trim()),
  );

  if (validSchedule.length) {
    text += "【時間割】\n";
    text += validSchedule
      .map((p) => {
        const num = circled[p.period - 1] || p.period;
        if (p.subject === "なし") return `${num}${p.description}`;
        return `${num}${p.subject}${p.description ? " - " + p.description : ""}`;
      })
      .join("\n");
    text += "\n\n";
  }

  const cc = String(classCount).padStart(1, "0");
  const cm = String(classDuration).padStart(2, "0");
  text += `授業数：${cm}分×${cc}\n`;

  const hh = String(dismissalHour).padStart(2, "0");
  const mm = String(dismissalMin).padStart(2, "0");
  text += `下校時間：${hh}:${mm}\n\n`;

  const validItems = itemsData.filter((i) => i.trim());
  if (validItems.length) {
    text += "【持ち物】\n";
    text += validItems.map((i) => `・${i}`).join("\n");
    text += "\n\n";
  }

  if (whiteboardText.trim()) {
    text += `【ホワイトボード】\n${whiteboardText}\n\n`;
  }

  // 委員会
  if (hasCommittee) {
    text += `委員会：あり\n\n`;
  }

  // 手紙・提出物
  const validLetters = lettersData.filter((l) => l.name || l.date);
  if (validLetters.length) {
    text += "【手紙・提出物】\n";
    text += validLetters
      .map((l) => {
        const d = l.date ? `（${l.date}）` : "";
        return `・${l.name}${d}`;
      })
      .join("\n");
    text += "\n\n";
  }

  // テスト
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

  document.getElementById("previewBox").textContent = text;
}

function getTargetDate() {
  if (scheduleDate === "nextMonday") {
    return getNextMonday();
  }
  if (scheduleDate === "custom" && customDateValue) {
    if (customTimeValue) {
      return new Date(`${customDateValue}T${customTimeValue}`);
    }
    return new Date(customDateValue);
  }

  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t;
}

// ========== メール送信 ==========
function sendEmail() {
  if (!selectedRecipients.length) {
    alert("送信先を選択してください（ステップ③）");
    goToStep(3);
    return;
  }

  const bodyText = document.getElementById("previewBox").textContent;
  const toEmail = selectedRecipients.join(",");
  const subject = encodeURIComponent("3-2");
  const body = encodeURIComponent(`${bodyText}`);

  saveToFirebase();
  window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
}

// ========== ユーティリティ ==========
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initDayWheel() {
  updateWheelDisplay();

  const wheel = document.getElementById("dayWheelWrapper");

  // スクロールで回す
  wheel.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.deltaY > 0) rotateWheel(1);
      else rotateWheel(-1);
    },
    { passive: false },
  );

  // タッチスワイプで回す
  let touchStartY = 0;
  wheel.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
  });
  wheel.addEventListener("touchend", (e) => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 20) rotateWheel(diff > 0 ? 1 : -1);
  });

  // クリックで上下移動
  wheel.addEventListener("click", (e) => {
    const rect = wheel.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    rotateWheel(e.clientY > center ? 1 : -1);
  });
}

function rotateWheel(direction) {
  wheelIndex = (wheelIndex + direction + 5) % 5;
  currentDay = dayKeys[wheelIndex];
  updateWheelDisplay();

  // データ再読み込み
  database.ref("schoolSchedule/shared").once("value", (snapshot) => {
    loadDayData(currentDay, snapshot.val());

    const wizardVisible =
      document.getElementById("wizardView").style.display !== "none";
    if (wizardVisible) {
      renderCurrentStep();
    }
  });
}

function updateWheelDisplay() {
  const items = document.querySelectorAll(".day-wheel-item");
  items.forEach((item, i) => {
    const dist = i - wheelIndex;
    item.setAttribute("data-dist", dist);
  });
}

// ========== Arrow-button ==========
window.addEventListener("keydown", function (event) {
  // ウィザード画面が表示されていない時は処理しない
  const wizardView = document.getElementById("wizardView");
  if (!wizardView || wizardView.style.display === "none") return;

  // 現在、文字入力中の場合は、矢印キーの本来の挙動（カーソル移動など）を優先するため処理しない
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.getAttribute("contenteditable") === "true")
  ) {
    return;
  }

  // 左右の矢印キーを検知して関数を実行
  if (event.key === "ArrowLeft") {
    event.preventDefault(); // 画面の横スクロールなどを防止
    prevStep();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    nextStep();
  }
});

// ========== 管理画面 ==========
function renderManageView() {
  document.getElementById("letterList").innerHTML = lettersData
    .map(
      (l, i) => `
    <li class="manage-row">
      <input class="manage-input" placeholder="名前（例：手紙1）"
        value="${escHtml(l.name || "")}"
        oninput="lettersData[${i}].name=this.value; saveToFirebase()">
      <input class="manage-input date" type="date"
        value="${l.date || ""}"
        oninput="lettersData[${i}].date=this.value; saveToFirebase()">
      <button class="item-delete-btn" onclick="removeLetter(${i})">×</button>
    </li>
  `,
    )
    .join("");

  document.getElementById("testList").innerHTML = testsData
    .map(
      (t, i) => `
  <li style="border:1px solid #eee; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">

    <!-- 1段目：テスト名 + 削除ボタン -->
    <div style="display:flex; align-items:center; gap:8px;">
      <select class="manage-input select-test" style="flex:1;"
        oninput="testsData[${i}].testName=this.value; saveToFirebase()">
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
      <button class="item-delete-btn" onclick="removeTest(${i})">×</button>
    </div>

    <!-- 2段目：科目 + 内容 + 日付 -->
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <select class="manage-input select-test" style="width:90px; flex:none;"
        oninput="testsData[${i}].subject=this.value; saveToFirebase()">
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
      <input class="manage-input" placeholder="内容（任意）"
        value="${escHtml(t.content || "")}"
        oninput="testsData[${i}].content=this.value; saveToFirebase()"
        style="flex:1; min-width:100px;">
      <input class="manage-input date" type="date"
        value="${t.date || ""}"
        oninput="testsData[${i}].date=this.value; saveToFirebase()">
    </div>

    <!-- 3段目：範囲表URL -->
    <input class="manage-input" placeholder="範囲表URL（省略可）"
      value="${escHtml(t.driveUrl || "")}"
      oninput="testsData[${i}].driveUrl=this.value; saveToFirebase()"
      style="width:100%;">

  </li>
`,
    )
    .join("");
}

function addLetter() {
  lettersData.push({ name: "", date: "" });
  saveToFirebase();
  renderManageView();
}

function removeLetter(i) {
  lettersData.splice(i, 1);
  saveToFirebase();
  renderManageView();
}

function addTest() {
  testsData.push({ subject: "", content: "", date: "", driveUrl: "" });
  saveToFirebase();
  renderManageView();
}

function removeTest(i) {
  testsData.splice(i, 1);
  saveToFirebase();
  renderManageView();
}

// ========================================
// AI画像解析
// ========================================

// ========================================
// AI画像解析
// ========================================

let aiScheduleFile = null;
let aiWhiteboardFile = null;

// ========================================
// AI画像選択画面
// ========================================

function openAIImagePicker() {
  const oldModal = document.getElementById("aiImageChoiceModal");

  if (oldModal) {
    oldModal.remove();
  }

  const modal = document.createElement("div");

  modal.id = "aiImageChoiceModal";

  modal.innerHTML = `

    <div class="ai-choice-overlay">

      <div class="ai-choice-modal">

        <div class="ai-choice-header">

          <div>
            <div class="ai-choice-title">
              🔍 AI画像解析
            </div>

            <div class="ai-choice-subtitle">
              予定表とホワイトボードを読み取ります
            </div>
          </div>

          <button
            class="ai-choice-close"
            onclick="closeAIImagePicker()"
          >
            ×
          </button>

        </div>


        <!-- ============================== -->
        <!-- 予定表 -->
        <!-- ============================== -->

        <div class="ai-image-section">

          <div class="ai-image-section-title">
            📅 予定表の画像
          </div>

          <div
            id="aiScheduleStatus"
            class="ai-image-status"
          >
            まだ選択されていません
          </div>

          <div class="ai-choice-buttons">

            <button
              class="ai-choice-button"
              onclick="openAIScheduleCamera()"
            >
              📷 写真を撮る
            </button>

            <button
              class="ai-choice-button"
              onclick="openAIScheduleFile()"
            >
              📁 ファイルから選択
            </button>

          </div>

        </div>


        <!-- ============================== -->
        <!-- ホワイトボード -->
        <!-- ============================== -->

        <div class="ai-image-section">

          <div class="ai-image-section-title">
            📋 ホワイトボードの画像
          </div>

          <div
            id="aiWhiteboardStatus"
            class="ai-image-status"
          >
            まだ選択されていません
          </div>

          <div class="ai-choice-buttons">

            <button
              class="ai-choice-button"
              onclick="openAIWhiteboardCamera()"
            >
              📷 写真を撮る
            </button>

            <button
              class="ai-choice-button"
              onclick="openAIWhiteboardFile()"
            >
              📁 ファイルから選択
            </button>

          </div>

        </div>


        <!-- ============================== -->
        <!-- ボタン -->
        <!-- ============================== -->

        <div class="ai-choice-footer">

          <button
            class="ai-choice-cancel"
            onclick="closeAIImagePicker()"
          >
            キャンセル
          </button>

          <button
            id="aiAnalyzeButton"
            class="ai-choice-analyze"
            onclick="startAIImageAnalysis()"
            disabled
          >
            🔍 AI解析開始
          </button>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  aiScheduleFile = null;
  aiWhiteboardFile = null;
}

// ========================================
// AI画像選択画面を閉じる
// ========================================

function closeAIImagePicker() {
  const modal = document.getElementById("aiImageChoiceModal");

  if (modal) {
    modal.remove();
  }

  aiScheduleFile = null;
  aiWhiteboardFile = null;
}

// ========================================
// 予定表：カメラ
// ========================================

function openAIScheduleCamera() {
  const input = document.getElementById("aiScheduleCameraInput");

  if (!input) {
    console.error("aiScheduleCameraInput が見つかりません");

    return;
  }

  input.value = "";
  input.click();
}

// ========================================
// 予定表：ファイル
// ========================================

function openAIScheduleFile() {
  const input = document.getElementById("aiScheduleFileInput");

  if (!input) {
    console.error("aiScheduleFileInput が見つかりません");

    return;
  }

  input.value = "";
  input.click();
}

// ========================================
// ホワイトボード：カメラ
// ========================================

function openAIWhiteboardCamera() {
  const input = document.getElementById("aiWhiteboardCameraInput");

  if (!input) {
    console.error("aiWhiteboardCameraInput が見つかりません");

    return;
  }

  input.value = "";
  input.click();
}

// ========================================
// ホワイトボード：ファイル
// ========================================

function openAIWhiteboardFile() {
  const input = document.getElementById("aiWhiteboardFileInput");

  if (!input) {
    console.error("aiWhiteboardFileInput が見つかりません");

    return;
  }

  input.value = "";
  input.click();
}

// ========================================
// 予定表画像を選択
// ========================================

function handleAIScheduleImage(input) {
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");

    input.value = "";

    return;
  }

  aiScheduleFile = file;

  const status = document.getElementById("aiScheduleStatus");

  if (status) {
    status.textContent = `✓ ${file.name}`;

    status.classList.add("selected");
  }

  updateAIAnalyzeButton();
}

// ========================================
// ホワイトボード画像を選択
// ========================================

function handleAIWhiteboardImage(input) {
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");

    input.value = "";

    return;
  }

  aiWhiteboardFile = file;

  const status = document.getElementById("aiWhiteboardStatus");

  if (status) {
    status.textContent = `✓ ${file.name}`;

    status.classList.add("selected");
  }

  updateAIAnalyzeButton();
}

// ========================================
// AI解析ボタンの状態
// ========================================

function updateAIAnalyzeButton() {
  const button = document.getElementById("aiAnalyzeButton");

  if (!button) {
    return;
  }

  // 予定表は必須
  // ホワイトボードは任意

  button.disabled = !aiScheduleFile;
}

// ========================================
// AI画像解析開始
// ========================================

async function startAIImageAnalysis() {
  if (!aiScheduleFile) {
    alert("予定表の画像を選択してください。");

    return;
  }

  const button = document.getElementById("aiAnalyzeButton");

  if (button) {
    button.disabled = true;

    button.textContent = "🔄 AI解析中...";
  }

  try {
    console.log("AI画像解析開始");

    console.log("予定表:", aiScheduleFile.name);

    console.log(
      "ホワイトボード:",
      aiWhiteboardFile ? aiWhiteboardFile.name : "なし",
    );

    // ====================================
    // 予定表画像
    // ====================================

    const scheduleBase64 = await fileToBase64(aiScheduleFile);

    // ====================================
    // ホワイトボード画像
    // ====================================

    let whiteboardBase64 = null;
    let whiteboardMimeType = null;

    if (aiWhiteboardFile) {
      whiteboardBase64 = await fileToBase64(aiWhiteboardFile);

      whiteboardMimeType = aiWhiteboardFile.type;
    }

    console.log("画像変換完了");

    // ====================================
    // Cloudflare Workerへ送信
    // ====================================

    const response = await fetch(
      "https://little-snow-d5d1.nextgen-runtime-service.workers.dev/",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          scheduleImage: scheduleBase64,

          scheduleMimeType: aiScheduleFile.type,

          whiteboardImage: whiteboardBase64,

          whiteboardMimeType: whiteboardMimeType,
        }),
      },
    );

    // ====================================
    // HTTPエラー
    // ====================================

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Workerからのエラー:", errorText);

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // ====================================
    // AI結果
    // ====================================

    const result = await response.json();

    console.log("AI解析結果:", result);

    if (!result.success) {
      throw new Error(result.error || "AI解析に失敗しました");
    }

    // ====================================
    // ここではまだ反映しない
    // ====================================

    closeAIImagePicker();

    showAIResultPreview(result.data);
  } catch (error) {
    console.error("AI画像解析エラー:", error);

    alert("画像の解析に失敗しました。\n\n" + "エラー: " + error.message);
  } finally {
    if (button) {
      button.disabled = false;

      button.textContent = "🔍 AI解析開始";
    }
  }
}

// ========================================
// File → Base64
// ========================================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result;

        const base64 = result.split(",")[1];

        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("画像の読み込みに失敗しました"));
    };

    reader.readAsDataURL(file);
  });
}

// ========================================
// AI解析結果 一時保存
// ========================================

let pendingAIResult = null;

// ========================================
// AI解析結果を確認画面に表示
// ========================================

function showAIResultPreview(result) {
  console.log("AI解析結果を確認画面へ:", result);

  // AI結果を一時保存
  pendingAIResult = JSON.parse(JSON.stringify(result || {}));

  // 既存モーダルがあれば削除
  const oldModal = document.getElementById("aiResultModal");

  if (oldModal) {
    oldModal.remove();
  }

  // ========================================
  // モーダル
  // ========================================

  const modal = document.createElement("div");

  modal.id = "aiResultModal";

  modal.innerHTML = `

    <div class="ai-result-overlay">

      <div class="ai-result-modal">

        <div class="ai-result-header">

          <div>
            <div class="ai-result-title">
              🔍 AI解析結果を確認
            </div>

            <div class="ai-result-subtitle">
              内容を確認・修正してからOKを押してください
            </div>
          </div>

          <button
            class="ai-result-close"
            onclick="cancelAIResult()"
          >
            ×
          </button>

        </div>


        <div class="ai-result-body">

          <!-- ============================== -->
          <!-- 日付 -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              📅 日付
            </div>

            <input
              id="aiPreviewDate"
              class="ai-preview-input"
              type="text"
              value="${escapeAIHtml(result?.date || "")}"
              placeholder="日付"
            >

          </div>


          <!-- ============================== -->
          <!-- 時間割 -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              📚 時間割
            </div>

            <div id="aiPreviewSchedule">

              ${
                Array.isArray(result?.schedule) && result.schedule.length
                  ? result.schedule
                      .map(
                        (item, index) => `
                          <div
                            class="ai-preview-row ai-schedule-row"
                            data-index="${index}"
                          >

                            <div class="ai-period">
                              ${item.period || index + 1}時間目
                            </div>

                            <input
                              class="ai-preview-input ai-subject"
                              value="${escapeAIHtml(item.subject || "")}"
                              placeholder="教科"
                            >

                            <input
                              class="ai-preview-input ai-description"
                              value="${escapeAIHtml(item.description || "")}"
                              placeholder="授業内容"
                            >

                            <button
                              class="ai-delete-btn"
                              onclick="removeAIPreviewSchedule(${index})"
                            >
                              ×
                            </button>

                          </div>
                        `,
                      )
                      .join("")
                  : `
                    <div class="ai-empty">
                      時間割は見つかりませんでした
                    </div>
                  `
              }

            </div>

          </div>


          <!-- ============================== -->
          <!-- 持ち物 -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              🎒 持ち物
            </div>

            <div id="aiPreviewItems">

              ${
                Array.isArray(result?.items) && result.items.length
                  ? result.items
                      .map(
                        (item, index) => `
                          <div
                            class="ai-preview-item"
                            data-index="${index}"
                          >

                            <input
                              class="ai-preview-input ai-item-input"
                              value="${escapeAIHtml(item || "")}"
                              placeholder="持ち物"
                            >

                            <button
                              class="ai-delete-btn"
                              onclick="removeAIPreviewItem(${index})"
                            >
                              ×
                            </button>

                          </div>
                        `,
                      )
                      .join("")
                  : `
                    <div class="ai-empty">
                      持ち物は見つかりませんでした
                    </div>
                  `
              }

            </div>

            <button
              class="ai-add-btn"
              onclick="addAIPreviewItem()"
            >
              ＋ 持ち物を追加
            </button>

          </div>


          <!-- ============================== -->
          <!-- テスト -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              📝 テスト
            </div>

            <div id="aiPreviewTests">

              ${
                Array.isArray(result?.tests) && result.tests.length
                  ? result.tests
                      .map(
                        (test, index) => `
                          <div
                            class="ai-test-card"
                            data-index="${index}"
                          >

                            <input
                              class="ai-preview-input ai-test-subject"
                              value="${escapeAIHtml(test.subject || "")}"
                              placeholder="教科"
                            >

                            <input
                              class="ai-preview-input ai-test-name"
                              value="${escapeAIHtml(test.name || "")}"
                              placeholder="テスト名"
                            >

                            <input
                              class="ai-preview-input ai-test-date"
                              value="${escapeAIHtml(test.date || "")}"
                              placeholder="日付"
                            >

                            <input
                              class="ai-preview-input ai-test-range"
                              value="${escapeAIHtml(test.range || "")}"
                              placeholder="範囲"
                            >

                            <button
                              class="ai-delete-btn"
                              onclick="removeAIPreviewTest(${index})"
                            >
                              ×
                            </button>

                          </div>
                        `,
                      )
                      .join("")
                  : `
                    <div class="ai-empty">
                      テストは見つかりませんでした
                    </div>
                  `
              }

            </div>

            <button
              class="ai-add-btn"
              onclick="addAIPreviewTest()"
            >
              ＋ テストを追加
            </button>

          </div>


          <!-- ============================== -->
          <!-- 行事 -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              📢 行事
            </div>

            <div id="aiPreviewEvents">

              ${
                Array.isArray(result?.events) && result.events.length
                  ? result.events
                      .map(
                        (event, index) => `
                          <div
                            class="ai-preview-item"
                            data-index="${index}"
                          >

                            <input
                              class="ai-preview-input ai-event-input"
                              value="${escapeAIHtml(event || "")}"
                              placeholder="行事"
                            >

                            <button
                              class="ai-delete-btn"
                              onclick="removeAIPreviewEvent(${index})"
                            >
                              ×
                            </button>

                          </div>
                        `,
                      )
                      .join("")
                  : `
                    <div class="ai-empty">
                      行事は見つかりませんでした
                    </div>
                  `
              }

            </div>

            <button
              class="ai-add-btn"
              onclick="addAIPreviewEvent()"
            >
              ＋ 行事を追加
            </button>

          </div>


          <!-- ============================== -->
          <!-- その他メモ -->
          <!-- ============================== -->

          <div class="ai-result-section">

            <div class="ai-result-section-title">
              💬 その他
            </div>

            <textarea
              id="aiPreviewMemo"
              class="ai-preview-textarea"
              placeholder="その他の情報"
            >${escapeAIHtml(result?.memo || "")}</textarea>

          </div>

        </div>


        <!-- ============================== -->
        <!-- フッター -->
        <!-- ============================== -->

        <div class="ai-result-footer">

          <button
            class="ai-cancel-button"
            onclick="cancelAIResult()"
          >
            キャンセル
          </button>

          <button
            class="ai-ok-button"
            onclick="confirmAIResult()"
          >
            ✓ この内容で反映
          </button>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

// ========================================
// HTMLエスケープ
// ========================================

function escapeAIHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ========================================
// 時間割削除
// ========================================

function removeAIPreviewSchedule(index) {
  if (!pendingAIResult?.schedule) return;

  pendingAIResult.schedule.splice(index, 1);

  showAIResultPreview(pendingAIResult);
}

// ========================================
// 持ち物追加
// ========================================

function addAIPreviewItem() {
  if (!pendingAIResult) return;

  if (!Array.isArray(pendingAIResult.items)) {
    pendingAIResult.items = [];
  }

  pendingAIResult.items.push("");

  showAIResultPreview(pendingAIResult);
}

// ========================================
// 持ち物削除
// ========================================

function removeAIPreviewItem(index) {
  if (!pendingAIResult?.items) return;

  pendingAIResult.items.splice(index, 1);

  showAIResultPreview(pendingAIResult);
}

// ========================================
// テスト追加
// ========================================

function addAIPreviewTest() {
  if (!pendingAIResult) return;

  if (!Array.isArray(pendingAIResult.tests)) {
    pendingAIResult.tests = [];
  }

  pendingAIResult.tests.push({
    subject: "",
    name: "",
    date: "",
    range: "",
  });

  showAIResultPreview(pendingAIResult);
}

// ========================================
// テスト削除
// ========================================

function removeAIPreviewTest(index) {
  if (!pendingAIResult?.tests) return;

  pendingAIResult.tests.splice(index, 1);

  showAIResultPreview(pendingAIResult);
}

// ========================================
// 行事追加
// ========================================

function addAIPreviewEvent() {
  if (!pendingAIResult) return;

  if (!Array.isArray(pendingAIResult.events)) {
    pendingAIResult.events = [];
  }

  pendingAIResult.events.push("");

  showAIResultPreview(pendingAIResult);
}

// ========================================
// 行事削除
// ========================================

function removeAIPreviewEvent(index) {
  if (!pendingAIResult?.events) return;

  pendingAIResult.events.splice(index, 1);

  showAIResultPreview(pendingAIResult);
}

// ========================================
// 確認画面の入力内容を取得
// ========================================

function collectAIResultFromPreview() {
  const result = {
    date: document.getElementById("aiPreviewDate")?.value || "",

    schedule: [],

    items: [],

    tests: [],

    events: [],

    memo: document.getElementById("aiPreviewMemo")?.value || "",
  };

  // 時間割

  document
    .querySelectorAll("#aiPreviewSchedule .ai-schedule-row")
    .forEach((row, index) => {
      const subject = row.querySelector(".ai-subject")?.value || "";

      const description = row.querySelector(".ai-description")?.value || "";

      const periodText = row.querySelector(".ai-period")?.textContent || "";

      const periodMatch = periodText.match(/\d+/);

      result.schedule.push({
        period: periodMatch ? Number(periodMatch[0]) : index + 1,

        subject: subject.trim(),

        description: description.trim(),
      });
    });

  // 持ち物

  document
    .querySelectorAll("#aiPreviewItems .ai-item-input")
    .forEach((input) => {
      const value = input.value.trim();

      if (value) {
        result.items.push(value);
      }
    });

  // テスト

  document.querySelectorAll("#aiPreviewTests .ai-test-card").forEach((card) => {
    result.tests.push({
      subject: card.querySelector(".ai-test-subject")?.value.trim() || "",

      name: card.querySelector(".ai-test-name")?.value.trim() || "",

      date: card.querySelector(".ai-test-date")?.value.trim() || "",

      range: card.querySelector(".ai-test-range")?.value.trim() || "",
    });
  });

  // 行事

  document
    .querySelectorAll("#aiPreviewEvents .ai-event-input")
    .forEach((input) => {
      const value = input.value.trim();

      if (value) {
        result.events.push(value);
      }
    });

  return result;
}

// ========================================
// OK → 初めてアプリへ反映
// ========================================

function confirmAIResult() {
  const result = collectAIResultFromPreview();

  console.log("AI確認済み結果:", result);

  // -------------------------
  // 時間割
  // -------------------------

  scheduleData = result.schedule.map((item, index) => ({
    period: item.period || index + 1,

    subject: item.subject || "",

    description: item.description || "",
  }));

  // -------------------------
  // 持ち物
  // -------------------------

  itemsData = result.items.filter(
    (item) => typeof item === "string" && item.trim(),
  );

  // -------------------------
  // 行事
  // -------------------------

  whiteboardText = result.events.join("\n");

  // -------------------------
  // テスト
  // -------------------------

  testsData = result.tests.map((test) => ({
    subject: test.subject || "",

    content: [test.name, test.range ? `範囲: ${test.range}` : ""]
      .filter(Boolean)
      .join(" / "),

    date: test.date || "",

    driveUrl: "",
  }));

  // -------------------------
  // モーダルを閉じる
  // -------------------------

  const modal = document.getElementById("aiResultModal");

  if (modal) {
    modal.remove();
  }

  pendingAIResult = null;

  // -------------------------
  // 入力画面へ
  // -------------------------

  document.getElementById("homeView").style.display = "none";

  document.getElementById("wizardView").style.display = "flex";

  document.getElementById("headerCenter").innerHTML = `

    <button
      class="header-mode-btn manual"
      onclick="showHomeView()"
    >
      ⌨️ 自分で入力
    </button>

  `;

  currentStep = 1;

  updateStepIndicator();

  renderCurrentStep();

  // -------------------------
  // Firebase保存
  // -------------------------

  saveToFirebase();

  console.log("AI解析結果をアプリへ反映しました");
}

// ========================================
// キャンセル
// ========================================

function cancelAIResult() {
  const modal = document.getElementById("aiResultModal");

  if (modal) {
    modal.remove();
  }

  pendingAIResult = null;

  console.log("AI解析結果を破棄しました");
}
// ========== 起動 ==========
init();
