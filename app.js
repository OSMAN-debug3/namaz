const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJurfZRD8AyzWWXtY3VsThAcVZxi4QXYMakINqX_h55HrrnYog03eawNiSloQ6SJQHBA/exec';
const ADMIN_NAMES = ['abbu shahma', 'osman', 'admin', 'osman sardar', 'osman bey', 'muhammad sibgathullah'];

let currentMode = 'login';
let currentLang = localStorage.getItem('zikr_lang') || 'ro';
let globalReports = [];
let globalUsers = [];
let globalMessages = [];
let tempBase64Photo = 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png';

/* 12-HOUR AM/PM TIME GENERATOR */
function getCurrent12HourTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/* SMART FALLBACK FOR MUHAMMAD SIBGATHULLAH IMAGE FILENAME */
function handleSibgathullahImgError(imgEl) {
    const fallbacks = [
        'https://osman-debug3.github.io/namaz/IMG_20250608_110400_431.jpg',
        'https://osman-debug3.github.io/namaz/muhammad-sibgathullah.jpeg',
        'https://osman-debug3.github.io/namaz/sibgathullah.jpg',
        'https://osman-debug3.github.io/namaz/sibgathullah.jpeg',
        'https://osman-debug3.github.io/namaz/IMG_20250608_110400_431.jpeg'
    ];
    let step = parseInt(imgEl.getAttribute('data-fallback-step') || '0', 10);
    if (step < fallbacks.length) {
        imgEl.setAttribute('data-fallback-step', (step + 1).toString());
        imgEl.src = fallbacks[step];
    } else {
        const found = globalUsers.find(u => u.name.toLowerCase().includes('sibgathullah'));
        if (found && found.photo) {
            imgEl.src = found.photo;
        }
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
    return {
        serial: u.serial || (idx + 1),
        createdAt: u.createdAt || '-'
    };
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
            if (p === 'panelChat' && isOpen) {
                markConversationSeen();
                renderChatConversation();
            }
        } else {
            el.classList.remove('open');
            b.classList.remove('active');
        }
    });
}

/* FLOATING BELL DROPDOWN FUNCTIONS */
function toggleNotifPopup(e) {
    if (e) e.stopPropagation();
    const popup = document.getElementById('notifDropdownPopup');
    const bellBtn = document.getElementById('notifBellBtn');
    const isHidden = popup.classList.toggle('hidden');
    bellBtn.classList.toggle('active', !isHidden);
    refreshChatAndNotificationsUI();
}

function closeNotifPopup() {
    document.getElementById('notifDropdownPopup').classList.add('hidden');
    document.getElementById('notifBellBtn').classList.remove('active');
}

function closeNotifDropdownOutside(e) {
    const popup = document.getElementById('notifDropdownPopup');
    const bellBtn = document.getElementById('notifBellBtn');
    if (!popup.classList.contains('hidden') && !popup.contains(e.target) && !bellBtn.contains(e.target)) {
        closeNotifPopup();
    }
}

function formatRelativeDays(dateStr) {
    if (!dateStr) return 'Today';
    const clean = cleanDateString(dateStr);
    const parts = clean.split('-');
    if (parts.length !== 3) return clean;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
}

/* CLEAR ALL OR SINGLE NOTIFICATION */
async function clearAllNotifications() {
    const state = buildMessageSystemState();
    const dismissed = JSON.parse(localStorage.getItem('zikr_dismissed_notifs') || '[]');
    state.broadcasts.forEach(b => {
        if (!dismissed.includes(b.id)) dismissed.push(b.id);
    });
    localStorage.setItem('zikr_dismissed_notifs', JSON.stringify(dismissed));

    if (isUserAdmin()) {
        const payload = `CLEAR_BROADCASTS|${Date.now()}`;
        globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });
        try {
            await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`);
        } catch (e) {}
    }
    refreshChatAndNotificationsUI();
}

async function deleteSingleNotification(notifId) {
    const dismissed = JSON.parse(localStorage.getItem('zikr_dismissed_notifs') || '[]');
    if (!dismissed.includes(notifId)) dismissed.push(notifId);
    localStorage.setItem('zikr_dismissed_notifs', JSON.stringify(dismissed));

    if (isUserAdmin()) {
        const payload = `DELETE|${notifId}`;
        globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });
        try {
            await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`);
        } catch (e) {}
    }
    refreshChatAndNotificationsUI();
}

/* BUILD STATE FOR MESSAGES, EDITS, DELETES, ONLINE & SEEN TICKS */
function buildMessageSystemState() {
    let chatsMap = new Map();
    let broadcastsMap = new Map();
    let onlineMap = {};
    let seenMap = {};

    globalMessages.forEach((item, index) => {
        const rawText = (item.message || '').toString();
        const sender = (item.name || 'Member').toString();
        const time = item.date ? cleanDateString(item.date) : '';
        const fallbackId = `legacy_${index}`;

        if (rawText.startsWith('ONLINE|')) {
            const parts = rawText.split('|');
            const u = (parts[1] || sender).toLowerCase();
            const ts = parseInt(parts[2] || '0', 10);
            onlineMap[u] = Math.max(onlineMap[u] || 0, ts);
            return;
        }

        if (rawText.startsWith('SEEN|')) {
            const parts = rawText.split('|');
            const viewer = (parts[1] || '').toLowerCase();
            const partner = (parts[2] || '').toLowerCase();
            seenMap[`${viewer}->${partner}`] = index;
            onlineMap[viewer] = Date.now();
            return;
        }

        if (rawText.startsWith('EDIT|')) {
            const parts = rawText.split('|');
            const targetId = parts[1];
            const newText = parts.slice(2).join('|');
            if (chatsMap.has(targetId)) {
                const obj = chatsMap.get(targetId);
                obj.text = newText;
                obj.edited = true;
            }
            return;
        }

        if (rawText.startsWith('DELETE|')) {
            const parts = rawText.split('|');
            const targetId = parts[1];
            chatsMap.delete(targetId);
            broadcastsMap.delete(targetId);
            return;
        }

        if (rawText.startsWith('CLEAR_BROADCASTS|')) {
            broadcastsMap.clear();
            return;
        }

        if (rawText.startsWith('BROADCAST2|')) {
            const parts = rawText.split('|');
            const id = parts[1] || fallbackId;
            const from = parts[2] || sender;
            const fullMsg = parts.slice(4).join('|');
            let title = 'Community Notice';
            let body = fullMsg;
            if (fullMsg.indexOf('::') !== -1) {
                const tb = fullMsg.split('::');
                title = tb[0].trim() || 'Community Notice';
                body = tb.slice(1).join('::').trim();
            }
            broadcastsMap.set(id, { id, type: 'BROADCAST', from, title, text: body, time, order: index });
            return;
        }

        if (rawText.startsWith('BROADCAST|')) {
            const parts = rawText.split('|');
            const fullMsg = parts.slice(3).join('|');
            let title = 'Community Notice';
            let body = fullMsg;
            if (fullMsg.indexOf('::') !== -1) {
                const tb = fullMsg.split('::');
                title = tb[0].trim() || 'Community Notice';
                body = tb.slice(1).join('::').trim();
            }
            broadcastsMap.set(fallbackId, { id: fallbackId, type: 'BROADCAST', from: parts[1] || sender, title, text: body, time, order: index });
            return;
        }

        if (rawText.startsWith('CHAT2|')) {
            const parts = rawText.split('|');
            const id = parts[1] || fallbackId;
            const from = parts[2] || sender;
            const to = parts[3] || 'ADMIN';
            const isAdminReply = parts[4] === '1';
            const text = parts.slice(5).join('|');
            onlineMap[from.toLowerCase()] = Date.now() - 60000;
            chatsMap.set(id, { id, type: 'CHAT', from, to, text, time, isAdminReply, edited: false, order: index });
            return;
        }

        if (rawText.startsWith('REPLY|')) {
            const parts = rawText.split('|');
            chatsMap.set(fallbackId, { id: fallbackId, type: 'CHAT', from: 'ABBU SHAHMA', to: parts[1] || '', text: parts.slice(2).join('|'), time, isAdminReply: true, edited: false, order: index });
            return;
        }

        if (rawText.startsWith('CHAT|')) {
            const parts = rawText.split('|');
            chatsMap.set(fallbackId, { id: fallbackId, type: 'CHAT', from: parts[1] || sender, to: parts[2] || 'ADMIN', text: parts.slice(3).join('|'), time, isAdminReply: false, edited: false, order: index });
            return;
        }

        chatsMap.set(fallbackId, { id: fallbackId, type: 'CHAT', from: sender, to: 'ADMIN', text: rawText, time, isAdminReply: false, edited: false, order: index });
    });

    return {
        chats: Array.from(chatsMap.values()),
        broadcasts: Array.from(broadcastsMap.values()),
        onlineMap,
        seenMap
    };
}

