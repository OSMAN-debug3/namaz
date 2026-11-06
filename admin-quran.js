/* ================= SUPREME ADMIN & FAST 1-CLICK IMAGE QURAN MODULE ================= */

function renderSupremeAdminPanel() {
    if (!isUserAdmin()) return;
    const currentDate = document.getElementById('reportDate').value || todayStr;
    document.getElementById('admPendingDateBadge').innerText = `📅 ${currentDate}`;

    const todaySubmittedSet = new Set(globalReports.filter(r => cleanDateString(r.date) === currentDate).map(r => r.name.toLowerCase()));
    const pendingMembers = globalUsers.filter(u => !todaySubmittedSet.has(u.name.toLowerCase()));

    document.getElementById('admStatTotalUsers').innerText = globalUsers.length;
    document.getElementById('admStatTodaySub').innerText = todaySubmittedSet.size;
    document.getElementById('admStatPending').innerText = pendingMembers.length;
    document.getElementById('admStatTotalReports').innerText = globalReports.length;
    document.getElementById('admDirectoryCountBadge').innerText = `${globalUsers.length} Members`;

    const qSelect = document.getElementById('admQuickUserSelect');
    const prevVal = qSelect.value;
    qSelect.innerHTML = globalUsers.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
    if (prevVal) qSelect.value = prevVal;

    const pendingBox = document.getElementById('admPendingUsersList');
    pendingBox.innerHTML = pendingMembers.length === 0
        ? `<div style="text-align:center; color:var(--emerald-bright); font-size:12px; padding:10px;">🌟 Aaj sabhi members ne report bhej di hai!</div>`
        : pendingMembers.map(u => {
            const safeName = u.name.replace(/'/g, "\\'");
            return `
                <div class="admin-user-row">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:30px; height:30px; border-radius:6px; object-fit:cover; border:1px solid var(--gold);">
                        <strong>${u.name}</strong>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button type="button" class="admin-mini-btn" onclick="adminSendDirectReminder('${safeName}')">💬 Remind</button>
                        <button type="button" class="admin-mini-btn" onclick="openMemberProfile('${safeName}')">📜 History</button>
                    </div>
                </div>
            `;
        }).join('');

    const dirBox = document.getElementById('admAllMembersDirectory');
    dirBox.innerHTML = globalUsers.map(u => {
        const uReports = getValidUniqueUserReports(u.name);
        const safeName = u.name.replace(/'/g, "\\'");
        const safePass = (u.password || '').replace(/'/g, "\\'");
        return `
            <div class="admin-user-row">
                <div style="display:flex; align-items:center; gap:9px;">
                    <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:38px; height:38px; border-radius:6px; object-fit:cover; border:1.5px solid var(--gold);">
                    <div>
                        <div style="font-weight:800; color:var(--gold-light); font-size:13px;">${u.name}</div>
                        <div style="font-size:10.5px; color:#a7f3d0;">🔑 PIN: <strong>${u.password || '****'}</strong> | 📅 Joined: <strong>${u.createdAt || '-'}</strong> | 📊 Days: ${uReports.length}</div>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button type="button" class="admin-mini-btn" onclick="adminEditMemberCredentials('${safeName}', '${safePass}')">✏️ Edit</button>
                    <button type="button" class="admin-mini-btn danger" onclick="adminRemoveMember('${safeName}')">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');

    runAdminMemberLookup();
}

function runAdminMemberLookup() {
    const inputEl = document.getElementById('adminLookupInput');
    const resultBox = document.getElementById('adminLookupResultBox');
    if (!inputEl || !resultBox) return;
    const query = (inputEl.value || '').trim().toLowerCase();
    if (!query) {
        resultBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11.5px; padding:8px;">Upar kisi bhi member ka Naam type karein.</div>`;
        return;
    }
    const matched = globalUsers.filter(u => u.name.toLowerCase().includes(query) || String(u.serial) === query.replace('#', ''));
    resultBox.innerHTML = matched.map(u => {
        const uRecords = getValidUniqueUserReports(u.name);
        let totalPts = 0;
        uRecords.forEach(r => totalPts += calculateSingleReportPoints(r));
        return `<div style="padding:10px; border:1px solid var(--gold); border-radius:10px; margin-bottom:8px;"><strong>${u.name}</strong> — ⭐ ${totalPts} Pts (${uRecords.length} Days) | PIN: ${u.password || '****'}</div>`;
    }).join('');
}

async function adminFormatAndSyncAllSheets() {
    const btn = document.getElementById('formatSheetsBtn');
    btn.disabled = true;
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'formatAllSheets' }) });
        alert('✅ Sabhi Google Sheets VIP design mein set ho gayin!');
    } catch (e) {
        alert('✅ Request bhej di gayi!');
    } finally {
        btn.disabled = false;
    }
}

