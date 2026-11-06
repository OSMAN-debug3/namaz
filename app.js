const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJurfZRD8AyzWWXtY3VsThAcVZxi4QXYMakINqX_h55HrrnYog03eawNiSloQ6SJQHBA/exec';
const ADMIN_NAMES = ['abbu shahma', 'osman', 'admin', 'osman sardar', 'osman bey', 'muhammad sibgathullah'];

let currentMode = 'login';
let currentLang = localStorage.getItem('zikr_lang') || 'ro';
let globalReports = [];
let globalUsers = [];
let globalMessages = [];
let tempBase64Photo = 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png';

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`;

function getCurrent12HourTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function handleSibgathullahImgError(imgEl) {
    const fallbacks = [
        'https://osman-debug3.github.io/namaz/IMG_20250608_110400_431.jpg',
        'https://osman-debug3.github.io/namaz/muhammad-sibgathullah.jpeg',
        'https://osman-debug3.github.io/namaz/sibgathullah.jpg'
    ];
    let step = parseInt(imgEl.getAttribute('data-fallback-step') || '0', 10);
    if (step < fallbacks.length) {
        imgEl.setAttribute('data-fallback-step', (step + 1).toString());
        imgEl.src = fallbacks[step];
    }
}

function isUserAdmin() {
    const u = (localStorage.getItem('namaz_user') || '').trim().toLowerCase();
    return ADMIN_NAMES.includes(u);
}

function getMemberSerialAndInfo(userName) {
    if (!userName) return { serial: null, createdAt: '' };
    const idx = globalUsers.findIndex(u => u.name.toLowerCase() === userName.toLowerCase());
    if (idx === -1) return { serial: null, createdAt: '' };
    const u = globalUsers[idx];
    return { serial: u.serial || (idx + 1), createdAt: u.createdAt || '-' };
}

function toggleDrawerPanel(panelId, btnId) {
    const panels = ['panelSettings', 'panelChat', 'panelAbout'];
    const btns = ['btnMenuSettings', 'btnMenuChat', 'btnMenuAbout'];
    panels.forEach((p, idx) => {
        const el = document.getElementById(p);
        const b = document.getElementById(btns[idx]);
        if (p === panelId) {
            const isOpen = el.classList.toggle('open');
            b.classList.toggle('active', isOpen);
            if (p === 'panelChat' && isOpen && typeof markConversationSeen === 'function') {
                markConversationSeen();
                renderChatConversation();
            }
        } else {
            el.classList.remove('open');
            b.classList.remove('active');
        }
    });
}

function toggleSideMenu() {
    const overlay = document.getElementById('sideDrawerOverlay');
    overlay.classList.toggle('open');
    const savedName = localStorage.getItem('namaz_user') || 'ZikrSphere Guest';
    const savedPhoto = localStorage.getItem('namaz_photo') || 'https://osman-debug3.github.io/namaz/logo.jpg';
    document.getElementById('drawerUserName').innerText = savedName;
    document.getElementById('drawerUserAvatar').src = savedPhoto;
    if (typeof refreshChatAndNotificationsUI === 'function') refreshChatAndNotificationsUI();
}

function closeSideMenu(e) {
    if (e.target.id === 'sideDrawerOverlay') {
        document.getElementById('sideDrawerOverlay').classList.remove('open');
    }
}

function openFullScreenPhoto(src) {
    document.getElementById('lightboxImg').src = src;
    document.getElementById('photoLightbox').classList.remove('hidden');
}

function closeFullScreenPhoto() {
    document.getElementById('photoLightbox').classList.add('hidden');
}

function cleanDateString(rawDate) {
    if (!rawDate) return '';
    const str = rawDate.toString();
    if (str.includes('T')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return str.split('T')[0];
    }
    return str;
}

function getDayNameFromDate(dateStr) {
    const parts = dateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dateObj.getDay()];
}

async function loadHijriCalendar(dateObj) {
    const badge = document.getElementById('hijriDateBadge');
    if (!badge) return;
    try {
        const enFmt = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
        const arMonth = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { month: 'long' }).format(dateObj);
        badge.innerHTML = `🌙 ${enFmt.replace('AH', '')} <span class="ar-month">(${arMonth})</span> هـ`;
    } catch (err) {
        badge.innerText = '🌙 1448 Hijri';
    }
}

function populateAllDropdowns(lang) {
    const t = translations[lang];
    ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        const sel = document.getElementById(p);
        const currentVal = sel.value || 'Nahi';
        sel.innerHTML = `<option value="Nahi">${t.optNahi}</option><option value="Ada">${t.optAda}</option><option value="Qaza">${t.optQaza}</option>`;
        sel.value = currentVal;
    });
    ['tahajjud', 'duha'].forEach(nf => {
        const sel = document.getElementById(nf);
        const currentVal = sel.value || 'Nahi';
        sel.innerHTML = `<option value="Nahi">${t.optNawafilNahi}</option><option value="Ada">${t.optNawafilAda}</option>`;
        sel.value = currentVal;
    });
    const rozaSel = document.getElementById('roza');
    const rozaVal = rozaSel.value || 'Nahi';
    rozaSel.innerHTML = `<option value="Nahi">${t.optRozaNahi}</option><option value="Rakha">${t.optRozaRakha}</option>`;
    rozaSel.value = rozaVal;

    const tarawihSel = document.getElementById('tarawih');
    const tarawihVal = tarawihSel.value || 'Nahi';
    tarawihSel.innerHTML = `<option value="Nahi">${t.optTarawihNahi}</option><option value="Ada">${t.optTarawihAda}</option>`;
    tarawihSel.value = tarawihVal;

    const quranSel = document.getElementById('quran');
    const quranVal = quranSel.value || 'Nahi';
    let pagesOptions = '';
    for (let i = 1; i <= 20; i++) {
        const val = i === 1 ? '1 Page' : `${i} Pages`;
        pagesOptions += `<option value="${val}">📖 ${i} ${t.pageUnit}</option>`;
    }
    let parasOptions = '';
    for (let i = 1; i <= 5; i++) {
        const val = i === 1 ? '1 Para' : `${i} Paras`;
        parasOptions += `<option value="${val}">🌟 ${i} ${t.paraUnit}</option>`;
    }
    quranSel.innerHTML = `<option value="Nahi">${t.optQuranNahi}</option><optgroup label="${t.optPagesGroup}">${pagesOptions}</optgroup><optgroup label="${t.optParasGroup}">${parasOptions}</optgroup>`;
    quranSel.value = quranVal;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('zikr_lang', lang);
    document.body.classList.toggle('lang-ur', lang === 'ur');
    ['en', 'ro', 'hi', 'ur'].forEach(l => {
        const btn = document.getElementById('langBtn-' + l);
        if (btn) btn.classList.toggle('active', l === lang);
    });
    const t = translations[lang];
    document.getElementById('t_ayah').innerText = t.ayah;
    document.getElementById('t_memberSub').innerText = t.memberSub;
    document.getElementById('t_menuSettingsBtn').innerText = t.menuSettingsBtn;
    document.getElementById('t_menuChatBtn').innerText = t.menuChatBtn;
    document.getElementById('t_menuAboutBtn').innerText = t.menuAboutBtn;
    document.getElementById('t_settingsSub').innerText = t.settingsSub;
    document.getElementById('t_changeAccTitle').innerText = t.changeAccTitle;
    document.getElementById('t_updateAccBtn').innerText = t.updateAccBtn;
    document.getElementById('t_chatHeaderTitle').innerText = t.chatHeaderTitle;
    document.getElementById('t_replyToLabel').innerText = t.replyToLabel;
    document.getElementById('chatMsgInput').placeholder = '';
    document.getElementById('t_notifPopupTitle').innerText = t.notifPopupTitle;
    document.getElementById('t_clearNotifBtn').innerText = t.clearNotifBtn;
    document.getElementById('t_drawerPhotoBtn').innerText = t.drawerPhotoBtn;
    document.getElementById('t_drawerReportBtn').innerHTML = `<span>${t.drawerReportBtn}</span><span>➔</span>`;
    document.getElementById('t_drawerLogoutBtn').innerText = t.drawerLogoutBtn;
    document.getElementById('t_aboutHeading').innerText = t.aboutHeading;
    document.getElementById('t_aboutRole').innerText = t.aboutRole;
    document.getElementById('t_aboutBio').innerHTML = t.aboutBio;

    document.getElementById('loginTab').innerText = t.loginTab;
    document.getElementById('registerTab').innerText = t.registerTab;
    document.getElementById('t_labelName').innerText = t.labelName;
    document.getElementById('authName').placeholder = '';
    document.getElementById('t_labelPass').innerText = t.labelPass;
    document.getElementById('authPass').placeholder = '';
    document.getElementById('t_labelPhoto').innerText = t.labelPhoto;
    document.getElementById('regPhotoBtnText').innerText = t.regPhotoBtnText;
    switchTab(currentMode);

    document.getElementById('t_homeTitle').innerText = t.homeTitle;
    document.getElementById('t_goToReportBtn').innerText = t.goToReportBtn;
    document.getElementById('progressText').innerText = t.progressText;
    document.getElementById('t_dateLabel').innerText = t.dateLabel;
    document.getElementById('t_markAllBtn').innerText = t.markAllBtn;
    document.getElementById('t_namazHeading').innerText = t.namazHeading;
    document.getElementById('t_fajr').innerText = t.fajr;
    document.getElementById('t_asr').innerText = t.asr;
    document.getElementById('t_maghrib').innerText = t.maghrib;
    document.getElementById('t_isha').innerText = t.isha;
    document.getElementById('t_nawafilHeading').innerText = t.nawafilHeading;
    document.getElementById('t_tahajjud').innerText = t.tahajjud;
    document.getElementById('t_duha').innerText = t.duha;
    document.getElementById('t_extraHeading').innerText = t.extraHeading;
    document.getElementById('t_roza').innerText = t.roza;
    document.getElementById('t_tarawih').innerText = t.tarawih;
    document.getElementById('t_quran').innerText = t.quran;
    document.getElementById('submitBtn').innerText = t.submitBtn;
    document.getElementById('t_dashHeading').innerText = t.dashHeading;
    document.getElementById('t_recordsHeading').innerText = t.recordsHeading;
    document.getElementById('t_downloadBtn').innerText = t.downloadBtn;
    document.getElementById('t_modalHistoryTitle').innerText = t.modalHistoryTitle;
    document.getElementById('t_closeZoomBtn').innerText = t.closeZoomBtn;
    document.getElementById('t_navHome').innerText = t.navHome;
    document.getElementById('t_navReport').innerText = t.navReport;
    document.getElementById('t_navDash').innerText = t.navDash;
    document.getElementById('t_navRecords').innerText = t.navRecords;
    document.getElementById('t_navAdmin').innerText = t.navAdmin;

    document.getElementById('homeBoxMaqsad').innerHTML = t.maqsadHTML;
    document.getElementById('homeBoxNamaz').innerHTML = t.namazHTML;
    document.getElementById('homeBoxRoza').innerHTML = t.rozaHTML;
    document.getElementById('homeBoxTarawih').innerHTML = t.tarawihHTML;

    populateAllDropdowns(lang);
    if (typeof renderCommunityLeaderboard === 'function') renderCommunityLeaderboard();
    if (typeof renderUserHistory === 'function') renderUserHistory();
    if (typeof refreshChatAndNotificationsUI === 'function') refreshChatAndNotificationsUI();
    if (typeof renderSupremeAdminPanel === 'function') renderSupremeAdminPanel();
}

function checkDayAndLoadData() {
    const dateInputEl = document.getElementById('reportDate');
    const dateVal = dateInputEl.value;
    if (!dateVal) return;

    const savedName = localStorage.getItem('namaz_user');
    if (savedName && globalUsers.length > 0) {
        const me = globalUsers.find(u => u.name.toLowerCase() === savedName.toLowerCase());
        if (me && me.createdAt && /^\d{4}-\d{2}-\d{2}/.test(cleanDateString(me.createdAt))) {
            const joinDate = cleanDateString(me.createdAt);
            dateInputEl.min = joinDate;
            if (dateInputEl.value < joinDate) {
                alert(`⚠️ Aapne ${joinDate} ko join kiya hai, isliye usse pehle ki tarik ki report nahi bhar sakte.`);
                dateInputEl.value = todayStr;
            }
        }
    }

    const t = translations[currentLang];
    const parts = dateInputEl.value.split('-');
    loadHijriCalendar(new Date(parts[0], parts[1] - 1, parts[2]));

    const dayName = getDayNameFromDate(dateInputEl.value);
    document.getElementById('zuhrLabel').innerText = dayName === 'Friday' ? t.jumma : t.zuhr;
    document.getElementById('zuhrArabic').innerText = dayName === 'Friday' ? 'الجمعة' : 'الظهر';
    fetchAllDataAndRefresh();
}

async function fetchAllDataAndRefresh() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getData`);
        const data = await res.json();
        if (data.result === 'success') {
            globalReports = data.reports || [];
            globalUsers = (data.users || []).map((u, idx) => ({ ...u, serial: u.serial || (idx + 1) }));
            if (data.messages) globalMessages = data.messages;
            const savedName = localStorage.getItem('namaz_user');
            if (savedName) {
                const me = globalUsers.find(u => u.name.toLowerCase() === savedName.toLowerCase());
                if (me && me.photo) {
                    localStorage.setItem('namaz_photo', me.photo);
                    document.getElementById('drawerUserAvatar').src = me.photo;
                }
                if (typeof sendOnlineHeartbeat === 'function') sendOnlineHeartbeat();
            }
            updateUI();
            if (typeof renderCommunityLeaderboard === 'function') renderCommunityLeaderboard();
            if (typeof renderUserHistory === 'function') renderUserHistory();
            if (typeof refreshChatAndNotificationsUI === 'function') refreshChatAndNotificationsUI();
            if (typeof renderSupremeAdminPanel === 'function') renderSupremeAdminPanel();
        }
    } catch (e) {
        console.error(e);
    }
}

