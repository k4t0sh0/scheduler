const database = firebase.database();
const dataRef = database.ref('schoolSchedule');
const auth = firebase.auth();
let currentUser = null;
let isAnonymous = false;
//現在の曜日のデータとして参照
let scheduleData = [];
let itemsData = [];
let eventData = '';

// script.js の冒頭部分を変更
let currentDay = 'monday'; // 現在選択中の曜日を追跡
let allScheduleData = {
    monday: { schedule: [], items: [], event: '' },
    tuesday: { schedule: [], items: [], event: '' },
    wednesday: { schedule: [], items: [], event: '' },
    thursday: { schedule: [], items: [], event: '' },
    friday: { schedule: [], items: [], event: '' }
};

const SUBJECT_LIST = [
    '国語', '数学', '英語', '理科', '社会', '体育',
    '音楽', '美術', '技術', '家庭科', '総合', '学活', '道徳', '委員会', 'なし',
    'テスト'
];

const SUBJECT_COLORS = {
    '国語': '#fdecea',        // パステル赤
    '数学': '#e3f2fd',        // パステル青
    '英語': '#ede7f6',        // パステル紫
    '理科': '#e8f5e9',        // パステル緑
    '社会': '#fff3e0',        // パステル橙
    '体育': '#fffde7',        // パステル黄
    '音楽': '#fce4ec',        // パステルピンク
    '美術': '#fbe9e7',        // 赤〜橙（赤紫寄り）
    '技術': '#ffe0b2',        // オレンジ
    '家庭科': '#ffe0b2',      // オレンジ
    '総合': '#e1f5fe',        // 水色
    '学活': '#e1f5fe',        // 水色
    '道徳': '#e1f5fe',        // 水色
    '委員会': '#f1f8e9',      // 黄緑
    'テスト': '#e0f2f1',      //青緑よりミント
    'なし': '#ffffff'
};

function init() {
    // 認証状態の監視
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

function loadData() {
    if (!currentUser) return;

    const dataRef = database.ref('schoolSchedule/shared');

    dataRef.once('value', (snapshot) => {
        const data = snapshot.val();

        if (data && data.monday) {
            // 新しい曜日別構造
            allScheduleData = data;
        } else if (data && data.schedule) {
            // 古い構造からの移行
            const defaultData = {
                schedule: data.schedule || [],
                items: data.items || [],
                event: data.event || ''
            };
            // 全曜日に同じデータをコピー
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
                allScheduleData[day] = JSON.parse(JSON.stringify(defaultData));
            });
            if (!isAnonymous) {
                // 新構造で保存
                database.ref('schoolSchedule/shared').set(allScheduleData);
            }
        } else {
            // 完全に新規の場合
            initializeDefaultData();
            // ↓ この行を追加（匿名でなければ保存）
            if (!isAnonymous) {
                database.ref('schoolSchedule/shared').set(allScheduleData);
            }
        }

        loadCurrentDayData();
        renderAll();
    });

    // リアルタイム更新
    dataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.monday) {
            allScheduleData = data;
            loadCurrentDayData();
            renderAll();
        }
    });
}

// デフォルトデータの初期化
function initializeDefaultData() {
    const defaultSchedule = [
        { period: 1, subject: '国語', description: '漢字テスト、物語文' },
        { period: 2, subject: '算数', description: '分数のかけ算' },
        { period: 3, subject: '理科', description: '植物の観察' },
        { period: 4, subject: '社会', description: '日本の歴史' },
        { period: 5, subject: '体育', description: 'マット運動' },
        { period: 6, subject: '音楽', description: 'リコーダー' }
    ];
    const defaultItems = ['教科書', 'ノート', '筆記用具', '体育着', 'リコーダー', '給食セット'];
    const defaultEvent = '明日は通常授業です。';

    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => {
        allScheduleData[day] = {
            schedule: JSON.parse(JSON.stringify(defaultSchedule)),
            items: [...defaultItems],
            event: defaultEvent
        };
    });
}

// 現在の曜日のデータを読み込む
// 現在の曜日のデータを読み込む
function loadCurrentDayData() {
    // ディープコピーで完全に独立させる
    scheduleData = JSON.parse(JSON.stringify(allScheduleData[currentDay].schedule));
    itemsData = Array.isArray(allScheduleData[currentDay].items)
        ? [...allScheduleData[currentDay].items]
        : [];

    eventData = allScheduleData[currentDay].event;
}