function isPartnerCurrentlyOnline(partnerName, state) {
    if (!partnerName) return false;
    const p = partnerName.toLowerCase();
    if (p === 'admin') {
        return ADMIN_NAMES.some(a => {
            const ts = state.onlineMap[a] || 0;
            return (Date.now() - ts) < 10 * 60 * 1000;
        });
    }
    const ts = state.onlineMap[p] || 0;
    return (Date.now() - ts) < 10 * 60 * 1000;
}

function getMessageTickStatus(chatObj, state) {
    if (chatObj.isAdminReply) {
        const memberLower = (chatObj.to || '').toLowerCase();
        const seenOrder = state.seenMap[`${memberLower}->admin`];
        if (seenOrder !== undefined && seenOrder > chatObj.order) return 3;
        if (isPartnerCurrentlyOnline(memberLower, state)) return 2;
        return 1;
    } else {
        const senderLower = (chatObj.from || '').toLowerCase();
        const seenOrder = state.seenMap[`admin->${senderLower}`];
        if (seenOrder !== undefined && seenOrder > chatObj.order) return 3;
        if (isPartnerCurrentlyOnline('admin', state)) return 2;
        return 1;
    }
}

async function markConversationSeen() {
    const myName = (localStorage.getItem('namaz_user') || '').trim();
    if (!myName) return;
    const state = buildMessageSystemState();
    const adminMode = isUserAdmin();

    if (adminMode) {
        const selectedMember = (document.getElementById('adminReplyTarget').value || '').trim().toLowerCase();
        if (!selectedMember) return;
        const unreadFromMember = state.chats.filter(c => !c.isAdminReply && c.from.toLowerCase() === selectedMember);
        if (unreadFromMember.length === 0) return;
        const lastOrder = unreadFromMember[unreadFromMember.length - 1].order;
        const currentSeen = state.seenMap[`admin->${selectedMember}`] || -1;
        if (currentSeen <= lastOrder) {
            const payload = `SEEN|admin|${selectedMember}`;
            globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
            try {
                await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
            } catch (e) {}
        }
    } else {
        const myLower = myName.toLowerCase();
        const unreadFromAdmin = state.chats.filter(c => c.isAdminReply && c.to.toLowerCase() === myLower);
        if (unreadFromAdmin.length === 0) return;
        const lastOrder = unreadFromAdmin[unreadFromAdmin.length - 1].order;
        const currentSeen = state.seenMap[`${myLower}->admin`] || -1;
        if (currentSeen <= lastOrder) {
            const payload = `SEEN|${myLower}|admin`;
            globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
            try {
                await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
            } catch (e) {}
        }
    }
}

async function sendOnlineHeartbeat() {
    const myName = (localStorage.getItem('namaz_user') || '').trim();
    if (!myName) return;
    const lastPing = parseInt(sessionStorage.getItem('zikr_last_online_ping') || '0', 10);
    if (Date.now() - lastPing < 4 * 60 * 1000) return;
    sessionStorage.setItem('zikr_last_online_ping', Date.now().toString());

    const roleName = isUserAdmin() ? 'abbu shahma' : myName.toLowerCase();
    const payload = `ONLINE|${roleName}|${Date.now()}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
    } catch (e) {}
}

async function editChatMessage(msgId, oldText) {
    const updated = prompt('✏️ Edit your message:', oldText);
    if (updated === null) return;
    const cleanText = updated.trim();
    if (!cleanText || cleanText === oldText) return;

    const myName = (localStorage.getItem('namaz_user') || 'Member').trim();
    const payload = `EDIT|${msgId}|${cleanText}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
    refreshChatAndNotificationsUI();

    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
        fetchAllDataAndRefresh();
    } catch (e) {}
}