function updateUI() {
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    let score = 0;
    let totalPossible = 10;

    prayers.forEach(p => {
        const val = document.getElementById(p).value;
        const card = document.getElementById('card-' + p);
        card.classList.remove('status-ada', 'status-qaza');
        if (val === 'Ada') { card.classList.add('status-ada'); score += 1; }
        else if (val === 'Qaza') { card.classList.add('status-qaza'); score += 0.5; }
    });

    const isTahajjud = document.getElementById('tahajjud').value === 'Ada';
    const isDuha = document.getElementById('duha').value === 'Ada';
    const isRoza = document.getElementById('roza').value === 'Rakha';
    const isTarawih = document.getElementById('tarawih').value === 'Ada';
    const isQuran = document.getElementById('quran').value !== 'Nahi';

    document.getElementById('card-tahajjud').classList.toggle('status-ada', isTahajjud);
    document.getElementById('card-duha').classList.toggle('status-ada', isDuha);
    document.getElementById('card-roza').classList.toggle('status-ada', isRoza);
    document.getElementById('card-tarawih').classList.toggle('status-ada', isTarawih);
    document.getElementById('card-quran').classList.toggle('status-ada', isQuran);

    if (isTahajjud) score += 1;
    if (isDuha) score += 1;
    if (isRoza) score += 1;
    if (isTarawih) score += 1;
    if (isQuran) score += 1;

    const percent = Math.round((score / totalPossible) * 100);
    document.getElementById('progressBar').style.width = percent + '%';
    document.getElementById('progressPercent').innerText = percent + '%';
}

