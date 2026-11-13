/* ================= SUPREME ADMIN, INSTANT FULL REPORT LOOKUP & QURAN MODULE ================= */

async function toggleSubAdminStatus(targetName, makeAdmin) {
    if (!isSupremeAdmin()) {
        alert('⚠️ Sirf Main Supreme Admin (ABBU SHAHMA) hi kisi member ko Admin bana ya hata sakte hain!');
        return;
    }
    const cleanTarget = (targetName || '').trim();
    if (!cleanTarget) return;

    const actionText = makeAdmin
        ? `👑 Kya aap "${cleanTarget}" ko Sub-Admin banana chahte hain?`
        : `⚠️ Kya aap "${cleanTarget}" se Admin power wapas lena chahte hain?`;
    if (!confirm(actionText)) return;

    const cmd = makeAdmin ? `SUBADMIN_ADD|${cleanTarget.toLowerCase()}` : `SUBADMIN_REMOVE|${cleanTarget.toLowerCase()}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: cmd });
    buildMessageSystemState();
    renderSupremeAdminPanel();

    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(cmd)}`);
    } catch (e) {}
}

function renderSupremeAdminPanel() {
    if (!isUserAdmin()) return;
    const isMainBoss = isSupremeAdmin();
    const currentDate = document.getElementById('reportDate').value || todayStr;
    document.getElementById('admPendingDateBadge').innerText = `📅 ${currentDate}`;

    const roleChip = document.getElementById('admRoleChip');
    if (roleChip) {
        roleChip.innerText = isMainBoss ? '👑 MAIN SUPREME ADMIN (ABBU SHAHMA)' : '🌟 COMMUNITY SUB-ADMIN';
    }

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
        ? `<div style="text-align:center; color:#00f5d4; font-size:12px; padding:10px;">🌟 Aaj sabhi members ne report bhej di hai!</div>`
        : pendingMembers.map(u => {
            const safeName = u.name.replace(/'/g, "\\'");
            return `
                <div class="admin-user-row">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1px solid #00f5d4;">
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
    dirBox.innerHTML = globalUsers.map((u, idx) => {
        const uReports = getValidUniqueUserReports(u.name);
        const safeName = u.name.replace(/'/g, "\\'");
        const safePass = (u.password || '').replace(/'/g, "\\'");
        const uLower = u.name.toLowerCase();
        const isTargetSupreme = SUPREME_ADMINS.includes(uLower);
        const isTargetSubAdmin = DEFAULT_ADMINS.includes(uLower) || dynamicSubAdmins.has(uLower);
        const serialNum = u.serial || (idx + 1);

        const pinText = isMainBoss ? `🔑 PIN: <strong>${u.password || '****'}</strong> | ` : '';
        const roleBadge = isTargetSupreme
            ? `<span class="badge-chip" style="background:#00f5d4; color:#021210;">👑 Main Admin</span>`
            : (isTargetSubAdmin ? `<span class="badge-chip" style="background:#14b8a6; color:#021210;">🌟 Sub-Admin</span>` : '');

        let adminControls = `<button type="button" class="admin-mini-btn" onclick="openMemberProfile('${safeName}')">📜 Report</button>`;
        if (isMainBoss && !isTargetSupreme) {
            if (dynamicSubAdmins.has(uLower)) {
                adminControls += `<button type="button" class="admin-mini-btn danger" onclick="toggleSubAdminStatus('${safeName}', false)">❌ Remove Admin</button>`;
            } else {
                adminControls += `<button type="button" class="admin-mini-btn" style="border-color:#00f5d4; color:#00f5d4;" onclick="toggleSubAdminStatus('${safeName}', true)">👑 Make Admin</button>`;
            }
            adminControls += `<button type="button" class="admin-mini-btn" onclick="adminEditMemberCredentials('${safeName}', '${safePass}')">✏️</button>`;
            adminControls += `<button type="button" class="admin-mini-btn danger" onclick="adminRemoveMember('${safeName}')">🗑️</button>`;
        }

        return `
            <div class="admin-user-row">
                <div style="display:flex; align-items:center; gap:9px;">
                    <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1.5px solid #00f5d4;">
                    <div>
                        <div style="font-weight:800; color:#00f5d4; font-size:13px;">#${serialNum} — ${u.name} ${roleBadge}</div>
                        <div style="font-size:10.5px; color:#99f6e4;">${pinText}📅 Joined: <strong>${u.createdAt || '-'}</strong> | 📊 Days: ${uReports.length}</div>
                    </div>
                </div>
                <div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">
                    ${adminControls}
                </div>
            </div>
        `;
    }).join('');

    runAdminMemberLookup();
}

/* ✅ INSTANT FULL REPORT LOOKUP (BY SERIAL NO OR NAME) */
function runAdminMemberLookup() {
    const inputEl = document.getElementById('adminLookupInput');
    const resultBox = document.getElementById('adminLookupResultBox');
    if (!inputEl || !resultBox) return;
    const rawQuery = (inputEl.value || '').trim();
    const query = rawQuery.toLowerCase().replace(/^#/, '');

    if (!query) {
        resultBox.innerHTML = `<div style="text-align:center; color:#99f6e4; font-size:11.5px; padding:10px;">🔎 Upar kisi bhi Member ka <strong>Naam</strong> (jaise: FIROZ) ya <strong>Serial No</strong> (jaise: 4) likhein—turant uski poori report yahan khul jayegi!</div>`;
        return;
    }

    const isNumberQuery = /^\d+$/.test(query);
    const matched = globalUsers.filter((u, idx) => {
        const sNo = String(u.serial || (idx + 1));
        if (isNumberQuery) return sNo === query;
        return u.name.toLowerCase().includes(query) || sNo === query;
    });

    if (matched.length === 0) {
        resultBox.innerHTML = `<div style="text-align:center; color:#fca5a5; font-size:12px; padding:12px;">❌ "${rawQuery}" naam ya serial number ka koi member nahi mila.</div>`;
        return;
    }

    resultBox.innerHTML = matched.map(u => {
        const idx = globalUsers.findIndex(x => x.name.toLowerCase() === u.name.toLowerCase());
        const serialNo = u.serial || (idx + 1);
        const uRecords = getValidUniqueUserReports(u.name).slice().reverse();
        let totalPts = 0, totalFarzAda = 0;

        uRecords.forEach(r => {
            totalPts += calculateSingleReportPoints(r);
            totalFarzAda += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
        });

        const pinCol = isSupremeAdmin() ? u.password || '****' : '🔒 Hidden';

        const rowsHTML = uRecords.length === 0
            ? `<tr><td colspan="12" style="text-align:center; padding:14px; color:#fca5a5;">Abhi tak koi report darj nahi ki hai.</td></tr>`
            : uRecords.map(r => `
                <tr style="border-bottom:1px solid rgba(0,245,212,0.15); font-size:11px;">
                    <td style="padding:7px 6px; white-space:nowrap; color:#ffffff; font-weight:700;">${cleanDateString(r.date)}</td>
                    <td style="padding:7px 6px;">${r.day || '-'}</td>
                    <td style="padding:7px 6px; white-space:nowrap; color:#99f6e4;">${r.time || '-'}</td>
                    <td style="padding:7px 6px; color:${r.fajr === 'Ada' ? '#5eead4' : (r.fajr === 'Qaza' ? '#fde047' : '#fca5a5')}; font-weight:800;">${r.fajr}</td>
                    <td style="padding:7px 6px; color:${r.zuhr === 'Ada' ? '#5eead4' : (r.zuhr === 'Qaza' ? '#fde047' : '#fca5a5')}; font-weight:800;">${r.zuhr}</td>
                    <td style="padding:7px 6px; color:${r.asr === 'Ada' ? '#5eead4' : (r.asr === 'Qaza' ? '#fde047' : '#fca5a5')}; font-weight:800;">${r.asr}</td>
                    <td style="padding:7px 6px; color:${r.maghrib === 'Ada' ? '#5eead4' : (r.maghrib === 'Qaza' ? '#fde047' : '#fca5a5')}; font-weight:800;">${r.maghrib}</td>
                    <td style="padding:7px 6px; color:${r.isha === 'Ada' ? '#5eead4' : (r.isha === 'Qaza' ? '#fde047' : '#fca5a5')}; font-weight:800;">${r.isha}</td>
                    <td style="padding:7px 6px;">${r.tahajjud || 'Nahi'}</td>
                    <td style="padding:7px 6px;">${r.duha || 'Nahi'}</td>
                    <td style="padding:7px 6px; color:${r.roza === 'Rakha' ? '#fde047' : '#94a3b8'}; font-weight:700;">${r.roza || 'Nahi'}</td>
                    <td style="padding:7px 6px; color:#00f5d4; font-weight:700;">${r.quran || 'Nahi'}</td>
                </tr>
            `).join('');

        return `
            <div style="border:1.5px solid #00f5d4; border-radius:14px; background:rgba(3,17,22,0.95); padding:12px; margin-bottom:14px; box-shadow:0 0 18px rgba(0,245,212,0.18);">
                <!-- MEMBER SUMMARY TABLE (LIKE ROW 13-14 OF LOOKUP SHEET) -->
                <div style="overflow-x:auto; margin-bottom:12px;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; font-size:11.5px;">
                        <thead>
                            <tr style="background:#042f2e; color:#00f5d4; font-weight:800; border-bottom:1.5px solid #00f5d4;">
                                <th style="padding:8px 6px;">SERIAL NO</th>
                                <th style="padding:8px 6px;">MEMBER NAME</th>
                                <th style="padding:8px 6px;">SECRET PIN</th>
                                <th style="padding:8px 6px;">JOINED DATE</th>
                                <th style="padding:8px 6px;">TOTAL REPORTS</th>
                                <th style="padding:8px 6px;">TOTAL FARZ ADA</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="background:rgba(0,245,212,0.1); color:#ffffff; font-weight:800;">
                                <td style="padding:9px 6px; color:#00f5d4;">#${serialNo}</td>
                                <td style="padding:9px 6px;">${u.name}</td>
                                <td style="padding:9px 6px; color:#fde047;">${pinCol}</td>
                                <td style="padding:9px 6px;">${cleanDateString(u.createdAt) || '-'}</td>
                                <td style="padding:9px 6px; color:#5eead4;">${uRecords.length} Days</td>
                                <td style="padding:9px 6px; color:#00f5d4;">${totalFarzAda} Namaz (⭐ ${totalPts} Pts)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- MEMBER FULL REPORTS TABLE (LIKE ROW 17+ OF LOOKUP SHEET) -->
                <div style="overflow-x:auto; max-height:320px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:center;">
                        <thead style="position:sticky; top:0; background:#021014; color:#00f5d4; font-size:10.5px; font-weight:800; border-bottom:1.5px solid #00f5d4;">
                            <tr>
                                <th style="padding:7px 6px;">DATE</th>
                                <th style="padding:7px 6px;">DAY</th>
                                <th style="padding:7px 6px;">TIME</th>
                                <th style="padding:7px 6px;">FAJR</th>
                                <th style="padding:7px 6px;">ZUHR</th>
                                <th style="padding:7px 6px;">ASR</th>
                                <th style="padding:7px 6px;">MAGHRIB</th>
                                <th style="padding:7px 6px;">ISHA</th>
                                <th style="padding:7px 6px;">TAHAJJUD</th>
                                <th style="padding:7px 6px;">DUHA</th>
                                <th style="padding:7px 6px;">ROZA</th>
                                <th style="padding:7px 6px;">QURAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
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
    const myName = (localStorage.getItem('namaz_user') || 'ABBU SHAHMA').trim();
    const msgId = 'm_' + Date.now();
    const text = `Assalamu Alaikum ${memberName}! 🌙 Aaj ki Namaz aur Roza report ZikrSphere par zaroor save kar lein.`;
    const encodedPayload = `CHAT2|${msgId}|${myName}|${memberName}|1|${text}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: encodedPayload });
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(encodedPayload)}`); alert(`✅ ${memberName} ko reminder bhej diya gaya!`); } catch (e) {}
}

async function RemindAllDefaultersBroadcast() {
    const myName = (localStorage.getItem('namaz_user') || 'ABBU SHAHMA').trim();
    const bId = 'b_' + Date.now();
    const encodedPayload = `BROADCAST2|${bId}|${myName}|ALL|🌙 Namaz Report Reminder::Assalamu Alaikum! Aaj ki Namaz report ZikrSphere par darj kar lein.`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: encodedPayload });
    refreshChatAndNotificationsUI();
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(encodedPayload)}`); alert('✅ Sabhi members ko Notification bhej diya gaya!'); } catch (e) {}
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
    if (!isSupremeAdmin()) return alert('Sirf Main Supreme Admin hi ID/PIN badal sakte hain.');
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
    if (!isSupremeAdmin()) return alert('Sirf Main Supreme Admin hi member delete kar sakte hain.');
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

/* ================= FLOATING QURAN BUTTON & LEFT/RIGHT TAP QURAN ================= */
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
      .serial-pill {
        display: none !important;
      }

      #zikr-nav-trigger-fallback {
        position: fixed;
        bottom: 78px;
        right: 14px;
        background: linear-gradient(135deg, #00f5d4, #0d9488);
        color: #021210;
        font-weight: 800;
        border: 2px solid #ffffff;
        padding: 9px 16px;
        border-radius: 30px;
        cursor: pointer;
        z-index: 9995;
        box-shadow: 0 6px 20px rgba(0,0,0,0.65), 0 0 16px rgba(0,245,212,0.55);
        font-size: 13.5px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      #bottomNavBar .bottom-nav-inner {
        display: flex !important;
        flex-wrap: nowrap !important;
        justify-content: space-between !important;
        gap: 4px !important;
        padding: 6px 6px !important;
      }
      #bottomNavBar .bottom-nav-btn {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        padding: 8px 4px !important;
        font-size: 11.5px !important;
        white-space: nowrap !important;
      }

      #zikr-quran-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: #020c10;
        z-index: 999999;
        overflow-y: auto;
        padding: 8px 6px 24px 6px;
      }

      .zq-compact-bar {
        max-width: 620px;
        margin: 0 auto 8px auto;
        background: #051e26;
        border: 1.5px solid #00f5d4;
        border-radius: 14px;
        padding: 6px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        flex-wrap: nowrap;
        box-shadow: 0 0 18px rgba(0,245,212,0.3);
      }

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
      }

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
      .zq-tap-left { left: 0; }
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

    if (!document.getElementById('zikr-nav-trigger-fallback')) {
        const floatBtn = document.createElement('button');
        floatBtn.id = 'zikr-nav-trigger-fallback';
        floatBtn.type = 'button';
        floatBtn.innerHTML = '📖 Quran Pak';
        floatBtn.onclick = openZikrQuranSection;
        document.body.appendChild(floatBtn);
    }

    const modal = document.createElement('div');
    modal.id = 'zikr-quran-modal';
    modal.innerHTML = `
      <div class="zq-compact-bar">
        <select id="zqJuzSelect" onchange="if(this.value) loadInstantQuranPage(this.value)" style="padding:5px 6px; border-radius:8px; background:#021014; color:#fff; border:1px solid #00f5d4; font-size:12px; font-weight:700; max-width:105px;">
          <option value="">Para (1-30)</option>
        </select>

        <div style="color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; gap:4px;">
          <input type="number" id="zqPageNumberInput" min="1" max="604" value="1" onchange="loadInstantQuranPage(this.value)" style="width:48px; text-align:center; padding:4px; border-radius:6px; font-weight:800; background:#021014; color:#00f5d4; border:1px solid #00f5d4; font-size:12px;">
          <span style="color:#99f6e4;">/604</span>
        </div>

        <button type="button" onclick="saveCurrentQuranBookmark()" style="background:#00f5d4; color:#021210; border:none; padding:5px 8px; border-radius:8px; font-weight:800; cursor:pointer; font-size:11.5px; white-space:nowrap;">
          🔖 Nishani
        </button>

        <button type="button" onclick="openSavedQuranBookmark()" style="background:#fde047; color:#021210; border:none; padding:5px 8px; border-radius:8px; font-weight:800; cursor:pointer; font-size:11.5px; white-space:nowrap;">
          👉 Saved
        </button>

        <button type="button" class="zq-cut-btn" onclick="closeZikrQuranSection()" title="Band Karein">✕</button>
      </div>

      <div class="zq-page-frame">
        <div id="quran-red-ribbon"></div>
        <div class="zq-tap-left" onclick="stepQuranPage(1)" title="Agla Safha"></div>
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