async function deleteChatMessage(msgId) {
    if (!confirm('🗑️ Kya aap is message ko delete karna chahte hain?')) return;
    const myName = (localStorage.getItem('namaz_user') || 'Member').trim();
    const payload = `DELETE|${msgId}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
    refreshChatAndNotificationsUI();

    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
        fetchAllDataAndRefresh();
    } catch (e) {}
}

/* UPDATE USERNAME & PASSWORD FUNCTION */
async function updateAccountDetails() {
    const oldName = localStorage.getItem('namaz_user');
    const newName = (document.getElementById('updateNewName').value || '').trim();
    const newPassword = (document.getElementById('updateNewPass').value || '').trim();

    if (!newName || !newPassword) {
        alert('Kripya apna Naya Naam aur Naya Password dono likhein!');
        return;
    }

    const btn = document.getElementById('t_updateAccBtn');
    btn.disabled = true;
    btn.innerText = 'Updating...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateAccount',
                oldName: oldName,
                newName: newName,
                newPassword: newPassword
            })
        });
        const data = await res.json();
        if (data.result === 'success') {
            localStorage.setItem('namaz_user', data.newName);
            localStorage.setItem('namaz_pass', newPassword);
            document.getElementById('drawerUserName').innerText = data.newName;
            alert('✅ ' + data.message);
            document.getElementById('updateNewName').value = '';
            document.getElementById('updateNewPass').value = '';
            fetchAllDataAndRefresh();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (err) {
        alert('Account update karne mein error aayi.');
    } finally {
        btn.disabled = false;
        btn.innerText = translations[currentLang].updateAccBtn;
    }
}

function refreshChatAndNotificationsUI() {
    const t = translations[currentLang];
    const adminMode = isUserAdmin();

    document.getElementById('adminChatBadge').classList.toggle('hidden', !adminMode);
    document.getElementById('adminReplySelectorWrap').classList.toggle('hidden', !adminMode);
    document.getElementById('adminBroadcastComposer').classList.toggle('hidden', !adminMode);
    document.getElementById('supremeAdminHeaderBadge').classList.toggle('hidden', !adminMode);
    document.getElementById('navAdminBtn').classList.toggle('hidden', !adminMode);

    const state = buildMessageSystemState();
    const dismissed = JSON.parse(localStorage.getItem('zikr_dismissed_notifs') || '[]');
    const broadcasts = state.broadcasts.filter(b => !dismissed.includes(b.id));
    const chats = state.chats;

    const notifBox = document.getElementById('notifListBox');
    const badgeDot = document.getElementById('notifBadgeCount');
    const countPill = document.getElementById('notifPopupCountPill');

    countPill.innerText = broadcasts.length;

    if (broadcasts.length === 0) {
        notifBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:12px; padding:22px 14px;">${t.emptyNotif}</div>`;
        badgeDot.classList.add('hidden');
    } else {
        badgeDot.innerText = broadcasts.length;
        badgeDot.classList.remove('hidden');

        const iconStyles = [
            { cls: 'notif-icon-gold', icon: '🔔' },
            { cls: 'notif-icon-emerald', icon: '🕌' },
            { cls: 'notif-icon-gold', icon: '✨' }
        ];

        notifBox.innerHTML = broadcasts.slice().reverse().map((b, idx) => {
            const st = iconStyles[idx % iconStyles.length];
            return `
                <div class="notif-card-row">
                    <div class="notif-circle-icon ${st.cls}">${st.icon}</div>
                    <div class="notif-body-col">
                        <div class="notif-item-heading">
                            <span>${b.title || 'Community Notice'}</span>
                            <span class="notif-single-del" title="Remove" onclick="deleteSingleNotification('${b.id}')">&times;</span>
                        </div>
                        <div class="notif-item-desc">${b.text}</div>
                        <div class="notif-item-time">${formatRelativeDays(b.time)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (adminMode) {
        const targetSelect = document.getElementById('adminReplyTarget');
        const currentTarget = targetSelect.value;
        const memberNames = new Set();
        globalUsers.forEach(u => {
            if (!ADMIN_NAMES.includes(u.name.toLowerCase())) memberNames.add(u.name);
        });
        chats.forEach(c => {
            if (!c.isAdminReply && !ADMIN_NAMES.includes(c.from.toLowerCase())) memberNames.add(c.from);
        });
        const membersArr = Array.from(memberNames);
        targetSelect.innerHTML = membersArr.length === 0
            ? `<option value="ALL">All Members</option>`
            : membersArr.map(m => `<option value="${m}">👤 ${m}</option>`).join('');
        if (currentTarget && membersArr.includes(currentTarget)) {
            targetSelect.value = currentTarget;
        }
    }

    renderChatConversation();
}

function renderChatConversation() {
    const t = translations[currentLang];
    const myName = (localStorage.getItem('namaz_user') || 'Guest').trim();
    const adminMode = isUserAdmin();
    const chatBox = document.getElementById('chatMessagesBox');
    const state = buildMessageSystemState();
    const parsedChats = state.chats;

    const partnerBar = document.getElementById('chatPartnerOnlineStatus');
    if (adminMode) {
        const selectedMember = document.getElementById('adminReplyTarget').value || 'Member';
        const online = isPartnerCurrentlyOnline(selectedMember, state);
        partnerBar.innerHTML = `<span class="status-dot ${online ? 'online' : 'offline'}"></span><span>${selectedMember}: <strong>${online ? 'Online (2 Ticks)' : 'Offline (1 Tick)'}</strong></span>`;
    } else {
        const adminOnline = isPartnerCurrentlyOnline('admin', state);
        partnerBar.innerHTML = `<span class="status-dot ${adminOnline ? 'online' : 'offline'}"></span><span>Admin (ABBU SHAHMA): <strong>${adminOnline ? 'Online (2 Ticks)' : 'Offline (1 Tick)'}</strong></span>`;
    }

    let filtered = [];
    if (adminMode) {
        const selectedMember = document.getElementById('adminReplyTarget').value || '';
        filtered = parsedChats.filter(c =>
            c.from.toLowerCase() === selectedMember.toLowerCase() ||
            c.to.toLowerCase() === selectedMember.toLowerCase()
        );
    } else {
        filtered = parsedChats.filter(c =>
            c.from.toLowerCase() === myName.toLowerCase() ||
            c.to.toLowerCase() === myName.toLowerCase()
        );
    }

    if (filtered.length === 0) {
        chatBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11.5px; margin:auto; padding:12px;">${t.emptyChat}</div>`;
        return;
    }

    chatBox.innerHTML = filtered.map(c => {
        const isMine = adminMode ? c.isAdminReply : (!c.isAdminReply && c.from.toLowerCase() === myName.toLowerCase());
        const bubbleClass = isMine ? 'me' : 'other';
        const senderLabel = c.isAdminReply ? '👑 Admin (ABBU SHAHMA)' : `👤 ${c.from}`;
        const safeEscapedText = c.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');

        const tickLevel = getMessageTickStatus(c, state);
        let tickHTML = '';
        if (isMine) {
            if (tickLevel === 3) tickHTML = `<span class="tick-3" title="Seen (3 Signs)">✓✓✓</span>`;
            else if (tickLevel === 2) tickHTML = `<span class="tick-2" title="Online / Delivered (2 Signs)">✓✓</span>`;
            else tickHTML = `<span class="tick-1" title="Offline / Sent (1 Sign)">✓</span>`;
        }

        const actionsHTML = isMine ? `
            <span class="chat-actions">
                <span class="chat-action-btn" title="Edit Message" onclick="editChatMessage('${c.id}', '${safeEscapedText}')">✏️</span>
                <span class="chat-action-btn" title="Delete Message" onclick="deleteChatMessage('${c.id}')">🗑️</span>
            </span>
        ` : '';

        return `
            <div class="chat-bubble ${bubbleClass}">
                <div class="chat-sender">
                    <span>${senderLabel}</span>
                    ${actionsHTML}
                </div>
                <div>${c.text} ${c.edited ? '<span style="font-size:9px; opacity:0.75;">(edited)</span>' : ''}</div>
                <div class="chat-meta-row">
                    <span>${c.time}</span>
                    ${tickHTML}
                </div>
            </div>
        `;
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatMsgInput');
    const text = input.value.trim();
    if (!text) return;

    const myName = (localStorage.getItem('namaz_user') || 'Guest').trim();
    const adminMode = isUserAdmin();
    const msgId = 'm_' + Date.now();
    let encodedPayload = '';
    let senderField = myName;

    if (adminMode) {
        const targetMember = document.getElementById('adminReplyTarget').value || 'Member';
        encodedPayload = `CHAT2|${msgId}|ABBU SHAHMA|${targetMember}|1|${text}`;
        senderField = 'ABBU SHAHMA';
    } else {
        encodedPayload = `CHAT2|${msgId}|${myName}|ADMIN|0|${text}`;
    }

    globalMessages.push({
        date: new Date().toISOString(),
        name: senderField,
        message: encodedPayload
    });
    input.value = '';
    refreshChatAndNotificationsUI();

    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(senderField)}&message=${encodeURIComponent(encodedPayload)}`);
        fetchAllDataAndRefresh();
    } catch (e) {
        console.error(e);
    }
}

async function sendAdminBroadcast() {
    const titleInput = document.getElementById('broadcastTitleInput');
    const bodyInput = document.getElementById('broadcastInput');
    const title = (titleInput.value || '').trim() || 'Community Notice';
    const text = (bodyInput.value || '').trim();
    if (!text) return;

    const btn = document.getElementById('sendBroadcastBtn');
    btn.disabled = true;
    const bId = 'b_' + Date.now();
    const encodedPayload = `BROADCAST2|${bId}|ABBU SHAHMA|ALL|${title}::${text}`;

    globalMessages.push({
        date: new Date().toISOString(),
        name: 'ABBU SHAHMA',
        message: encodedPayload
    });
    titleInput.value = '';
    bodyInput.value = '';
    refreshChatAndNotificationsUI();

    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(encodedPayload)}`);
        fetchAllDataAndRefresh();
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
    }
}