function switchSection(section) {
    const trackerCard = document.getElementById('trackerCard');
    ['sectionHome', 'sectionTracker', 'sectionDashboard', 'sectionRecords', 'sectionAdmin'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    ['navHomeBtn', 'navTrackerBtn', 'navDashBtn', 'navRecordsBtn', 'navAdminBtn'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });

    trackerCard.classList.remove('hidden');
    if (section === 'home') {
        document.getElementById('sectionHome').classList.remove('hidden');
        document.getElementById('navHomeBtn').classList.add('active');
    } else if (section === 'tracker') {
        document.getElementById('sectionTracker').classList.remove('hidden');
        document.getElementById('navTrackerBtn').classList.add('active');
    } else if (section === 'dashboard') {
        document.getElementById('sectionDashboard').classList.remove('hidden');
        document.getElementById('navDashBtn').classList.add('active');
        fetchAllDataAndRefresh();
    } else if (section === 'records') {
        document.getElementById('sectionRecords').classList.remove('hidden');
        document.getElementById('navRecordsBtn').classList.add('active');
        fetchAllDataAndRefresh();
    } else if (section === 'admin') {
        document.getElementById('sectionAdmin').classList.remove('hidden');
        document.getElementById('navAdminBtn').classList.add('active');
        fetchAllDataAndRefresh();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function compressImageHD(input, callback) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                canvas.width = 650;
                canvas.height = 650;
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, 650, 650);
                let quality = 0.90;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                while (dataUrl.length > 49000 && quality > 0.45) {
                    quality -= 0.06;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                callback(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function updateProfilePhoto(input) {
    compressImageHD(input, async function(newPhoto) {
        const name = localStorage.getItem('namaz_user');
        const password = localStorage.getItem('namaz_pass');
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'updatePhoto', name, password, photo: newPhoto })
            });
            const data = await res.json();
            if (data.result === 'success') {
                localStorage.setItem('namaz_photo', newPhoto);
                document.getElementById('drawerUserAvatar').src = newPhoto;
                alert('✅ MashaAllah! Profile Photo updated!');
                fetchAllDataAndRefresh();
            }
        } catch (err) {
            alert('Error updating photo.');
        }
    });
}