async function adminSendDirectReminder(memberName) {
    const msgId = 'm_' + Date.now();
    const text = `Assalamu Alaikum ${memberName}! 🌙 Aaj ki Namaz report ZikrSphere par save kar lein.`;
    const encodedPayload = `CHAT2|${msgId}|ABBU SHAHMA|${memberName}|1|${text}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: encodedPayload });
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(encodedPayload)}`); alert(`✅ Reminder sent!`); } catch (e) {}
}

async function RemindAllDefaultersBroadcast() {
    const bId = 'b_' + Date.now();
    const encodedPayload = `BROADCAST2|${bId}|ABBU SHAHMA|ALL|🌙 Namaz Report Reminder::Assalamu Alaikum! Aaj ki Namaz report ZikrSphere par darj kar lein.`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: encodedPayload });
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(encodedPayload)}`); alert('✅ Broadcast sent!'); } catch (e) {}
}

async function adminQuickSubmitReport() {
    const targetUser = document.getElementById('admQuickUserSelect').value;
    const preset = document.getElementById('admQuickPreset').value;
    const date = document.getElementById('admQuickDateInput').value || todayStr;
    if (!targetUser) return;
    const params = new URLSearchParams({
        action: 'save', name: targetUser, date, day: getDayNameFromDate(date), time: getCurrent12HourTime(),
        fajr: 'Ada', zuhr: 'Ada', asr: 'Ada', maghrib: 'Ada', isha: 'Ada',
        tahajjud: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi',
        duha: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi',
        roza: preset === 'AllAdaPlus' ? 'Rakha' : 'Nahi',
        quran: preset === 'AllAdaPlus' ? '1 Page' : 'Nahi',
        tarawih: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi'
    });
    try { await fetch(`${SCRIPT_URL}?${params.toString()}`); alert('✅ Saved!'); fetchAllDataAndRefresh(); } catch (e) {}
}

async function adminEditMemberCredentials(oldName, currentPass) {
    const newName = prompt(`Naya Naam:`, oldName);
    if (!newName) return;
    const newPass = prompt(`Naya PIN:`, currentPass);
    if (!newPass) return;
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateAccount', oldName, newName: newName.trim(), newPassword: newPass.trim() }) });
        fetchAllDataAndRefresh();
    } catch (e) {}
}

async function adminRemoveMember(targetUser) {
    if (!confirm(`Delete "${targetUser}"?`)) return;
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'adminDeleteUser', targetUser, deleteReports: true }) });
        fetchAllDataAndRefresh();
    } catch (e) {}
}

function exportMasterDatabaseCSV() {
    if (globalReports.length === 0) return alert('No records!');
    let csv = "data:text/csv;charset=utf-8,Date,Day,Time,Name,Fajr,Zuhr,Asr,Maghrib,Isha,Tahajjud,Duha,Roza,Quran,Tarawih\n";
    globalReports.forEach(r => {
        csv += `${cleanDateString(r.date)},${r.day || ''},${r.time || '-'},${r.name},${r.fajr},${r.zuhr},${r.asr},${r.maghrib},${r.isha},${r.tahajjud || 'Nahi'},${r.duha || 'Nahi'},${r.roza},${r.quran},${r.tarawih}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `ZikrSphere_Master_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ================= FAST 1-CLICK IMAGE-ONLY QURAN & ZIKR INJECTION ================= */
const quranJuzStartPages = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
let currentQuranPageNo = 1;
const quranImageCache = {};
let zikrCount = parseInt(localStorage.getItem('zikr_tasbeeh') || '0');

function injectQuranAndCleanStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      body.zs-logged-out #notifBellBtn,
      body.zs-logged-out #supremeAdminHeaderBadge,
      body.zs-logged-out #hijriDateBadge,
      body.zs-logged-out .zs-auth-only,
      .serial-pill { display: none !important; }
      #bottomNavBar .bottom-nav-inner { display:flex !important; flex-wrap:wrap !important; justify-content:center !important; gap:6px !important; }
      #zikr-quran-modal { display:none; position:fixed; inset:0; background:#071712; z-index:999999; overflow-y:auto; }
      .zq-top-bar { position:sticky; top:0; z-index:1000; background:#041f16; border-bottom:1.5px solid #d4af37; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; color:#fff; }
      .zq-page-frame { max-width:650px; margin:8px auto 30px auto; background:#fff; padding:4px; position:relative; border-radius:4px; }
      #quran-red-ribbon { display:none; position:absolute; top:0; left:24px; width:24px; height:64px; background:linear-gradient(180deg,#991b1b,#ef4444); z-index:30; clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%); }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'zikr-quran-modal';
    modal.innerHTML = `
      <div class="zq-top-bar">
        <div style="display:flex; gap:6px;">
          <button type="button" onclick="switchZQModalTab('quran')" style="background:#d4af37; color:#041610; border:none; padding:6px 12px; border-radius:6px; font-weight:800; cursor:pointer;">📖 Quran Pak</button>
          <button type="button" onclick="switchZQModalTab('zikr')" style="background:#082e22; color:#fde047; border:1px solid #d4af37; padding:6px 12px; border-radius:6px; font-weight:700; cursor:pointer;">📿 Tasbeeh</button>
        </div>
        <div id="zqQuranControls" style="display:flex; gap:6px; align-items:center;">
          <select id="zqJuzSelect" onchange="if(this.value) loadInstantQuranPage(this.value)" style="padding:5px; border-radius:6px; background:#031710; color:#fff; border:1px solid #10b981;">
            <option value="">Para (1-30)</option>
          </select>
          <button type="button" onclick="saveCurrentQuranBookmark()" style="background:#10b981; color:#041610; border:none; padding:6px 10px; border-radius:6px; font-weight:800; cursor:pointer;">🔖 Nishani</button>
          <button type="button" onclick="openSavedQuranBookmark()" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-weight:800; cursor:pointer;">👉 Meri Nishani</button>
        </div>
        <button type="button" onclick="closeZikrQuranSection()" style="background:#374151; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-weight:700; cursor:pointer;">✖ Band Karein</button>
      </div>
      <div id="zqQuranView">
        <div style="max-width:650px; margin:8px auto; padding:0 10px; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" onclick="stepQuranPage(1)" style="background:#0284c7; color:#fff; border:none; padding:9px 16px; border-radius:6px; font-weight:800; cursor:pointer;">⬅️ Agla Safha</button>
          <div style="color:#fff; font-weight:700;">Safha: <input type="number" id="zqPageNumberInput" min="1" max="604" value="1" onchange="loadInstantQuranPage(this.value)" style="width:58px; text-align:center; padding:5px; border-radius:5px; font-weight:800;"> / 604</div>
          <button type="button" onclick="stepQuranPage(-1)" style="background:#0284c7; color:#fff; border:none; padding:9px 16px; border-radius:6px; font-weight:800; cursor:pointer;">Pichla Safha ➡️</button>
        </div>
        <div class="zq-page-frame">
          <div id="quran-red-ribbon"></div>
          <img id="instantQuranPageImg" src="" alt="Quran Safha" style="width:100%; height:auto; display:block;" />
        </div>
      </div>
      <div id="zqZikrView" style="display:none; max-width:500px; margin:20px auto; padding:16px; background:#08291e; border:1px solid #d4af37; border-radius:12px; color:#fff; text-align:center;">
        <h3 style="color:#d4af37; margin-top:0;">📳 Digital Tasbeeh</h3>
        <div id="tasbeeh-count" style="font-size:46px; font-weight:800; color:#4ade80; margin:12px 0;">${zikrCount}</div>
        <button type="button" onclick="tapTasbeeh()" style="width:125px; height:125px; border-radius:50%; background:linear-gradient(135deg,#10b981,#047857); color:#fff; font-size:18px; font-weight:800; border:3px solid #d4af37; cursor:pointer;">TAP ZIKR</button>
        <div style="margin-top:12px;"><button type="button" onclick="resetTasbeeh()" style="background:transparent; color:#f87171; border:1px solid #f87171; padding:6px 16px; border-radius:6px; cursor:pointer;">Reset</button></div>
      </div>
    `;
    document.body.appendChild(modal);

    const juzSel = document.getElementById('zqJuzSelect');
    quranJuzStartPages.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.text = `Para ${idx + 1} (Safha ${p})`;
        juzSel.appendChild(opt);
    });
    preloadQuranPagesAround(1);
}

function getFastQuranPageUrl(pageNo) {
    const padded = String(pageNo).padStart(3, '0');
    return `https://wsrv.nl/?url=raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${padded}.png&output=webp&q=85`;
}