// 曜日切り替え
function switchDay(day) {
    // 切り替え前に現在の曜日のデータを保存
    allScheduleData[currentDay] = {
        schedule: scheduleData,
        items: itemsData,
        event: eventData
    };

    currentDay = day;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('active');
        // クリックされたボタンにactiveを追加
        if (btn.textContent === getDayText(day)) {
            btn.classList.add('active');
        }
    });

    loadCurrentDayData();
    renderAll();
}

// 曜日名を取得するヘルパー関数
function getDayText(day) {
    const dayMap = {
        'monday': '月',
        'tuesday': '火',
        'wednesday': '水',
        'thursday': '木',
        'friday': '金'
    };
    return dayMap[day];
}

// 全体を再描画
function renderAll() {
    renderSchedule();
    renderItems();
    renderEvent();
}

// ログイン画面表示
function showAuth() {
    document.getElementById('authScreen').style.display = 'block';
    document.getElementById('appScreen').style.display = 'none';
}

// アプリ画面表示
function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    updateUserStatus();
    displayDate();
    updateUIForPermissions();
}

// ユーザーステータス表示
function updateUserStatus() {
    const status = document.getElementById('userStatus');
    if (isAnonymous) {
        status.textContent = '👤 匿名ユーザー（閲覧のみ）';
    } else {
        status.textContent = `👤 ${currentUser.displayName || currentUser.email}`;
    }
}

function updateUIForPermissions() {
    setTimeout(() => {
        const editButtons = document.querySelectorAll('.edit-btn');

        console.log('編集ボタン数:', editButtons.length);

        if (isAnonymous) {
            editButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            });
        }

        const dayButtons = document.querySelectorAll('.day-btn');

        if (isAnonymous) {
            editButtons.forEach(btn => {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            });

            dayButtons.forEach(btn => {
                btn.disabled = false;
            });

            // メールボタンの無効化処理を削除（ここを削除）
        }

        const existingNotice = document.querySelector('.readonly-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        if (isAnonymous) {
            const notice = document.createElement('div');
            notice.className = 'readonly-notice';
            notice.innerHTML = '<span>📖</span><span>閲覧専用モードです。編集するにはアカウント登録してください。</span>';

            const leftColumn = document.querySelector('.left-column');
            if (leftColumn && leftColumn.firstChild) {
                leftColumn.insertBefore(notice, leftColumn.firstChild);
            }
        }
    }, 100);
}

// Googleログイン
async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const errorDiv = document.getElementById('authError');
    try {
        await auth.signInWithPopup(provider);
        errorDiv.textContent = '';
    } catch (error) {
        errorDiv.textContent = 'Googleログインに失敗しました';
    }
}

// 匿名ログイン
async function anonymousLogin() {
    const errorDiv = document.getElementById('authError');
    try {
        await auth.signInAnonymously();
        errorDiv.textContent = '';
    } catch (error) {
        errorDiv.textContent = 'ログインに失敗しました';
    }
}

// ログアウト
async function logout() {
    try {
        await auth.signOut();
    } catch (error) {
        alert('ログアウトに失敗しました');
    }
}


// エラーメッセージ
function getErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'メールアドレスの形式が正しくありません';
        case 'auth/user-not-found':
            return 'ユーザーが見つかりません';
        case 'auth/wrong-password':
            return 'パスワードが間違っています';
        case 'auth/email-already-in-use':
            return 'このメールアドレスは既に使用されています';
        case 'auth/weak-password':
            return 'パスワードは6文字以上で設定してください';
        case 'auth/too-many-requests':
            return '試行回数が多すぎます。しばらくしてからお試しください';
        case 'auth/network-request-failed':
            return 'ネットワークエラーが発生しました';
        default:
            return 'エラーが発生しました: ' + code;
    }
}

// 日付表示
function displayDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('dateDisplay').textContent = tomorrow.toLocaleDateString('ja-JP', options);
}

