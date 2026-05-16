const database = firebase.database();
const auth = firebase.auth();
let currentUser = null;
let isAnonymous = false;

// ウィザード状態
let currentStep = 1;
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

const SUBJECT_LIST = [
  '国語', '数学', '英語', '理科', '社会', '体育',
  '音楽', '美術', '技術', '家庭科', '総合', '学活', '道徳', '委員会', 'テスト', 'なし'
];

// 送信先リスト（Firebaseから読み込み・保存）
let recipientList = ['katokato.s@icloud.com'];

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

// ========== 日付・ユーザー表示 ==========
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

// ========== データ読み込み ==========
function loadData() {
  const ref = database.ref('schoolSchedule/shared');
  ref.once('value', snapshot => {
    const data = snapshot.val();
    if (!data) {
      scheduleData = getDefaultSchedule();
      return;
    }

    // 今日の曜日のデータを読み込む
    const todayKey = getTodayKey();
    if (data[todayKey]) {
      scheduleData = data[todayKey].schedule || getDefaultSchedule();
      itemsData    = data[todayKey].items   || [];
      whiteboardText = data[todayKey].event || '';
    } else {
      // 全曜日データ（旧形式）がある場合
      const days = ['monday','tuesday','wednesday','thursday','friday'];
      const found = days.find(d => data[d]);
      if (found) {
        scheduleData = data[found].schedule || getDefaultSchedule();
        itemsData    = data[found].items   || [];
        whiteboardText = data[found].event || '';
      } else {
        scheduleData = getDefaultSchedule();
      }
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
  });
}

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
  if (isAnonymous || !currentUser) return;
  const todayKey = getTodayKey();
  database.ref(`schoolSchedule/shared/${todayKey}`).set({
    schedule: scheduleData,
    items: itemsData,
    event: whiteboardText
  });
  database.ref('schoolSchedule/shared/recipients').set(recipientList);
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
  if (currentStep >= 4) return;
  saveCurrentStepData();
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
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`si${i}`);
    el.className = 'step-item';
    if (i < currentStep) el.classList.add('completed');
    else if (i === currentStep) el.classList.add('active');
  }
}

function renderCurrentStep() {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step${i}Content`);
    if (el) el.style.display = i === currentStep ? 'block' : 'none';
  }
  if (currentStep === 1) renderStep1();
  else if (currentStep === 2) renderStep2();
  else if (currentStep === 3) renderStep3();
  else if (currentStep === 4) renderStep4();
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
      <input type="text" id="subject${i}" class="subject-input"
        value="${escHtml(p.subject)}"
        list="subjectList"
        placeholder="教科">
      <input type="text" id="desc${i}" class="desc-input"
        value="${escHtml(p.description)}"
        placeholder="内容">
    </div>
  `).join('') + `
    <datalist id="subjectList">
      ${SUBJECT_LIST.map(s => `<option value="${s}">`).join('')}
    </datalist>
  `;
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
  document.getElementById('tomorrowBtn').classList.toggle('active', type === 'tomorrow');
  document.getElementById('customDateBtn').classList.toggle('active', type === 'custom');
  if (type === 'tomorrow') updateSelectedDateDisplay();
}

function confirmDateTime() {
  if (scheduleDate === 'custom') {
    customDateValue = document.getElementById('customDate').value;
    customTimeValue = document.getElementById('customTime').value;
  }
  updateSelectedDateDisplay();
}

function updateSelectedDateDisplay() {
  const el = document.getElementById('selectedDateDisplay');
  if (!el) return;
  if (scheduleDate === 'tomorrow') {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    el.textContent = `${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()}`;
  } else if (customDateValue) {
    const parts = customDateValue.split('-');
    const timeStr = customTimeValue || '12:00';
    el.textContent = `${parts[0]}/${parseInt(parts[1])}/${parseInt(parts[2])} ${timeStr}`;
  } else {
    el.textContent = '日時を指定してください';
  }
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
    text += `【ホワイトボード】\n${whiteboardText}`;
  }

  document.getElementById('previewBox').textContent = text;
}

function getTargetDate() {
  if (scheduleDate === 'custom' && customDateValue) {
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
  const body     = encodeURIComponent(`※これは自動送信です。\n\n${bodyText}`);

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

// ========== 起動 ==========
init();
