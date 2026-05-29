const database = firebase.database();
const auth = firebase.auth();
let currentUser = null;
let isAnonymous = false;

let wheelIndex = 0;
const dayKeys = ['monday','tuesday','wednesday','thursday','friday'];

// ウィザード状態
let currentStep = 1;
let currentDay = 'monday';
let scheduleData = [];
let itemsData = [];
let whiteboardText = '';
let classCount = 6;
let classDuration = 50;
let dismissalHour = 16;
let dismissalMin = 50;
let selectedRecipients = [];
let scheduleDate = 'tomorrow';
let customDateValue = '';
let customTimeValue = '';
let lettersData = [];
let testsData   = [];

const SUBJECT_LIST = [
  '国語', '数学', '英語', '理科', '社会', '体育',
  '音楽', '美術', '技術', '家庭科', '総合', '学活', '道徳', '委員会', 'テスト', 'なし'
];

// 送信先リスト（Firebaseから読み込み・保存）
let recipientList = ['katokato.s.javas@gmail.com'];

// ========== 初期化 ==========
function init() {
  auth.onAuthStateChanged(user => {
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
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';
  displayDate();
  updateUserDisplay();
  showHomeView();
  initDayWheel();
}

function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('authError').textContent = '';
}

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('authError').textContent = '';
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
    document.getElementById('authError').textContent = '';
  } catch (e) {
    document.getElementById('authError').textContent = getErrorMessage(e.code);
  }
}

async function register() {
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    document.getElementById('authError').textContent = '';
  } catch (e) {
    document.getElementById('authError').textContent = getErrorMessage(e.code);
  }
}

async function anonymousLogin() {
  try {
    await auth.signInAnonymously();
  } catch (e) {
    document.getElementById('authError').textContent = 'ログインに失敗しました';
  }
}

async function logout() {
  saveMemo();
  await auth.signOut();
}

function getErrorMessage(code) {
  const map = {
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/user-not-found': 'ユーザーが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/weak-password': 'パスワードは6文字以上で設定してください',
    'auth/too-many-requests': '試行回数が多すぎます。しばらくしてからお試しください',
  };
  return map[code] || 'エラーが発生しました: ' + code;
}

// ========== 曜日変更・日付・ユーザー表示 ==========
function displayDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const w = days[today.getDay()];
  document.getElementById('dateDisplay').textContent = `${y}-${m}-${d}（${w}）`;
}

function updateUserDisplay() {
  document.getElementById('userEmail').textContent =
    isAnonymous ? '匿名ユーザー' : (currentUser?.email || '');
}

// ① loadData はメモ・送信先など「共通データ」だけ読む
function loadData() {
  const ref = database.ref('schoolSchedule/shared');
  ref.once('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      scheduleData = getDefaultSchedule();
      return;
    }

    // メモ
    if (data.memo) {
      const el = document.getElementById('memoBox');
      if (el) el.innerHTML = data.memo;
    }

    // 送信先リスト
    if (data.recipients && Array.isArray(data.recipients)) {
      recipientList = data.recipients;
    }

    // 曜日データを読み込む（初回はmonday固定）
    loadDayData(currentDay, data);

    if (data.letters) lettersData = Object.values(data.letters);

    if (data.tests)   testsData   = Object.values(data.tests);
  });
}

// ② 曜日ごとのデータ読み込みを独立した関数に
function loadDayData(day, data) {
  if (data && data[day]) {
    scheduleData   = data[day].schedule || getDefaultSchedule();
    itemsData      = data[day].items    || [];
    whiteboardText = data[day].event    || '';
  } else {
    scheduleData   = getDefaultSchedule();
    itemsData      = [];
    whiteboardText = '';
  }
}

// ③ 曜日切り替え時はFirebaseを再取得して loadDayData を呼ぶ
function switchDay(day) {
  currentDay = day;

  database.ref('schoolSchedule/shared').once('value', snapshot => {
    loadDayData(day, snapshot.val());
  });

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.day === day);
  });
}

// ========== 曜日変更 ==========
// スクロールで回す
function getTodayKey() {
  const keys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return keys[new Date().getDay()];
}

function getDefaultSchedule() {
  const subjects = ['国語','数学','社会','理科','英語','家庭科'];
  return subjects.map((s, i) => ({ period: i + 1, subject: s, description: '' }));
}

// ========== データ保存 ==========
function saveToFirebase() {
  if (isAnonymous || !currentUser) return
  database.ref(`schoolSchedule/shared/${currentDay}`).set({
    schedule: scheduleData,
    items: itemsData,
    event: whiteboardText
  });
  database.ref('schoolSchedule/shared/recipients').set(recipientList);
  database.ref('schoolSchedule/shared/letters').set(lettersData);
  database.ref('schoolSchedule/shared/tests').set(testsData);
  saveMemo();
}