function preloadQuranPagesAround(pageNo) {
    [pageNo, pageNo + 1, pageNo + 2, pageNo + 3, pageNo - 1].forEach(p => {
        if (p >= 1 && p <= 604 && !quranImageCache[p]) {
            const img = new Image();
            img.src = getFastQuranPageUrl(p);
            quranImageCache[p] = img;
        }
    });
}

function openZikrQuranSection() {
    document.getElementById('zikr-quran-modal').style.display = 'block';
    loadInstantQuranPage(1);
}

function closeZikrQuranSection() {
    document.getElementById('zikr-quran-modal').style.display = 'none';
}

function switchZQModalTab(tab) {
    const isQ = (tab === 'quran');
    document.getElementById('zqQuranView').style.display = isQ ? 'block' : 'none';
    document.getElementById('zqQuranControls').style.display = isQ ? 'flex' : 'none';
    document.getElementById('zqZikrView').style.display = isQ ? 'none' : 'block';
}

function loadInstantQuranPage(pageNo) {
    pageNo = Math.max(1, Math.min(604, parseInt(pageNo) || 1));
    currentQuranPageNo = pageNo;
    document.getElementById('zqPageNumberInput').value = pageNo;
    const imgEl = document.getElementById('instantQuranPageImg');
    imgEl.src = (quranImageCache[pageNo] && quranImageCache[pageNo].complete) ? quranImageCache[pageNo].src : getFastQuranPageUrl(pageNo);
    const saved = parseInt(localStorage.getItem('zs_saved_mushaf_page') || '0');
    document.getElementById('quran-red-ribbon').style.display = (saved === pageNo) ? 'block' : 'none';
    preloadQuranPagesAround(pageNo);
}