function populateAllDropdowns(lang) {
    const t = translations[lang];
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    prayers.forEach(p => {
        const sel = document.getElementById(p);
        const currentVal = sel.value || 'Nahi';
        sel.innerHTML = `
            <option value="Nahi">${t.optNahi}</option>
            <option value="Ada">${t.optAda}</option>
            <option value="Qaza">${t.optQaza}</option>
        `;
        sel.value = currentVal;
    });

    ['tahajjud', 'duha'].forEach(nf => {
        const sel = document.getElementById(nf);
        const currentVal = sel.value || 'Nahi';
        sel.innerHTML = `
            <option value="Nahi">${t.optNawafilNahi}</option>
            <option value="Ada">${t.optNawafilAda}</option>
        `;
        sel.value = currentVal;
    });

    const rozaSel = document.getElementById('roza');
    const rozaVal = rozaSel.value || 'Nahi';
    rozaSel.innerHTML = `
        <option value="Nahi">${t.optRozaNahi}</option>
        <option value="Rakha">${t.optRozaRakha}</option>
    `;
    rozaSel.value = rozaVal;

    const tarawihSel = document.getElementById('tarawih');
    const tarawihVal = tarawihSel.value || 'Nahi';
    tarawihSel.innerHTML = `
        <option value="Nahi">${t.optTarawihNahi}</option>
        <option value="Ada">${t.optTarawihAda}</option>
    `;
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
        const icon = i === 5 ? '👑' : '🌟';
        parasOptions += `<option value="${val}">${icon} ${i} ${t.paraUnit}</option>`;
    }
    quranSel.innerHTML = `
        <option value="Nahi">${t.optQuranNahi}</option>
        <optgroup label="${t.optPagesGroup}">${pagesOptions}</optgroup>
        <optgroup label="${t.optParasGroup}">${parasOptions}</optgroup>
    `;
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
    if (document.getElementById('t_changeAccHint')) document.getElementById('t_changeAccHint').innerText = t.changeAccHint;
    if (document.getElementById('t_photoBoxTitle')) document.getElementById('t_photoBoxTitle').innerText = t.photoBoxTitle;
    document.getElementById('t_updateAccBtn').innerText = t.updateAccBtn;
    document.getElementById('t_chatHeaderTitle').innerText = t.chatHeaderTitle;
    document.getElementById('t_replyToLabel').innerText = t.replyToLabel;
    document.getElementById('chatMsgInput').placeholder = t.chatPlaceholder;
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
    document.getElementById('authName').placeholder = t.placeholderName;
    document.getElementById('t_labelPass').innerText = t.labelPass;
    document.getElementById('authPass').placeholder = t.placeholderPass;
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

    const dateVal = document.getElementById('reportDate').value;
    const dayName = dateVal ? getDayNameFromDate(dateVal) : '';
    document.getElementById('zuhrLabel').innerText = dayName === 'Friday' ? t.jumma : t.zuhr;

    document.getElementById('t_extraHeading').innerText = t.extraHeading;
    document.getElementById('t_roza').innerText = t.roza;
    document.getElementById('t_tarawih').innerText = t.tarawih;
    document.getElementById('t_quran').innerText = t.quran;
    document.getElementById('submitBtn').innerText = t.submitBtn;

    document.getElementById('t_dashHeading').innerText = t.dashHeading;
    document.getElementById('t_recordsHeading').innerText = t.recordsHeading;
    if (document.getElementById('t_myStatDaysLbl')) document.getElementById('t_myStatDaysLbl').innerText = t.myStatDaysLbl;
    if (document.getElementById('t_myStatFarzLbl')) document.getElementById('t_myStatFarzLbl').innerText = t.myStatFarzLbl;
    if (document.getElementById('t_myStatRozaLbl')) document.getElementById('t_myStatRozaLbl').innerText = t.myStatRozaLbl;
    if (document.getElementById('t_myStatStreakLbl')) document.getElementById('t_myStatStreakLbl').innerText = t.myStatStreakLbl;
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
    renderCommunityLeaderboard();
    renderUserHistory();
    refreshChatAndNotificationsUI();
    renderSupremeAdminPanel();
}

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`;

const dateInput = document.getElementById('reportDate');
dateInput.value = todayStr;
dateInput.max = todayStr;
if (document.getElementById('admQuickDateInput')) {
    document.getElementById('admQuickDateInput').value = todayStr;
}

setLanguage(currentLang);
loadHijriCalendar(today);
checkDayAndLoadData();

/* 100% RELIABLE OFFLINE + ONLINE HIJRI CALENDAR */
async function loadHijriCalendar(dateObj) {
    const badge = document.getElementById('hijriDateBadge');
    try {
        const enFmt = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(dateObj);
        const arMonth = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            month: 'long'
        }).format(dateObj);
        badge.innerHTML = `🌙 ${enFmt.replace('AH', '')} <span class="ar-month">(${arMonth})</span> هـ`;
    } catch (err) {
        badge.innerText = '🌙 1448 Hijri';
    }

    try {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        const res = await fetch(`https://api.aladhan.com/v1/gToH/${d}-${m}-${y}`);
        const data = await res.json();
        if (data && data.data && data.data.hijri) {
            const hijri = data.data.hijri;
            badge.innerHTML = `🌙 ${hijri.day} ${hijri.month.en} <span class="ar-month">(${hijri.month.ar})</span> ${hijri.year} هـ`;
        }
    } catch (e) {}
}

function toggleSideMenu() {
    const overlay = document.getElementById('sideDrawerOverlay');
    overlay.classList.toggle('open');
    const savedName = localStorage.getItem('namaz_user') || 'ZikrSphere Guest';
    const savedPhoto = localStorage.getItem('namaz_photo') || 'https://osman-debug3.github.io/namaz/logo.jpg';
    document.getElementById('drawerUserName').innerText = savedName;
    document.getElementById('drawerUserAvatar').src = savedPhoto;

    const info = getMemberSerialAndInfo(savedName);
    const serialBadge = document.getElementById('drawerUserSerialBadge');
    if (info.serial) {
        serialBadge.innerText = `Member Serial #${info.serial}`;
        serialBadge.classList.remove('hidden');
    } else {
        serialBadge.classList.add('hidden');
    }
    refreshChatAndNotificationsUI();
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
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        return str.split('T')[0];
    }
    return str;
}

function getPillClass(val) {
    if (val === 'Ada' || val === 'Rakha') return 'pill-ada';
    if (val === 'Qaza') return 'pill-qaza';
    if (val && val !== 'Nahi') return 'pill-ada';
    return 'pill-nahi';
}

function translateStatusVal(val) {
    if (val === 'Ada') return '✅ Ada';
    if (val === 'Qaza') return '🕒 Qaza';
    if (val === 'Rakha') return '🌟 Rakha';
    if (!val || val === 'Nahi') return '❌ Nahi';
    return val;
}

function createDetailedRecordHTML(r) {
    const t = translations[currentLang];
    const cleanDate = cleanDateString(r.date);
    const timeBadge = (r.time && r.time !== '-') ? ` • 🕒 ${r.time}` : '';
    const adaCount = [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
    return `
        <div class="detailed-record-card">
            <div class="detailed-record-header">
                <span>📅 ${cleanDate} (${r.day || ''})${timeBadge}</span>
                <span style="color: var(--emerald-bright);">${t.farzAdaLabel}: ${adaCount}/5</span>
            </div>
            <div class="Status-pills-grid">
                <span class="status-pill ${getPillClass(r.fajr)}"><span>${t.fajr}</span><strong>${translateStatusVal(r.fajr)}</strong></span>
                <span class="status-pill ${getPillClass(r.zuhr)}"><span>${t.zuhr}</span><strong>${translateStatusVal(r.zuhr)}</strong></span>
                <span class="status-pill ${getPillClass(r.asr)}"><span>${t.asr}</span><strong>${translateStatusVal(r.asr)}</strong></span>
                <span class="status-pill ${getPillClass(r.maghrib)}"><span>${t.maghrib}</span><strong>${translateStatusVal(r.maghrib)}</strong></span>
                <span class="status-pill ${getPillClass(r.isha)}"><span>${t.isha}</span><strong>${translateStatusVal(r.isha)}</strong></span>
                <span class="status-pill ${getPillClass(r.tahajjud)}"><span>🌌 Tahajjud</span><strong>${translateStatusVal(r.tahajjud)}</strong></span>
                <span class="status-pill ${getPillClass(r.duha)}"><span>☀️ Al-Duha</span><strong>${translateStatusVal(r.duha)}</strong></span>
                <span class="status-pill ${getPillClass(r.roza)}"><span>${t.roza}</span><strong>${translateStatusVal(r.roza)}</strong></span>
                <span class="status-pill ${getPillClass(r.quran)}"><span>📖 Quran</span><strong>${r.quran || 'Nahi'}</strong></span>
                <span class="status-pill ${getPillClass(r.tarawih)}"><span>${t.tarawih}</span><strong>${translateStatusVal(r.tarawih)}</strong></span>
            </div>
        </div>
    `;
}

function getUserStreakAndBadge(userName, records) {
    const userRecs = records.filter(r => r.name.toLowerCase() === userName.toLowerCase());
    if (userRecs.length === 0) return { streak: 0, badge: '' };

    userRecs.sort((a, b) => new Date(cleanDateString(b.date)) - new Date(cleanDateString(a.date)));

    let streak = 0;
    for (let i = 0; i < userRecs.length; i++) {
        const adaCount = [userRecs[i].fajr, userRecs[i].zuhr, userRecs[i].asr, userRecs[i].maghrib, userRecs[i].isha].filter(x => x === 'Ada').length;
        if (adaCount === 5) streak++;
        else break;
    }

    let badge = '';
    if (streak >= 30) badge = '👑 Aashiq-e-Namaz (30+ Days)';
    else if (streak >= 7) badge = '⭐ 7-Day Streaker';
    else if (streak >= 3) badge = '✨ Consistent (3+ Days)';

    return { streak, badge };
}

function switchSection(section) {
    const trackerCard = document.getElementById('trackerCard');
    const homeSec = document.getElementById('sectionHome');
    const trackerSec = document.getElementById('sectionTracker');
    const dashSec = document.getElementById('sectionDashboard');
    const recordsSec = document.getElementById('sectionRecords');
    const adminSec = document.getElementById('sectionAdmin');
    
    const homeBtn = document.getElementById('navHomeBtn');
    const trackerBtn = document.getElementById('navTrackerBtn');
    const dashBtn = document.getElementById('navDashBtn');
    const recordsBtn = document.getElementById('navRecordsBtn');
    const adminBtn = document.getElementById('navAdminBtn');

    homeSec.classList.add('hidden');
    trackerSec.classList.add('hidden');
    dashSec.classList.add('hidden');
    recordsSec.classList.add('hidden');
    adminSec.classList.add('hidden');

    homeBtn.classList.remove('active');
    trackerBtn.classList.remove('active');
    dashBtn.classList.remove('active');
    recordsBtn.classList.remove('active');
    adminBtn.classList.remove('active');

    if (section === 'home') {
        trackerCard.classList.remove('hidden');
        homeSec.classList.remove('hidden');
        homeBtn.classList.add('active');
    } else if (section === 'tracker') {
        trackerCard.classList.remove('hidden');
        trackerSec.classList.remove('hidden');
        trackerBtn.classList.add('active');
    } else if (section === 'dashboard') {
        trackerCard.classList.remove('hidden');
        dashSec.classList.remove('hidden');
        dashBtn.classList.add('active');
        fetchAllDataAndRefresh();
    } else if (section === 'records') {
        trackerCard.classList.remove('hidden');
        recordsSec.classList.remove('hidden');
        recordsBtn.classList.add('active');
        fetchAllDataAndRefresh();
    } else if (section === 'admin') {
        trackerCard.classList.remove('hidden');
        adminSec.classList.remove('hidden');
        adminBtn.classList.add('active');
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
                const TARGET_SIZE = 650;
                canvas.width = TARGET_SIZE;
                canvas.height = TARGET_SIZE;
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, TARGET_SIZE, TARGET_SIZE);

                let quality = 0.92;
                let dataUrl = canvas.toDataURL('image/webp', quality);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.90);
                }

                while (dataUrl.length > 49000 && quality > 0.45) {
                    quality -= 0.06;
                    dataUrl = canvas.toDataURL('image/webp', quality);
                    if (!dataUrl.startsWith('data:image/webp')) {
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
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
                body: JSON.stringify({
                    action: 'updatePhoto',
                    name: name,
                    password: password,
                    photo: newPhoto
                })
            });
            const data = await res.json();
            if (data.result === 'success') {
                localStorage.setItem('namaz_photo', newPhoto);
                document.getElementById('drawerUserAvatar').src = newPhoto;
                alert('✅ MashaAllah! Profile Photo updated!');
                fetchAllDataAndRefresh();
            } else {
                alert('❌ ' + data.message);
            }
        } catch (err) {
            alert('Error updating photo.');
        }
    });
}