async function updateAccountDetails() {
    const oldName = localStorage.getItem('namaz_user');
    const newName = (document.getElementById('updateNewName').value || '').trim();
    const newPassword = (document.getElementById('updateNewPass').value || '').trim();
    if (!newName || !newPassword) return alert('Kripya Naya Naam aur Naya Password dono likhein!');

    const btn = document.getElementById('t_updateAccBtn');
    btn.disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateAccount', oldName, newName, newPassword })
        });
        const data = await res.json();
        if (data.result === 'success') {
            localStorage.setItem('namaz_user', data.newName);
            localStorage.setItem('namaz_pass', newPassword);
            document.getElementById('drawerUserName').innerText = data.newName;
            alert('✅ ' + data.message);
            fetchAllDataAndRefresh();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (err) {
        alert('Error updating account.');
    } finally {
        btn.disabled = false;
    }
}

function switchTab(mode) {
    currentMode = mode;
    const t = translations[currentLang];
    document.getElementById('loginTab').classList.toggle('active', mode === 'login');
    document.getElementById('registerTab').classList.toggle('active', mode === 'register');
    document.getElementById('authName').placeholder = '';
    document.getElementById('authPass').placeholder = '';
    document.getElementById('authTitle').innerText = mode === 'login' ? t.authTitleLogin : t.authTitleRegister;
    document.getElementById('authBtn').innerText = mode === 'login' ? t.authBtnLogin : t.authBtnRegister;
    document.getElementById('authHelp').innerText = mode === 'login' ? t.authHelpLogin : t.authHelpRegister;
    document.getElementById('photoGroup').style.display = mode === 'login' ? 'none' : 'block';
}