function saveMemo() {
  if (isAnonymous || !currentUser) return;
  const el = document.getElementById('memoBox');
  if (el) {
    database.ref('schoolSchedule/shared/memo').set(el.innerHTML);
  }
}


// ========== 画面切り替え ==========
function showHomeView() {
  document.getElementById('homeView').style.display = 'flex';
  document.getElementById('wizardView').style.display = 'none';
  document.getElementById('headerCenter').innerHTML = `
    <button class="header-mode-btn ai" onclick="startManual()">🔍📊 AI画像解析</button>
  `;
}

function startManual() {
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('wizardView').style.display = 'flex';
  document.getElementById('headerCenter').innerHTML = `
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
    const inputs = document.querySelectorAll('.item-edit-input');
    itemsData = Array.from(inputs).map(el => el.value).filter(v => v.trim());
    classCount    = parseInt(document.getElementById('classCount')?.value) || 6;
    classDuration = parseInt(document.getElementById('classDuration')?.value) || 50;
    dismissalHour = parseInt(document.getElementById('dismissalHour')?.value) || 16;
    dismissalMin  = parseInt(document.getElementById('dismissalMin')?.value) || 50;
    whiteboardText = document.getElementById('whiteboardText')?.value || '';
  }
}

function updateStepIndicator() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`si${i}`);
    el.className = 'step-item';
    if (i < currentStep) el.classList.add('completed');
    else if (i === currentStep) el.classList.add('active');
  }
}

function renderCurrentStep() {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`step${i}Content`);
    if (el) el.style.display = i === currentStep ? 'block' : 'none';
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
    scheduleData.push({ period: n, subject: 'なし', description: '' });
  }

  document.getElementById('scheduleInputs').innerHTML = scheduleData.map((p, i) => `
  <div class="schedule-row">
    <div class="period-num">${i + 1}</div>
    <select id="subject${i}" class="subject-select">
      ${SUBJECT_LIST.map(s =>
        `<option value="${s}" ${s === p.subject ? 'selected' : ''}>${s}</option>`
      ).join('')}
    </select>
    <input type="text" id="desc${i}" class="desc-input"
      value="${escHtml(p.description)}"
      placeholder="内容">
  </div>
`).join('');
}

// ========== Step 2: 持ち物 ==========
function renderStep2() {
  document.getElementById('itemsEditList').innerHTML = itemsData.map((item, i) => `
    <li class="item-edit-row">
      <span class="item-bullet">・</span>
      <input type="text" class="item-edit-input" value="${escHtml(item)}">
      <button class="item-delete-btn" onclick="removeItem(${i})">×</button>
    </li>
  `).join('');

  document.getElementById('classCount').value    = classCount;
  document.getElementById('classDuration').value = classDuration;
  document.getElementById('dismissalHour').value = dismissalHour;
  document.getElementById('dismissalMin').value  = dismissalMin;
  document.getElementById('whiteboardText').value = whiteboardText;
}

function addItem() {
  const inputs = document.querySelectorAll('.item-edit-input');
  itemsData = Array.from(inputs).map(el => el.value);
  itemsData.push('');
  renderStep2();
  const all = document.querySelectorAll('.item-edit-input');
  if (all.length) all[all.length - 1].focus();
}

function removeItem(index) {
  const inputs = document.querySelectorAll('.item-edit-input');
  itemsData = Array.from(inputs).map(el => el.value);
  itemsData.splice(index, 1);
  renderStep2();
}

// ========== Step 3: 送信先 ==========
function renderStep3() {
  document.getElementById('recipientList').innerHTML = recipientList.map(email => `
    <button class="recipient-btn ${selectedRecipients.includes(email) ? 'selected' : ''}"
      onclick="toggleRecipient('${escHtml(email)}')">
      ${escHtml(email)}
    </button>
  `).join('');

  document.getElementById('tomorrowBtn').classList.toggle('active', scheduleDate === 'tomorrow');
  document.getElementById('customDateBtn').classList.toggle('active', scheduleDate === 'custom');
  updateSelectedDateDisplay();
}

function toggleRecipient(email) {
  const idx = selectedRecipients.indexOf(email);
  if (idx >= 0) selectedRecipients.splice(idx, 1);
  else selectedRecipients.push(email);
  renderStep3();
}

function addCustomRecipient() {
  const email = prompt('送信先メールアドレスを入力してください:');
  if (email && email.includes('@')) {
    if (!recipientList.includes(email)) recipientList.push(email);
    if (!selectedRecipients.includes(email)) selectedRecipients.push(email);
    renderStep3();
  }
}

function selectDateType(type) {
  scheduleDate = type;
  const wrap = document.getElementById('customDateTimeWrap');
  wrap.style.display = type === 'custom' ? 'block' : 'none';
  document.getElementById('tomorrowBtn').classList.toggle('active',   type === 'tomorrow');
  document.getElementById('nextMondayBtn').classList.toggle('active', type === 'nextMonday');
  document.getElementById('customDateBtn').classList.toggle('active', type === 'custom');
  updateSelectedDateDisplay();
}

function confirmDateTime() {
  if (scheduleDate === 'custom') {
    customDateValue = document.getElementById('customDate').value;
    const timeEl = document.getElementById('customTime');
    customTimeValue = timeEl ? timeEl.value : '';
  }
  updateSelectedDateDisplay();

  // Firebaseに送信予定日を保存
  const target = getTargetDate();
  const yyyy = target.getFullYear();
  const mm   = String(target.getMonth() + 1).padStart(2, '0');
  const dd   = String(target.getDate()).padStart(2, '0');
  database.ref('schoolSchedule/shared/scheduledDate').set(`${yyyy}-${mm}-${dd}`);

  // 曜日ホイールを対象日に自動で合わせる
  const dayKeys2    = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const targetDayKey = dayKeys2[target.getDay()];
  const wheelIdx    = ['monday','tuesday','wednesday','thursday','friday'].indexOf(targetDayKey);
  if (wheelIdx >= 0) {
    wheelIndex = wheelIdx;
    currentDay = targetDayKey;
    updateWheelDisplay();
    database.ref('schoolSchedule/shared').once('value', snapshot => {
      loadDayData(currentDay, snapshot.val());
    });
  }
}

function updateSelectedDateDisplay() {
  const el = document.getElementById('selectedDateDisplay');
  if (!el) return;

  if (scheduleDate === 'tomorrow') {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    el.textContent = t.getFullYear() + '/' + (t.getMonth()+1) + '/' + t.getDate();

  } else if (scheduleDate === 'nextMonday') {
    const nm = getNextMonday();
    el.textContent = nm.getFullYear() + '/' + (nm.getMonth()+1) + '/' + nm.getDate() + '（月）';

  } else if (scheduleDate === 'custom' && customDateValue) {
    const parts = customDateValue.split('-');
    el.textContent = parts[0] + '/' + parseInt(parts[1]) + '/' + parseInt(parts[2]);

  } else {
    el.textContent = '日時を指定してください';
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
  const date  = targetDate.getDate();

  const circled = ['①','②','③','④','⑤','⑥','⑦','⑧'];

  let text = `【${month}月${date}日の予定】\n\n`;

  const validSchedule = scheduleData.filter(p =>
    !(p.subject === 'なし' && !p.description.trim())
  );

  if (validSchedule.length) {
    text += '【時間割】\n';
    text += validSchedule.map(p => {
      const num = circled[p.period - 1] || p.period;
      if (p.subject === 'なし') return `${num}${p.description}`;
      return `${num}${p.subject}${p.description ? ' - ' + p.description : ''}`;
    }).join('\n');
    text += '\n\n';
  }

  const cc = String(classCount).padStart(1,'0');
  const cm = String(classDuration).padStart(2, '0');
  text += `授業数：${cm}分×${cc}\n`;

  const hh = String(dismissalHour).padStart(2,'0');
  const mm = String(dismissalMin).padStart(2,'0');
  text += `下校時間：${hh}:${mm}\n\n`;

  const validItems = itemsData.filter(i => i.trim());
  if (validItems.length) {
    text += '【持ち物】\n';
    text += validItems.map(i => `・${i}`).join('\n');
    text += '\n\n';
  }

  if (whiteboardText.trim()) {
    text += `【ホワイトボード】\n${whiteboardText}\n\n`;
  }

  document.getElementById('previewBox').textContent = text;
}

function getTargetDate() {
  if (scheduleDate === 'nextMonday') {  // ← 追加
    return getNextMonday();             // ← 追加
  }
  if (scheduleDate === 'custom' && customDateValue) {
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
    alert('送信先を選択してください（ステップ③）');
    goToStep(3);
    return;
  }

  const bodyText = document.getElementById('previewBox').textContent;
  const toEmail  = selectedRecipients.join(',');
  const subject  = encodeURIComponent('3-2');
  const body     = encodeURIComponent(`${bodyText}`);

  saveToFirebase();
  window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
}

// ========== ユーティリティ ==========
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initDayWheel() {
  updateWheelDisplay();

  const wheel = document.getElementById('dayWheelWrapper');

  // スクロールで回す
  wheel.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) rotateWheel(1);
    else rotateWheel(-1);
  }, { passive: false });

  // タッチスワイプで回す
  let touchStartY = 0;
  wheel.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });
  wheel.addEventListener('touchend', (e) => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 20) rotateWheel(diff > 0 ? 1 : -1);
  });

  // クリックで上下移動
  wheel.addEventListener('click', (e) => {
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
  database.ref('schoolSchedule/shared').once('value', snapshot => {
    loadDayData(currentDay, snapshot.val());

    const wizardVisible = document.getElementById('wizardView').style.display !== 'none';
    if ( wizardVisible) {
      renderCurrentStep();
    }
  });
}

function updateWheelDisplay() {
  const items = document.querySelectorAll('.day-wheel-item');
  items.forEach((item, i) => {
    const dist = i - wheelIndex;
    item.setAttribute('data-dist', dist);
  });
}

// ========== Arrow-button ==========
window.addEventListener("keydown", function(event) {
  // ウィザード画面が表示されていない時は処理しない
  const wizardView = document.getElementById('wizardView');
  if (!wizardView || wizardView.style.display === 'none') return;

  // 現在、文字入力中の場合は、矢印キーの本来の挙動（カーソル移動など）を優先するため処理しない
  const activeEl = document.activeElement;
  if (activeEl && (
    activeEl.tagName === 'INPUT' || 
    activeEl.tagName === 'TEXTAREA' || 
    activeEl.getAttribute('contenteditable') === 'true'
  )) {
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
  document.getElementById('letterList').innerHTML = lettersData.map((l, i) => `
    <li class="manage-row">
      <input class="manage-input" placeholder="名前（例：手紙1）"
        value="${escHtml(l.name || '')}"
        oninput="lettersData[${i}].name=this.value; saveToFirebase()">
      <input class="manage-input date" type="date"
        value="${l.date || ''}"
        oninput="lettersData[${i}].date=this.value; saveToFirebase()">
      <button class="item-delete-btn" onclick="removeLetter(${i})">×</button>
    </li>
  `).join('');

document.getElementById('testList').innerHTML = testsData.map((t, i) => `
  <li style="border:1px solid #eee; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;">

    <!-- 1段目：テスト名 + 削除ボタン -->
    <div style="display:flex; align-items:center; gap:8px;">
      <select class="manage-input select-test" style="flex:1;"
        oninput="testsData[${i}].testName=this.value; saveToFirebase()">
        <option value="">テスト名を選択</option>
        ${['前期中間テスト','前期期末テスト','後期中間テスト','学年末テスト','単元テスト','実力テスト'].map(n =>
          `<option value="${n}" ${t.testName === n ? 'selected' : ''}>${n}</option>`
        ).join('')}
      </select>
      <button class="item-delete-btn" onclick="removeTest(${i})">×</button>
    </div>

    <!-- 2段目：科目 + 内容 + 日付 -->
    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <select class="manage-input select-test" style="width:90px; flex:none;"
        oninput="testsData[${i}].subject=this.value; saveToFirebase()">
        <option value="">科目（任意）</option>
        ${['英語','数学','国語','理科','社会','技術','家庭科','音楽','美術','保体'].map(s =>
          `<option value="${s}" ${t.subject === s ? 'selected' : ''}>${s}</option>`
        ).join('')}
      </select>
      <input class="manage-input" placeholder="内容（任意）"
        value="${escHtml(t.content || '')}"
        oninput="testsData[${i}].content=this.value; saveToFirebase()"
        style="flex:1; min-width:100px;">
      <input class="manage-input date" type="date"
        value="${t.date || ''}"
        oninput="testsData[${i}].date=this.value; saveToFirebase()">
    </div>

    <!-- 3段目：範囲表URL -->
    <input class="manage-input" placeholder="範囲表URL（省略可）"
      value="${escHtml(t.driveUrl || '')}"
      oninput="testsData[${i}].driveUrl=this.value; saveToFirebase()"
      style="width:100%;">

  </li>
`).join('');
      }

function addLetter() {
  lettersData.push({ name: '', date: '' });
  saveToFirebase();
  renderManageView();
}

function removeLetter(i) {
  lettersData.splice(i, 1);
  saveToFirebase();
  renderManageView();
}

function addTest() {
  testsData.push({ subject: '', content: '', date: '', driveUrl: '' });
  saveToFirebase();
  renderManageView();
}

function removeTest(i) {
  testsData.splice(i, 1);
  saveToFirebase();
  renderManageView();
}

// ========== 起動 ==========
init();