function getDayNameFromDate(dateStr) {
    const parts = dateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dateObj.getDay()];
}

function checkDayAndLoadData() {
    const dateVal = document.getElementById('reportDate').value;
    if (!dateVal) return;
    const t = translations[currentLang];
    
    const parts = dateVal.split('-');
    const selectedDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    loadHijriCalendar(selectedDateObj);

    const dayName = getDayNameFromDate(dateVal);
    const zuhrLabel = document.getElementById('zuhrLabel');
    const zuhrArabic = document.getElementById('zuhrArabic');
    if (dayName === 'Friday') {
        zuhrLabel.innerText = t.jumma;
        zuhrArabic.innerText = 'الجمعة';
    } else {
        zuhrLabel.innerText = t.zuhr;
        zuhrArabic.innerText = 'الظهر';
    }
    fetchAllDataAndRefresh();
}

async function fetchAllDataAndRefresh() {
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getData`);
        const data = await res.json();
        if (data.result === 'success') {
            globalReports = data.reports || [];
            globalUsers = (data.users || []).map((u, idx) => ({
                ...u,
                serial: u.serial || (idx + 1)
            }));
            if (data.messages) {
                globalMessages = data.messages;
            }
            const savedName = localStorage.getItem('namaz_user');
            if (savedName) {
                const me = globalUsers.find(u => u.name.toLowerCase() === savedName.toLowerCase());
                if (me && me.photo) {
                    localStorage.setItem('namaz_photo', me.photo);
                    document.getElementById('drawerUserAvatar').src = me.photo;
                }
                sendOnlineHeartbeat();
            }
            updateUI();
            renderCommunityLeaderboard();
            renderUserHistory();
            refreshChatAndNotificationsUI();
            renderSupremeAdminPanel();
        }
    } catch (e) {
        console.error(e);
    }
}

function updateUI() {
    const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    let score = 0;
    let totalPossible = 5;

    prayers.forEach(p => {
        const val = document.getElementById(p).value;
        const card = document.getElementById('card-' + p);
        card.classList.remove('status-ada', 'status-qaza');
        if (val === 'Ada') {
            card.classList.add('status-ada');
            score += 1;
        } else if (val === 'Qaza') {
            card.classList.add('status-qaza');
            score += 0.5;
        }
    });

    document.getElementById('card-tahajjud').classList.toggle('status-ada', document.getElementById('tahajjud').value === 'Ada');
    document.getElementById('card-duha').classList.toggle('status-ada', document.getElementById('duha').value === 'Ada');
    document.getElementById('card-roza').classList.toggle('status-ada', document.getElementById('roza').value === 'Rakha');
    document.getElementById('card-tarawih').classList.toggle('status-ada', document.getElementById('tarawih').value === 'Ada');
    document.getElementById('card-quran').classList.toggle('status-ada', document.getElementById('quran').value !== 'Nahi');

    const percent = Math.round((score / totalPossible) * 100);
    document.getElementById('progressBar').style.width = percent + '%';
    document.getElementById('progressPercent').innerText = percent + '%';
}

function renderCommunityLeaderboard() {
    const podiumContainer = document.getElementById('podiumContainer');
    const leaderboardList = document.getElementById('leaderboardList');
    if (!podiumContainer || !leaderboardList) return;
    const t = translations[currentLang];

    podiumContainer.innerHTML = '';
    leaderboardList.innerHTML = '';

    const currentDate = document.getElementById('reportDate').value;

    let userScores = globalUsers.map(u => {
        const rep = globalReports.find(r => r.name.toLowerCase() === u.name.toLowerCase() && cleanDateString(r.date) === currentDate);
        let points = 0;
        if (rep) {
            ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
                if (rep[p] === 'Ada') points += 1;
                else if (rep[p] === 'Qaza') points += 0.5;
            });
            if (rep.tahajjud === 'Ada') points += 1;
            if (rep.duha === 'Ada') points += 1;
            if (rep.roza === 'Rakha') points += 1;
            if (rep.tarawih === 'Ada') points += 1;
            if (rep.quran && rep.quran !== 'Nahi') points += 1;
        }
        const st = getUserStreakAndBadge(u.name, globalReports);
        return { serial: u.serial, name: u.name, photo: u.photo, points: points, badge: st.badge };
    });

    userScores.sort((a, b) => b.points - a.points);

    let top3 = userScores.slice(0, 3);
    top3.forEach((user, index) => {
        let rankClass = index === 0 ? 'rank-1' : '';
        let badgeText = index === 0 ? '👑 1st' : (index === 1 ? '🥈 2nd' : '🥉 3rd');
        
        const card = document.createElement('div');
        card.className = `podium-card ${rankClass}`;
        card.onclick = () => openMemberProfile(user.name);
        card.innerHTML = `
            <div class="rank-badge">${badgeText}</div>
            <img src="${user.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" alt="img">
            <div class="name">#${user.serial} ${user.name}</div>
            <div class="score">⭐ ${user.points} Pts</div>
            ${user.badge ? `<div class="badge-chip">${user.badge}</div>` : ''}
        `;
        podiumContainer.appendChild(card);
    });

    let remainingUsers = userScores.slice(3, 10);
    let restUsers = userScores.slice(10);

    if (userScores.length === 0) {
        leaderboardList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12.5px;">${t.emptyRecord}</div>`;
        return;
    }

    remainingUsers.forEach((user, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.onclick = () => openMemberProfile(user.name);
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight:700; color:var(--gold);">#${idx + 4}</span>
                <img src="${user.photo}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid var(--gold);">
                <div>
                    <span style="font-weight:600; display:block;">${user.name} <small style="color:var(--text-muted);">(ID #${user.serial})</small></span>
                    ${user.badge ? `<span style="font-size:9.5px; color:var(--gold-light);">${user.badge}</span>` : ''}
                </div>
            </div>
            <span style="color:var(--emerald-bright); font-weight:700;">⭐ ${user.points} Pts</span>
        `;
        leaderboardList.appendChild(item);
    });

    if (restUsers.length > 0) {
        const headerOthers = document.createElement('div');
        headerOthers.style.cssText = "font-size:11px; font-weight:700; color:var(--text-muted); margin: 10px 0 4px; text-transform:uppercase;";
        headerOthers.innerText = t.otherMembers;
        leaderboardList.appendChild(headerOthers);

        restUsers.forEach((user, idx) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.onclick = () => openMemberProfile(user.name);
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight:600; color:var(--text-muted);">#${idx + 11}</span>
                    <img src="${user.photo}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
                    <span>${user.name} <small style="color:var(--text-muted);">(ID #${user.serial})</small></span>
                </div>
                <span style="color:var(--emerald-bright);">⭐ ${user.points} Pts</span>
            `;
            leaderboardList.appendChild(item);
        });
    }
}