async function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const password = document.getElementById('authPass').value.trim();
    const t = translations[currentLang];
    if (!name || !password) return alert('Apna Naam aur Password dalein');

    const btn = document.getElementById('authBtn');
    btn.innerText = t.waitText;
    btn.disabled = true;
    try {
        let response;
        if (currentMode === 'register') {
            response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'register', name, password, photo: tempBase64Photo, joinTime: getCurrent12HourTime() })
            });
        } else {
            response = await fetch(`${SCRIPT_URL}?action=login&name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`);
        }
        const data = await response.json();
        if (data.result === 'success') {
            const finalName = data.name || name;
            const finalPhoto = data.photo || tempBase64Photo;
            localStorage.setItem('namaz_user', finalName);
            localStorage.setItem('namaz_pass', password);
            localStorage.setItem('namaz_photo', finalPhoto);
            alert(data.message);
            showTracker(finalName, finalPhoto);
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        alert('Connection error.');
    } finally {
        btn.innerText = currentMode === 'login' ? t.authBtnLogin : t.authBtnRegister;
        btn.disabled = false;
    }
}

function showTracker(name, photo) {
    document.body.classList.remove('zs-logged-out');
    document.getElementById('authCard').classList.add('hidden');
    document.getElementById('trackerCard').classList.remove('hidden');
    document.getElementById('bottomNavBar').classList.remove('hidden');
    document.getElementById('drawerUserActions').classList.remove('hidden');
    document.getElementById('settingsPhotoWrap').classList.remove('hidden');
    document.getElementById('accountUpdateWrap').classList.remove('hidden');
    document.getElementById('drawerUserName').innerText = name;
    if (photo) document.getElementById('drawerUserAvatar').src = photo;
    const adminMode = isUserAdmin();
    document.getElementById('supremeAdminHeaderBadge').classList.toggle('hidden', !adminMode);
    document.getElementById('navAdminBtn').classList.toggle('hidden', !adminMode);
    switchSection('home');
    fetchAllDataAndRefresh();
}

