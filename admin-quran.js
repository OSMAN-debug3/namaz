/* ================= SUPREME ADMIN & CLEAN LEFT/RIGHT TAP QURAN MODULE ================= */

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
                        <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid var(--gold);">
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
                    <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1.5px solid var(--gold);">
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

/* ================= FLOATING QURAN PILL BUTTON & LEFT/RIGHT TAP QURAN READER ================= */
const quranJuzStartPages = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
let currentQuranPageNo = 1;
const quranImageCache = {};

function injectQuranAndCleanStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      body.zs-logged-out #notifBellBtn,
      body.zs-logged-out #supremeAdminHeaderBadge,
      body.zs-logged-out #hijriDateBadge,
      body.zs-logged-out #zikr-nav-trigger-fallback,
      body.zs-logged-out .zs-auth-only,
      #navZikrQuranBtn,
      .serial-pill {
        display: none !important;
      }

      /* Floating Gold Pill Button at Bottom-Right (Exactly like Image 1) */
      #zikr-nav-trigger-fallback {
        position: fixed;
        bottom: 18px;
        right: 18px;
        background: linear-gradient(135deg, #d4af37, #b48a1e);
        color: #041610;
        font-weight: 800;
        border: 2px solid #ffffff;
        padding: 10px 18px;
        border-radius: 30px;
        cursor: pointer;
        z-index: 9998;
        box-shadow: 0 4px 15px rgba(0,0,0,0.55);
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      /* Clean Fullscreen Quran Modal */
      #zikr-quran-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: #061510;
        z-index: 999999;
        overflow-y: auto;
        padding: 8px 6px 24px 6px;
      }

      /* Compact Mobile Header Right Above Quran Page */
      .zq-compact-bar {
        max-width: 620px;
        margin: 0 auto 8px auto;
        background: #042218;
        border: 1.5px solid #d4af37;
        border-radius: 14px;
        padding: 6px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        flex-wrap: nowrap;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      }

      /* Prominent Red Circular Cut (✕) Button */
      .zq-cut-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #ef4444;
        color: #ffffff;
        border: 2px solid #fca5a5;
        font-size: 18px;
        font-weight: 900;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(239,68,68,0.5);
      }

      /* Quran Page Container with Left & Right Click Zones */
      .zq-page-frame {
        max-width: 620px;
        margin: 0 auto;
        background: #ffffff;
        padding: 4px;
        position: relative;
        border-radius: 6px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.85);
        user-select: none;
      }

      .zq-tap-left, .zq-tap-right {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 50%;
        z-index: 25;
        cursor: pointer;
      }
      /* Left side click = Next Page (Agla Safha) */
      .zq-tap-left { left: 0; }
      /* Right side click = Previous Page (Pichla Safha) */
      .zq-tap-right { right: 0; }

      #quran-red-ribbon {
        display: none;
        position: absolute;
        top: 0;
        left: 20px;
        width: 22px;
        height: 58px;
        background: linear-gradient(180deg, #991b1b, #ef4444);
        z-index: 30;
        pointer-events: none;
        clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
      }
    `;
    document.head.appendChild(style);

    // 1. Create Floating "📖 Quran Pak" Pill Button like Image 1
    if (!document.getElementById('zikr-nav-trigger-fallback')) {
        const floatBtn = document.createElement('button');
        floatBtn.id = 'zikr-nav-trigger-fallback';
        floatBtn.type = 'button';
        floatBtn.innerHTML = '📖 Quran Pak';
        floatBtn.onclick = openZikrQuranSection;
        document.body.appendChild(floatBtn);
    }

    // 2. Create Clean Mobile-Friendly Quran Modal with Cut (✕) Button & Left/Right Tap Zones
    const modal = document.createElement('div');
    modal.id = 'zikr-quran-modal';
    modal.innerHTML = `
      <div class="zq-compact-bar">
        <select id="zqJuzSelect" onchange="if(this.value) loadInstantQuranPage(this.value)" style="padding:5px 6px; border-radius:8px; background:#031710; color:#fff; border:1px solid #10b981; font-size:12px; font-weight:700; max-width:105px;">
          <option value="">Para (1-30)</option>
        </select>

        <div style="color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px;">
          <input type="number" id="zqPageNumberInput" min="1" max="604" value="1" onchange="loadInstantQuranPage(this.value)" style="width:48px; text-align:center; padding:4px; border-radius:6px; font-weight:800; background:#031710; color:#fde047; border:1px solid #d4af37; font-size:12px;">
          <span style="color:#a7f3d0;">/604</span>
        </div>

        <button type="button" onclick="saveCurrentQuranBookmark()" title="Nishani Lagayein" style="background:#10b981; color:#041610; border:none; padding:5px 8px; border-radius:8px; font-weight:800; cursor:pointer; font-size:11.5px; white-space:nowrap;">
          🔖 Nishani
        </button>

        <button type="button" onclick="openSavedQuranBookmark()" title="Meri Nishani Par Jayein" style="background:#f59e0b; color:#041610; border:none; padding:5px 8px; border-radius:8px; font-weight:800; cursor:pointer; font-size:11.5px; white-space:nowrap;">
          👉 Saved
        </button>

        <button type="button" class="zq-cut-btn" onclick="closeZikrQuranSection()" title="Band Karein">✕</button>
      </div>

      <div class="zq-page-frame">
        <div id="quran-red-ribbon"></div>
        <!-- Left Half Click = Forward (Agla Safha) -->
        <div class="zq-tap-left" onclick="stepQuranPage(1)" title="Agla Safha"></div>
        <!-- Right Half Click = Backward (Pichla Safha) -->
        <div class="zq-tap-right" onclick="stepQuranPage(-1)" title="Pichla Safha"></div>
        <img id="instantQuranPageImg" src="" alt="Quran Safha" style="width:100%; height:auto; display:block;" />
      </div>
    `;
    document.body.appendChild(modal);

    const juzSel = document.getElementById('zqJuzSelect');
    quranJuzStartPages.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.text = `Para ${idx + 1}`;
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

window.addEventListener('DOMContentLoaded', injectQuranAndCleanStyles);