/* 👑 SUPREME ADMIN COMMAND CENTER & INSTANT LOOKUP ENGINE */
function renderSupremeAdminPanel() {
    if (!isUserAdmin()) return;

    const currentDate = document.getElementById('reportDate').value || todayStr;
    document.getElementById('admPendingDateBadge').innerText = `📅 ${currentDate}`;

    const todaySubmittedSet = new Set(
        globalReports
            .filter(r => cleanDateString(r.date) === currentDate)
            .map(r => r.name.toLowerCase())
    );

    const pendingMembers = globalUsers.filter(u => !todaySubmittedSet.has(u.name.toLowerCase()));

    document.getElementById('admStatTotalUsers').innerText = globalUsers.length;
    document.getElementById('admStatTodaySub').innerText = todaySubmittedSet.size;
    document.getElementById('admStatPending').innerText = pendingMembers.length;
    document.getElementById('admStatTotalReports').innerText = globalReports.length;
    document.getElementById('admDirectoryCountBadge').innerText = `${globalUsers.length} Members`;

    const qSelect = document.getElementById('admQuickUserSelect');
    const prevVal = qSelect.value;
    qSelect.innerHTML = globalUsers.map(u => `<option value="${u.name}">#${u.serial} — ${u.name}</option>`).join('');
    if (prevVal) qSelect.value = prevVal;

    const pendingBox = document.getElementById('admPendingUsersList');
    if (pendingMembers.length === 0) {
        pendingBox.innerHTML = `<div style="text-align:center; color:var(--emerald-bright); font-size:12px; padding:10px;">🌟 MashaAllah! Aaj sabhi members ne report bhej di hai!</div>`;
    } else {
        pendingBox.innerHTML = pendingMembers.map(u => {
            const safeName = u.name.replace(/'/g, "\\'");
            return `
                <div class="admin-user-row">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="serial-pill" style="margin:0;">#${u.serial}</span>
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
    }

    const dirBox = document.getElementById('admAllMembersDirectory');
    dirBox.innerHTML = globalUsers.map(u => {
        const uReports = globalReports.filter(r => r.name.toLowerCase() === u.name.toLowerCase());
        const lastRep = uReports.length > 0 ? uReports[uReports.length - 1] : null;
        const lastSeenInfo = lastRep ? `${cleanDateString(lastRep.date)} (${lastRep.time || '-'})` : 'No reports yet';
        const safeName = u.name.replace(/'/g, "\\'");
        const safePass = (u.password || '').replace(/'/g, "\\'");

        return `
            <div class="admin-user-row">
                <div style="display:flex; align-items:center; gap:9px;">
                    <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1.5px solid var(--gold);">
                    <div>
                        <div style="font-weight:800; color:var(--gold-light); font-size:13px;">
                            <span style="color:var(--emerald-bright);">#${u.serial}</span> • ${u.name}
                        </div>
                        <div style="font-size:10.5px; color:#a7f3d0;">🔑 PIN: <strong>${u.password || '****'}</strong> | 📅 Joined: <strong>${u.createdAt || '-'}</strong></div>
                        <div style="font-size:10px; color:var(--text-muted);">📊 Reports: ${uReports.length} | 🕒 Last: ${lastSeenInfo}</div>
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

/* 🔍 INSTANT MEMBER LOOKUP ENGINE (SEARCH BY SERIAL NO, NAME OR PIN) */
function runAdminMemberLookup() {
    const inputEl = document.getElementById('adminLookupInput');
    const resultBox = document.getElementById('adminLookupResultBox');
    if (!inputEl || !resultBox) return;

    const query = (inputEl.value || '').trim().toLowerCase();
    if (!query) {
        resultBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11.5px; padding:8px;">Upar kisi bhi member ka Serial No (jaise 1, 2) ya Naam type karein.</div>`;
        return;
    }

    const cleanSerialQuery = query.replace('#', '');
    const matchedUsers = globalUsers.filter(u => {
        if (String(u.serial) === cleanSerialQuery) return true;
        if (u.name.toLowerCase().includes(query)) return true;
        if ((u.password || '').toLowerCase().includes(query)) return true;
        return false;
    });

    if (matchedUsers.length === 0) {
        resultBox.innerHTML = `<div style="text-align:center; color:#fca5a5; font-size:12px; padding:10px;">❌ Is Serial No ya Naam se koi member nahi mila.</div>`;
        return;
    }

    resultBox.innerHTML = matchedUsers.map(u => {
        const uRecords = globalReports.filter(r => r.name.toLowerCase() === u.name.toLowerCase());
        let totalFarz = 0;
        let totalTahajjud = 0;
        let totalDuha = 0;
        let totalRoza = 0;
        uRecords.forEach(r => {
            totalFarz += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
            if (r.tahajjud === 'Ada') totalTahajjud++;
            if (r.duha === 'Ada') totalDuha++;
            if (r.roza === 'Rakha') totalRoza++;
        });
        const st = getUserStreakAndBadge(u.name, globalReports);
        const safeName = u.name.replace(/'/g, "\\'");
        const safePass = (u.password || '').replace(/'/g, "\\'");

        const recentRecordsHTML = uRecords.length === 0
            ? `<div style="font-size:11.5px; color:var(--text-muted); padding:8px;">Koi report save nahi hai.</div>`
            : uRecords.slice().reverse().map(r => createDetailedRecordHTML(r)).join('');

        return `
            <div style="background:rgba(2,24,18,0.92); border:1.5px solid var(--gold); border-radius:14px; padding:14px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid rgba(212,175,55,0.25); padding-bottom:10px; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${u.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:54px; height:54px; border-radius:50%; object-fit:cover; border:2px solid var(--gold); cursor:pointer;" onclick="openFullScreenPhoto(this.src)">
                        <div>
                            <span class="serial-pill">Serial No #${u.serial}</span>
                            <div style="font-size:16px; font-weight:800; color:var(--gold-light);">${u.name}</div>
                            <div style="font-size:11px; color:#a7f3d0;">🔑 Password (PIN): <strong>${u.password || '****'}</strong> | 📅 Joined: <strong>${u.createdAt || '-'}</strong></div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="admin-mini-btn" onclick="adminEditMemberCredentials('${safeName}', '${safePass}')">✏️ Edit ID/PIN</button>
                        <button type="button" class="admin-mini-btn danger" onclick="adminRemoveMember('${safeName}')">🗑️ Delete</button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; text-align:center; margin-bottom:12px;">
                    <div style="background:rgba(255,255,255,0.04); padding:7px; border-radius:9px;">
                        <div style="font-weight:800; color:var(--gold-light); font-size:14px;">${uRecords.length}</div>
                        <div style="font-size:9.5px; color:#cbd5e1;">Kul Din</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04); padding:7px; border-radius:9px;">
                        <div style="font-weight:800; color:var(--emerald-bright); font-size:14px;">${totalFarz}</div>
                        <div style="font-size:9.5px; color:#cbd5e1;">Farz Ada</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04); padding:7px; border-radius:9px;">
                        <div style="font-weight:800; color:#fcd34d; font-size:14px;">${totalTahajjud + totalDuha}</div>
                        <div style="font-size:9.5px; color:#cbd5e1;">Nawafil</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04); padding:7px; border-radius:9px;">
                        <div style="font-weight:800; color:var(--gold-light); font-size:14px;">${totalRoza} (${st.streak}🔥)</div>
                        <div style="font-size:9.5px; color:#cbd5e1;">Roze / Streak</div>
                    </div>
                </div>

                <div style="font-size:12px; font-weight:800; color:var(--gold-light); margin-bottom:6px;">📜 ${u.name} Ki Sabhi Reports (${uRecords.length}):</div>
                <div style="max-height:260px; overflow-y:auto;">${recentRecordsHTML}</div>
            </div>
        `;
    }).join('');
}

/* ✨ AUTO-FORMAT & BUILD ALL GOOGLE SHEETS (MEMBERS, USERS, MESSAGES, LOOKUP) */
async function adminFormatAndSyncAllSheets() {
    const btn = document.getElementById('formatSheetsBtn');
    btn.disabled = true;
    btn.innerText = '⏳ Sabhi Sheets Ko VIP Design Mein Set Kiya Ja Raha Hai...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'formatAllSheets' })
        });
        const data = await res.json();
        alert('✅ ' + (data.message || 'Sabhi Google Sheets (Sheet1, Members, Users, Messages, aur Lookup) VIP tarteeb mein set ho gayin!'));
        fetchAllDataAndRefresh();
    } catch (e) {
        alert('✅ Request bhej di gayi! Apni Google Sheet check karein.');
    } finally {
        btn.disabled = false;
        btn.innerText = '✨ Sabhi Google Sheets Ko VIP Design & Lookup Mein Set Karein';
    }
}

async function adminSendDirectReminder(memberName) {
    const msgId = 'm_' + Date.now();
    const text = `Assalamu Alaikum ${memberName}! 🌙 Aaj ki Namaz aur Roza report abhi tak ZikrSphere par darj nahi hui hai, baraye meherbani apni report save kar lein. JazakAllah!`;
    const encodedPayload = `CHAT2|${msgId}|ABBU SHAHMA|${memberName}|1|${text}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: encodedPayload });
    refreshChatAndNotificationsUI();
    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(encodedPayload)}`);
        alert(`✅ ${memberName} ko direct chat reminder bhej diya gaya!`);
    } catch (e) {}
}

async function RemindAllDefaultersBroadcast() {
    const currentDate = document.getElementById('reportDate').value || todayStr;
    const todaySubmittedSet = new Set(
        globalReports.filter(r => cleanDateString(r.date) === currentDate).map(r => r.name.toLowerCase())
    );
    const pendingNames = globalUsers.filter(u => !todaySubmittedSet.has(u.name.toLowerCase())).map(u => u.name);
    if (pendingNames.length === 0) {
        alert('🌟 MashaAllah! Aaj sabhi members report bhej chuke hain!');
        return;
    }
    const bId = 'b_' + Date.now();
    const title = '🌙 Aaj Ki Ibadat Report Reminder';
    const text = `Assalamu Alaikum! Jin members (${pendingNames.join(', ')}) ne aaj ki Namaz report abhi tak save nahi ki hai, woh ZikrSphere par apni report darj kar lein.`;
    const encodedPayload = `BROADCAST2|${bId}|ABBU SHAHMA|ALL|${title}::${text}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: encodedPayload });
    refreshChatAndNotificationsUI();
    try {
        await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(encodedPayload)}`);
        alert('✅ Sabhi pending members ke liye Bell Notification bhej diya gaya!');
    } catch (e) {}
}