// データ保存
function saveData() {
    if (isAnonymous) {
        alert('匿名ユーザーは編集できません。アカウント登録してください。');
        return;
    }

    // 現在の曜日のデータを更新
    allScheduleData[currentDay] = {
        schedule: scheduleData,
        items: itemsData,
        event: eventData
    };

    // 全曜日分を保存
    database.ref('schoolSchedule/shared').set(allScheduleData)
        .then(() => console.log('保存成功'))
        .catch((error) => {
            console.error('保存失敗:', error);
            alert('保存に失敗しました');
        });
}

// スケジュール表示
function renderSchedule() {
    const container = document.getElementById('scheduleList');

    // 説明文を改行する関数
    function formatDescription(text, maxLength = 25) {
        if (!text) return '';
        if (text.length <= maxLength) return text;

        // スペースや句読点で区切る
        const parts = text.split(/([、。\s,.])/);
        let result = '';
        let currentLine = '';

        for (let part of parts) {
            if (currentLine.length + part.length > maxLength && currentLine.length > 0) {
                result += currentLine + '<br>';
                currentLine = part;
            } else {
                currentLine += part;
            }
        }

        result += currentLine;
        return result || text;
    }

    container.innerHTML = scheduleData.map(period => {
        const bgColor = SUBJECT_COLORS[period.subject] || '#ffffff';
        const formattedDesc = formatDescription(period.description, 25);

        return `
            <div class="period-card" style="background:${bgColor}">
                <div class="period-number">${period.period}時間目</div>
                <div class="subject">${period.subject}</div>
                <div class="description">${formattedDesc}</div>
            </div>
        `;
    }).join('');
}


function renderItems() {
    const container = document.getElementById('itemsList');

    // アイテム名を改行する関数
    function formatItem(text, maxLength = 20) {
        if (!text) return '';
        if (text.length <= maxLength) return text;

        let result = '';
        for (let i = 0; i < text.length; i += maxLength) {
            result += text.substring(i, i + maxLength);
            if (i + maxLength < text.length) {
                result += '<br>';
            }
        }
        return result;
    }

    container.innerHTML = itemsData.map(item => {
        const formattedItem = formatItem(item, 20);
        return `<li>${formattedItem}</li>`;
    }).join('');
}

// 明日の予定表示
function renderEvent() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = tomorrow.getMonth() + 1;
    const date = tomorrow.getDate();

    // 長いテキストを適切な長さで改行する関数
    function insertLineBreaks(text, maxLength = 30) {
        if (!text) return '';

        // 既に改行がある場合はそのまま使用
        if (text.includes('\n')) {
            return text.replace(/\n/g, '<br>');
        }

        // 句読点で区切る
        const sentences = text.split(/([。、！？,.!?])/);
        let result = '';
        let currentLine = '';

        for (let i = 0; i < sentences.length; i++) {
            const part = sentences[i];

            if (currentLine.length + part.length > maxLength && currentLine.length > 0) {
                result += currentLine + '<br>';
                currentLine = part;
            } else {
                currentLine += part;
            }
        }

        result += currentLine;
        return result || text;
    }

    const formattedEvent = insertLineBreaks(eventData, 30);

    document.getElementById('eventBox').innerHTML =
        `<strong>📅 ${month}月${date}日の予定</strong><br>${formattedEvent}`;
}

function openScheduleModal() {
    const form = document.getElementById('scheduleForm');

    form.innerHTML = `
        <div class="schedule-edit-grid">
        ${scheduleData.map((period, index) => `
            <div class="form-group">
                <label>${period.period}時間目</label>

                <select id="subject${index}"
                    style="background:${SUBJECT_COLORS[period.subject] || '#fff'}"
                    onchange="this.style.backgroundColor = SUBJECT_COLORS[this.value]">
                    ${SUBJECT_LIST.map(sub =>
        `<option value="${sub}" ${sub === period.subject ? 'selected' : ''}>${sub}</option>`
    ).join('')}
                </select>

                <input type="text"
                    id="desc${index}"
                    value="${period.description}"
                    style="margin-top:6px;">
            </div>
        `).join('')}
        </div>
    `;

    document.getElementById('scheduleModal').style.display = 'flex';
}



// 持ち物編集モーダルを開く
function openItemsModal() {
    document.getElementById('itemsInput').value = itemsData.join('\n');
    document.getElementById('itemsModal').style.display = 'flex';
}