function logout() {
    localStorage.removeItem('namaz_user');
    localStorage.removeItem('namaz_pass');
    localStorage.removeItem('namaz_photo');
    document.body.classList.add('zs-logged-out');
    document.getElementById('trackerCard').classList.add('hidden');
    document.getElementById('bottomNavBar').classList.add('hidden');
    document.getElementById('drawerUserActions').classList.add('hidden');
    document.getElementById('settingsPhotoWrap').classList.add('hidden');
    document.getElementById('accountUpdateWrap').classList.add('hidden');
    document.getElementById('supremeAdminHeaderBadge').classList.add('hidden');
    document.getElementById('navAdminBtn').classList.add('hidden');
    document.getElementById('authName').value = '';
    document.getElementById('authPass').value = '';
    document.getElementById('authCard').classList.remove('hidden');
}

function markAll() {
    ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].forEach(p => document.getElementById(p).value = 'Ada');
    updateUI();
}

async function saveReport() {
    const name = localStorage.getItem('namaz_user');
    const password = localStorage.getItem('namaz_pass');
    const date = document.getElementById('reportDate').value;
    const t = translations[currentLang];
    if (!name || !password) return logout();

    const btn = document.getElementById('submitBtn');
    btn.innerText = t.savingText;
    btn.disabled = true;

    const params = new URLSearchParams({
        action: 'save', name, password, date,
        day: getDayNameFromDate(date),
        time: getCurrent12HourTime(),
        fajr: document.getElementById('fajr').value,
        zuhr: document.getElementById('zuhr').value,
        asr: document.getElementById('asr').value,
        maghrib: document.getElementById('maghrib').value,
        isha: document.getElementById('isha').value,
        tahajjud: document.getElementById('tahajjud').value,
        duha: document.getElementById('duha').value,
        roza: document.getElementById('roza').value,
        quran: document.getElementById('quran').value,
        tarawih: document.getElementById('tarawih').value
    });

    try {
        const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const data = await response.json();
        alert(data.result === 'success' ? '✅ MashaAllah! ' + data.message : '❌ ' + data.message);
        fetchAllDataAndRefresh();
    } catch (error) {
        alert('✅ MashaAllah!');
        fetchAllDataAndRefresh();
    } finally {
        btn.innerText = t.submitBtn;
        btn.disabled = false;
    }
}

/* ✅ WORKING PWA INSTALL FUNCTION FOR 3-LINE SIDE MENU BUTTON */
let deferredInstallPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
});

async function installZikrSphereApp() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
            deferredInstallPrompt = null;
        }
    } else {
        alert('📲 ZikrSphere App Install Karne Ke Liye:\n\n1. Mobile Chrome mein upar 3-dot menu (⋮) par tap karein.\n2. "Add to Home screen" ya "Install app" par click karein.');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('reportDate');
    if (dateInput) {
        dateInput.value = todayStr;
        dateInput.max = todayStr;
    }
    if (document.getElementById('admQuickDateInput')) {
        document.getElementById('admQuickDateInput').value = todayStr;
    }
    setLanguage(currentLang);
    loadHijriCalendar(today);
    checkDayAndLoadData();

    const savedName = localStorage.getItem('namaz_user');
    const savedPass = localStorage.getItem('namaz_pass');
    const savedPhoto = localStorage.getItem('namaz_photo');
    if (savedName && savedPass) {
        showTracker(savedName, savedPhoto);
    } else {
        document.body.classList.add('zs-logged-out');
    }
});