async function adminQuickSubmitReport() {
    const targetUser = document.getElementById('admQuickUserSelect').value;
    const preset = document.getElementById('admQuickPreset').value;
    const date = document.getElementById('admQuickDateInput').value || document.getElementById('reportDate').value || todayStr;
    if (!targetUser) return;

    const dayName = getDayNameFromDate(date);
    const time12 = getCurrent12HourTime();

    let reportData = {
        fajr: 'Ada',
        zuhr: 'Ada',
        asr: 'Ada',
        maghrib: 'Ada',
        isha: 'Ada',
        tahajjud: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi',
        duha: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi',
        roza: preset === 'AllAdaPlus' ? 'Rakha' : 'Nahi',
        quran: preset === 'AllAdaPlus' ? '1 Page' : 'Nahi',
        tarawih: preset === 'AllAdaPlus' ? 'Ada' : 'Nahi'
    };

    if (preset === 'CustomFromForm') {
        reportData = {
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
        };
    }

    const params = new URLSearchParams({
        action: 'save',
        name: targetUser,
        date: date,
        day: dayName,
        time: time12,
        ...reportData
    });

    try {
        const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const data = await res.json();
        alert(`✅ ${targetUser}: ${data.message}`);
        fetchAllDataAndRefresh();
    } catch (e) {
        alert('Report saved!');
        fetchAllDataAndRefresh();
    }
}

async function adminEditMemberCredentials(oldName, currentPass) {
    const newName = prompt(`✏️ ${oldName} ka Naya Naam likhein (ya wahi rehne dein):`, oldName);
    if (newName === null) return;
    const newPass = prompt(`🔑 ${newName} ka Naya Password (PIN) likhein:`, currentPass);
    if (newPass === null) return;

    if (!newName.trim() || !newPass.trim()) {
        alert('Naam aur Password khali nahi ho sakte!');
        return;
    }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateAccount',
                oldName: oldName,
                newName: newName.trim(),
                newPassword: newPass.trim()
            })
        });
        const data = await res.json();
        alert('✅ ' + data.message);
        fetchAllDataAndRefresh();
    } catch (e) {
        alert('Error updating member.');
    }
}

async function adminRemoveMember(targetUser) {
    if (!confirm(`⚠️ Kya aap waqai "${targetUser}" ki ID delete karna chahte hain?`)) return;
    const delRep = confirm(`Kya "${targetUser}" ke pichhle saare Namaz records bhi Google Sheet se mita dein? (Cancel dabayenge toh sirf ID hategi, records rahenge)`);

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'adminDeleteUser',
                targetUser: targetUser,
                deleteReports: delRep
            })
        });
        const data = await res.json();
        alert('✅ ' + data.message);
        fetchAllDataAndRefresh();
    } catch (e) {
        alert('Error deleting member.');
    }
}