// 明日の予定編集モーダルを開く
function openEventModal() {
    document.getElementById('eventInput').value = eventData;
    document.getElementById('eventModal').style.display = 'flex';
}

// モーダルを閉じる
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// スケジュール保存
function saveSchedule() {
    if (isAnonymous) {
        alert('匿名ユーザーは編集できません');
        return;
    }
    scheduleData = scheduleData.map((period, index) => ({
        period: period.period,
        subject: document.getElementById(`subject${index}`).value,
        description: document.getElementById(`desc${index}`).value
    }));
    saveData();
    renderSchedule();
    closeModal('scheduleModal');
}

// 持ち物保存
function saveItems() {
    if (isAnonymous) {
        alert('匿名ユーザーは編集できません');
        return;
    }
    const input = document.getElementById('itemsInput').value;
    itemsData = input.split('\n').filter(item => item.trim() !== '');
    saveData();
    renderItems();
    closeModal('itemsModal');
}

// 明日の予定保存
function saveEvent() {
    if (isAnonymous) {
        alert('匿名ユーザーは編集できません');
        return;
    }
    eventData = document.getElementById('eventInput').value;
    saveData();
    renderEvent();
    closeModal('eventModal');
}

// モーダル外クリックで閉じる
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

function openAllBulkModal() {
    const body = document.querySelector('#allBulkModal .modal-body');

    body.innerHTML = `
        <div class="form-group">
            <label>📖 時間割（選択式）</label>
            ${scheduleData.map((p, i) => `
                <div style="display:flex; gap:8px; margin-bottom:6px;">
                    <span style="width:50px">${p.period}限</span>
                    <select id="bulkSubject${i}"
                        style="flex:1; background:${SUBJECT_COLORS[p.subject] || '#fff'}"
                        onchange="this.style.backgroundColor = SUBJECT_COLORS[this.value]">
                        ${SUBJECT_LIST.map(sub =>
        `<option value="${sub}" ${sub === p.subject ? 'selected' : ''}>${sub}</option>`
    ).join('')}
                    </select>
                    <input type="text" id="bulkDesc${i}" value="${p.description}" style="flex:2;">
                </div>
            `).join('')}
        </div>

        <div class="form-group">
            <label>🎒 持ち物</label>
            <textarea id="bulkItemsInput" rows="5">${itemsData.join('\n')}</textarea>
        </div>

        <div class="form-group">
            <label>🗓️ 明日の予定</label>
            <textarea id="bulkEventInput" rows="4">${eventData}</textarea>
        </div>
    `;

    document.getElementById('allBulkModal').style.display = 'flex';
}


function saveAllBulk() {
    if (isAnonymous) {
        alert('匿名ユーザーは編集できません');
        return;
    }

    scheduleData = scheduleData.map((p, i) => ({
        period: p.period,
        subject: document.getElementById(`bulkSubject${i}`).value,
        description: document.getElementById(`bulkDesc${i}`).value
    }));

    itemsData = document.getElementById('bulkItemsInput').value
        .split('\n')
        .map(i => i.trim())
        .filter(i => i !== '');


    eventData = document.getElementById('bulkEventInput').value;

    saveData();
    renderAll();
    closeModal('allBulkModal');
}

// メール送信時間設定モーダルを開く
function openEmailTimeModal() {
    // デフォルト設定にリセット
    document.querySelector('input[name="emailTimeOption"][value="none"]').checked = true;
    document.getElementById('emailCustomTimeInput').value = '';
    document.getElementById('emailCustomDateInput').value = '';
    document.getElementById('emailCustomDateTimeInput').value = '';
    toggleEmailTimeInput();

    document.getElementById('emailTimeModal').style.display = 'flex';
}

// 時間入力欄の有効/無効を切り替え
function toggleEmailTimeInput() {
    const customRadio = document.querySelector('input[name="emailTimeOption"][value="custom"]');
    const datetimeRadio = document.querySelector('input[name="emailTimeOption"][value="datetime"]');
    const timeInput = document.getElementById('emailCustomTimeInput');
    const dateInput = document.getElementById('emailCustomDateInput');
    const dateTimeInput = document.getElementById('emailCustomDateTimeInput');
    
    timeInput.disabled = !customRadio.checked;
    dateInput.disabled = !datetimeRadio.checked;
    dateTimeInput.disabled = !datetimeRadio.checked;
}