function stepQuranPage(delta) {
    loadInstantQuranPage(currentQuranPageNo + delta);
    document.getElementById('zikr-quran-modal').scrollTo({ top: 0, behavior: 'instant' });
}

function saveCurrentQuranBookmark() {
    localStorage.setItem('zs_saved_mushaf_page', currentQuranPageNo);
    document.getElementById('quran-red-ribbon').style.display = 'block';
    alert(`🔖 Safha No. ${currentQuranPageNo} par Nishani lag gayi!`);
}

function openSavedQuranBookmark() {
    const saved = parseInt(localStorage.getItem('zs_saved_mushaf_page') || '0');
    if (!saved) return alert('Abhi koi Nishani save nahi hai!');
    loadInstantQuranPage(saved);
}

function tapTasbeeh() {
    zikrCount++;
    localStorage.setItem('zikr_tasbeeh', zikrCount);
    document.getElementById('tasbeeh-count').innerText = zikrCount;
    if (navigator.vibrate) navigator.vibrate((zikrCount % 33 === 0 || zikrCount % 100 === 0) ? [120, 60, 250] : 35);
}

function resetTasbeeh() {
    zikrCount = 0;
    localStorage.setItem('zikr_tasbeeh', 0);
    document.getElementById('tasbeeh-count').innerText = 0;
}

window.addEventListener('DOMContentLoaded', injectQuranAndCleanStyles);