function exportMasterDatabaseCSV() {
    if (globalReports.length === 0) {
        alert('Abhi koi record maujood nahi hai!');
        return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Date,Day,Time,Name,Fajr,Zuhr,Asr,Maghrib,Isha,Tahajjud,Duha_Ishraq,Roza,Quran,Tarawih\n";
    globalReports.forEach(r => {
        csvContent += `${cleanDateString(r.date)},${r.day || ''},${r.time || '-'},${r.name},${r.fajr},${r.zuhr},${r.asr},${r.maghrib},${r.isha},${r.tahajjud || 'Nahi'},${r.duha || 'Nahi'},${r.roza},${r.quran},${r.tarawih}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ZikrSphere_Master_Database_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openMemberProfile(userName) {
    const t = translations[currentLang];
    const userObj = globalUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
    const userRecords = globalReports.filter(r => r.name.toLowerCase() === userName.toLowerCase());
    const st = getUserStreakAndBadge(userName, globalReports);
    const info = getMemberSerialAndInfo(userName);

    let totalNamazAda = 0;
    let totalRoza = 0;
    userRecords.forEach(r => {
        totalNamazAda += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
        if (r.roza === 'Rakha') totalRoza++;
    });

    document.getElementById('modalUserName').innerText = userName;
    document.getElementById('modalUserAvatar').src = userObj ? userObj.photo : 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png';
    if (document.getElementById('modalUserSerialBadge')) {
        document.getElementById('modalUserSerialBadge').innerText = `Member Serial #${info.serial || '-'}`;
    }
    if (document.getElementById('modalUserJoinDate')) {
        document.getElementById('modalUserJoinDate').innerText = `📅 Joined: ${info.createdAt || '-'}`;
    }
    
    const badgeDiv = document.getElementById('modalUserBadges');
    if (st.badge) {
        badgeDiv.innerHTML = `<span class="badge-chip" style="font-size:11px; padding:3px 10px;">${st.badge}</span>`;
    } else {
        badgeDiv.innerHTML = '';
    }

    document.getElementById('modalUserPoints').innerText = `${t.statsDays}: ${userRecords.length} | ${t.statsNamaz}: ${totalNamazAda} | ${t.statsRoza}: ${totalRoza}`;

    const histContainer = document.getElementById('modalUserHistory');
    histContainer.innerHTML = '';

    if (userRecords.length === 0) {
        histContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">${t.emptyHistory}</div>`;
    } else {
        userRecords.slice().reverse().forEach(r => {
            histContainer.innerHTML += createDetailedRecordHTML(r);
        });
    }

    document.getElementById('memberModal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('memberModal').classList.add('hidden');
}

/* UPGRADED MERI A'AMAL RENDERER WITH STATS & FILTER */
function renderUserHistory() {
    const listContainer = document.getElementById('userHistoryList');
    const savedName = localStorage.getItem('namaz_user');
    if (!listContainer || !savedName) return;
    const t = translations[currentLang];

    const userRecords = globalReports.filter(r => r.name.toLowerCase() === savedName.toLowerCase());
    const st = getUserStreakAndBadge(savedName, globalReports);

    // Update Summary Stats Cards
    let totalFarzAda = 0;
    let totalRoza = 0;
    userRecords.forEach(r => {
        totalFarzAda += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
        if (r.roza === 'Rakha') totalRoza++;
    });
    const maxPossibleFarz = userRecords.length * 5;
    const farzRate = maxPossibleFarz > 0 ? Math.round((totalFarzAda / maxPossibleFarz) * 100) : 0;

    if (document.getElementById('myStatTotalDays')) document.getElementById('myStatTotalDays').innerText = userRecords.length;
    if (document.getElementById('myStatFarzRate')) document.getElementById('myStatFarzRate').innerText = `${farzRate}%`;
    if (document.getElementById('myStatTotalRoza')) document.getElementById('myStatTotalRoza').innerText = totalRoza;
    if (document.getElementById('myStatStreak')) document.getElementById('myStatStreak').innerText = `${st.streak}🔥`;

    if (userRecords.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px;">${t.emptyHistory}</div>`;
        return;
    }

    const searchQ = (document.getElementById('myRecordSearchInput')?.value || '').trim().toLowerCase();
    const filteredRecords = userRecords.filter(r => {
        if (!searchQ) return true;
        return cleanDateString(r.date).toLowerCase().includes(searchQ) ||
               (r.day || '').toLowerCase().includes(searchQ) ||
               (r.time || '').toLowerCase().includes(searchQ);
    });

    if (filteredRecords.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12.5px; padding: 14px;">Is tarik ya din ka koi record nahi mila.</div>`;
        return;
    }

    listContainer.innerHTML = filteredRecords.slice().reverse().map(r => createDetailedRecordHTML(r)).join('');
}

function exportMyReportCSV() {
    const savedName = localStorage.getItem('namaz_user');
    const userRecords = globalReports.filter(r => r.name.toLowerCase() === savedName.toLowerCase());

    if (userRecords.length === 0) {
        alert(translations[currentLang].emptyHistory);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Date,Day,Time,Name,Fajr,Zuhr,Asr,Maghrib,Isha,Tahajjud,Duha_Ishraq,Roza,Quran,Tarawih\n";
    userRecords.forEach(r => {
        csvContent += `${cleanDateString(r.date)},${r.day || ''},${r.time || '-'},${r.name},${r.fajr},${r.zuhr},${r.asr},${r.maghrib},${r.isha},${r.tahajjud || 'Nahi'},${r.duha || 'Nahi'},${r.roza},${r.quran},${r.tarawih}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${savedName}_Ibadat_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.onload = function() {
    const savedName = localStorage.getItem('namaz_user');
    const savedPass = localStorage.getItem('namaz_pass');
    const savedPhoto = localStorage.getItem('namaz_photo');
    if (savedName && savedPass) {
        showTracker(savedName, savedPhoto);
    }
};

function switchTab(mode) {
    currentMode = mode;
    const t = translations[currentLang];
    document.getElementById('loginTab').classList.toggle('active', mode === 'login');
    document.getElementById('registerTab').classList.toggle('active', mode === 'register');
    const photoGroup = document.getElementById('photoGroup');

    if (mode === 'login') {
        document.getElementById('authTitle').innerText = t.authTitleLogin;
        document.getElementById('authBtn').innerText = t.authBtnLogin;
        document.getElementById('authHelp').innerText = t.authHelpLogin;
        photoGroup.style.display = 'none';
    } else {
        document.getElementById('authTitle').innerText = t.authTitleRegister;
        document.getElementById('authBtn').innerText = t.authBtnRegister;
        document.getElementById('authHelp').innerText = t.authHelpRegister;
        photoGroup.style.display = 'block';
    }
}

async function handleAuth() {
    const name = document.getElementById('authName').value.trim();
    const password = document.getElementById('authPass').value.trim();
    const t = translations[currentLang];

    if (!name || !password) {
        alert(t.placeholderName);
        return;
    }

    const btn = document.getElementById('authBtn');
    btn.innerText = t.waitText;
    btn.disabled = true;

    try {
        let response;
        if (currentMode === 'register') {
            response = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'register',
                    name: name,
                    password: password,
                    photo: tempBase64Photo,
                    joinTime: getCurrent12HourTime()
                })
            });
        } else {
            const url = `${SCRIPT_URL}?action=login&name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`;
            response = await fetch(url);
        }
        const data = await response.json();

        if (data.result === 'success') {
            const finalName = data.name || name;
            const finalPhoto = data.photo || tempBase64Photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png';
            localStorage.setItem('namaz_user', finalName);
            localStorage.setItem('namaz_pass', password);
            localStorage.setItem('namaz_photo', finalPhoto);
            alert(data.message);
            showTracker(finalName, finalPhoto);
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Connection error.');
    } finally {
        btn.innerText = currentMode === 'login' ? t.authBtnLogin : t.authBtnRegister;
        btn.disabled = false;
    }
}

function showTracker(name, photo) {
    document.getElementById('authCard').classList.add('hidden');
    document.getElementById('trackerCard').classList.remove('hidden');
    document.getElementById('bottomNavBar').classList.remove('hidden');
    document.getElementById('drawerUserActions').classList.remove('hidden');
    document.getElementById('settingsPhotoWrap').classList.remove('hidden');
    document.getElementById('accountUpdateWrap').classList.remove('hidden');
    document.getElementById('drawerUserName').innerText = name;
    if (photo) {
        document.getElementById('drawerUserAvatar').src = photo;
    }
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
    document.getElementById('trackerCard').classList.add('hidden');
    document.getElementById('bottomNavBar').classList.add('hidden');
    document.getElementById('drawerUserActions').classList.add('hidden');
    document.getElementById('settingsPhotoWrap').classList.add('hidden');
    document.getElementById('accountUpdateWrap').classList.add('hidden');
    document.getElementById('supremeAdminHeaderBadge').classList.add('hidden');
    document.getElementById('navAdminBtn').classList.add('hidden');
    document.getElementById('authCard').classList.remove('hidden');
}

function markAll() {
    document.getElementById('fajr').value = 'Ada';
    document.getElementById('zuhr').value = 'Ada';
    document.getElementById('asr').value = 'Ada';
    document.getElementById('maghrib').value = 'Ada';
    document.getElementById('isha').value = 'Ada';
    updateUI();
}

async function saveReport() {
    const name = localStorage.getItem('namaz_user');
    const password = localStorage.getItem('namaz_pass');
    const date = document.getElementById('reportDate').value;
    const t = translations[currentLang];

    if (!name || !password) {
        logout();
        return;
    }

    const dayName = getDayNameFromDate(date);
    const time12 = getCurrent12HourTime();
    const btn = document.getElementById('submitBtn');
    btn.innerText = t.savingText;
    btn.disabled = true;

    const params = new URLSearchParams({
        action: 'save',
        name: name,
        password: password,
        date: date,
        day: dayName,
        time: time12,
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

        if (data.result === 'success') {
            alert('✅ MashaAllah! ' + data.message);
            fetchAllDataAndRefresh();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('✅ MashaAllah!');
        fetchAllDataAndRefresh();
    } finally {
        btn.innerText = t.submitBtn;
        btn.disabled = false;
    }
}