// 時間設定を確認してメール送信を実行
function confirmAndSendEmail() {
    const selectedOption = document.querySelector('input[name="emailTimeOption"]:checked').value;
    const customTime = document.getElementById('emailCustomTimeInput').value;
    const customDate = document.getElementById('emailCustomDateInput').value;
    const customDateTime = document.getElementById('emailCustomDateTimeInput').value;

    // カスタム時間が選択されているのに時間が入力されていない場合
    if (selectedOption === 'custom' && !customTime) {
        alert('時間を指定してください');
        return;
    }

    // 日にちと時間が選択されているのに入力されていない場合
    if (selectedOption === 'datetime' && (!customDate || !customDateTime)) {
        alert('日にちと時間を両方指定してください');
        return;
    }

    // モーダルを閉じる
    closeModal('emailTimeModal');

    // メール送信を実行
    executeEmailSend(selectedOption, customTime, customDate, customDateTime);
}

// 実際のメール送信処理
function executeEmailSend(timeOption, customTime, customDate, customDateTime) {
    // デフォルトは明日
    let targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    
    // 日付指定がある場合はそちらを使用
    if (timeOption === 'datetime' && customDate) {
        targetDate = new Date(customDate);
    }
    
    const month = targetDate.getMonth() + 1;
    const date = targetDate.getDate();

    // 時間文字列を取得
    let timeString = '';
    if (timeOption === 'custom') {
        // 時間のみ指定（HH:MM形式からHH//MM形式に変換）
        timeString = customTime.replace(':', '//');
    } else if (timeOption === 'datetime') {
        // 日にちと時間を指定
        const dateObj = new Date(customDate);
        const displayMonth = dateObj.getMonth() + 1;
        const displayDate = dateObj.getDate();
        const displayTime = customDateTime.replace(':', '//');
        timeString = `${displayMonth}//${displayDate}&${displayTime}`;
    }

    // 自動送信メッセージを作成
    const autoMessage = timeString
        ? `※これは自動送信です。\n（${timeString}）`
        : '※これは自動送信です。';

    // 数字を丸数字に変換する関数
    const toCircledNumber = (num) => {
        const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
        return circled[num - 1] || num;
    };

    // 「なし」で内容が空の場合のみ除外
    const validSchedule = scheduleData.filter(p => 
        !(p.subject === 'なし' && p.description.trim() === '')
    );

    // 持ち物をフィルタリング（空白のみの項目を除外）
    const validItems = itemsData.filter(item => item.trim() !== '');

    // 明日の予定が有効かチェック
    const validEvent = eventData.trim() !== '';

    const toEmail = 'chall823syouno327@gmail.com';
    const subject = encodeURIComponent('3ー3');

    let bodyText = `${autoMessage}\n【${month}月${date}日の予定】\n\n`;

    // 時間割セクション（授業がある場合のみ）
    if (validSchedule.length > 0) {
        bodyText += `【時間割】\n`;
        bodyText += validSchedule.map(p => {
            // 「なし」で内容がある場合は授業名を非表示
            if (p.subject === 'なし' && p.description.trim() !== '') {
                return `${toCircledNumber(p.period)}${p.description}`;
            } else {
                return `${toCircledNumber(p.period)}${p.subject} - ${p.description}`;
            }
        }).join('\n');
        bodyText += '\n\n';
    }

    // 持ち物セクション（項目がある場合のみ）
    if (validItems.length > 0) {
        bodyText += `【持ち物】\n`;
        bodyText += validItems.map(item => `・${item}`).join('\n');
        bodyText += '\n\n';
    }

    // ホワイトボードセクション（内容がある場合のみ）
    if (validEvent) {
        bodyText += `【ホワイトボード】\n${eventData}`;
    }

    const body = encodeURIComponent(bodyText);
    window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
}

function sendEmail() {
    if (!scheduleData || scheduleData.length === 0) {
        alert('スケジュールデータが読み込まれていません');
        return;
    }

    openEmailTimeModal();
}

// 初期化実行
init();