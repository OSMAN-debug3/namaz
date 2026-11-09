/* ================= CHAT, PERMANENT SEEN BADGE & WORKING CUT (×) NOTIFICATIONS MODULE ================= */

const ZS_SUPREME_LIST = (typeof SUPREME_ADMINS !== 'undefined')
    ? SUPREME_ADMINS
    : ['abbu shahma', 'osman', 'admin', 'osman sardar', 'osman bey'];

const ZS_ADMIN_LIST = (typeof DEFAULT_ADMINS !== 'undefined')
    ? DEFAULT_ADMINS
    : ((typeof ADMIN_NAMES !== 'undefined') ? ADMIN_NAMES : [...ZS_SUPREME_LIST, 'muhammad sibgathullah', 'md firoz alam']);

function checkIsSupremeAdmin() {
    if (typeof isSupremeAdmin === 'function') return isSupremeAdmin();
    const u = (localStorage.getItem('namaz_user') || '').trim().toLowerCase();
    return ZS_SUPREME_LIST.includes(u);
}

function makeStableNotifKey(rawId, from, title, body) {
    const cleanText = `${from}_${title}_${body}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawId && !rawId.startsWith('legacy_')) return rawId;
    return ' notif_' + cleanText.slice(0, 40);
}

function getPermanentSeenSet() {
    try {
        const globalSeen = JSON.parse(localStorage.getItem('zikr_seen_permanent_v4') || '[]');
        const oldDismissed = JSON.parse(localStorage.getItem('zikr_dismissed_notifs') || '[]');
        return new Set([...globalSeen, ...oldDismissed]);
    } catch (e) {
        return new Set();
    }
}

function savePermanentSeenSet(seenSet) {
    try {
        const arr = Array.from(seenSet);
        localStorage.setItem('zikr_seen_permanent_v4', JSON.stringify(arr));
        localStorage.setItem('zikr_dismissed_notifs', JSON.stringify(arr));
    } catch (e) {}
}

function getPermanentCutSet() {
    try {
        return new Set(JSON.parse(localStorage.getItem('zikr_cut_permanent_v4') || '[]'));
    } catch (e) {
        return new Set();
    }
}

function savePermanentCutSet(cutSet) {
    try {
        localStorage.setItem('zikr_cut_permanent_v4', JSON.stringify(Array.from(cutSet)));
    } catch (e) {}
}

async function markAllVisibleBroadcastsAsSeen() {
    const state = buildMessageSystemState();
    const seenSet = getPermanentSeenSet();
    let changed = false;

    state.broadcasts.forEach(b => {
        if (!seenSet.has(b.id) || !seenSet.has(b.rawId)) {
            seenSet.add(b.id);
            seenSet.add(b.rawId);
            changed = true;
        }
    });

    if (changed) {
        savePermanentSeenSet(seenSet);
        const myName = (localStorage.getItem('namaz_user') || '').trim();
        if (myName && state.broadcasts.length > 0) {
            const maxOrder = Math.max(...state.broadcasts.map(b => b.order));
            const payload = `NOTIF_SEEN|${myName.toLowerCase()}|${maxOrder}`;
            globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
            try {
                await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`);
            } catch (e) {}
        }
    }
}

function toggleNotifPopup(e) {
    if (e) e.stopPropagation();
    const popup = document.getElementById('notifDropdownPopup');
    const bellBtn = document.getElementById('notifBellBtn');
    const isHidden = popup.classList.toggle('hidden');
    bellBtn.classList.toggle('active', !isHidden);

    if (!isHidden) {
        markAllVisibleBroadcastsAsSeen();
    }
    refreshChatAndNotificationsUI();
}

function closeNotifPopup() {
    document.getElementById('notifDropdownPopup').classList.add('hidden');
    document.getElementById('notifBellBtn').classList.remove('active');
    refreshChatAndNotificationsUI();
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
    const diffDays = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
}

async function clearAllNotifications() {
    const state = buildMessageSystemState();
    const cutSet = getPermanentCutSet();
    const seenSet = getPermanentSeenSet();

    state.broadcasts.forEach(b => {
        cutSet.add(b.id);
        cutSet.add(b.rawId);
        seenSet.add(b.id);
        seenSet.add(b.rawId);
    });
    savePermanentCutSet(cutSet);
    savePermanentSeenSet(seenSet);

    if (isUserAdmin()) {
        const payload = `CLEAR_BROADCASTS|${Date.now()}`;
        globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });
        try {
            await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`);
        } catch (e) {}
    }
    refreshChatAndNotificationsUI();
}

async function deleteSingleNotification(notifId, rawId, ev) {
    if (ev) ev.stopPropagation();

    const cutSet = getPermanentCutSet();
    const seenSet = getPermanentSeenSet();
    if (notifId) { cutSet.add(notifId); seenSet.add(notifId); }
    if (rawId) { cutSet.add(rawId); seenSet.add(rawId); }
    savePermanentCutSet(cutSet);
    savePermanentSeenSet(seenSet);

    const targetToDelete = rawId || notifId;
    const payload = `DELETE|${targetToDelete}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });

    refreshChatAndNotificationsUI();

    if (isUserAdmin()) {
        try {
            await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`);
        } catch (e) {}
    }
}

function buildMessageSystemState() {
    let chatsMap = new Map();
    let broadcastsMap = new Map();
    let onlineMap = {};
    let seenMap = {};
    let notifSeenOrderMap = {};
    let subAdminSet = new Set();

    globalMessages.forEach((item, index) => {
        const rawText = (item.message || '').toString();
        const sender = (item.name || 'Member').toString();
        const time = item.date ? cleanDateString(item.date) : '';
        const fallbackId = `legacy_${index}`;

        if (rawText.startsWith('SUBADMIN_ADD|')) {
            const targetUser = (rawText.split('|')[1] || '').trim().toLowerCase();
            if (targetUser) subAdminSet.add(targetUser);
            return;
        }
        if (rawText.startsWith('SUBADMIN_REMOVE|')) {
            const targetUser = (rawText.split('|')[1] || '').trim().toLowerCase();
            if (targetUser) subAdminSet.delete(targetUser);
            return;
        }
        if (rawText.startsWith('NOTIF_SEEN|')) {
            const parts = rawText.split('|');
            const viewer = (parts[1] || '').trim().toLowerCase();
            const seenIdx = parseInt(parts[2] || '0', 10);
            if (viewer) {
                notifSeenOrderMap[viewer] = Math.max(notifSeenOrderMap[viewer] || -1, seenIdx);
            }
            return;
        }
        if (rawText.startsWith('ONLINE|')) {
            const parts = rawText.split('|');
            const u = (parts[1] || sender).toLowerCase();
            onlineMap[u] = Math.max(onlineMap[u] || 0, parseInt(parts[2] || '0', 10));
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
            if (chatsMap.has(parts[1])) {
                const obj = chatsMap.get(parts[1]);
                obj.text = parts.slice(2).join('|');
                obj.edited = true;
            }
            return;
        }
        if (rawText.startsWith('DELETE|')) {
            const targetId = rawText.split('|')[1];
            chatsMap.delete(targetId);
            broadcastsMap.delete(targetId);
            for (let [k, val] of broadcastsMap.entries()) {
                if (val.rawId === targetId || val.id === targetId) {
                    broadcastsMap.delete(k);
                }
            }
            return;
        }
        if (rawText.startsWith('CLEAR_BROADCASTS|')) {
            broadcastsMap.clear();
            return;
        }
        if (rawText.startsWith('BROADCAST2|') || rawText.startsWith('BROADCAST|')) {
            const isV2 = rawText.startsWith('BROADCAST2|');
            const parts = rawText.split('|');
            const rawId = isV2 ? (parts[1] || fallbackId) : fallbackId;
            const from = isV2 ? (parts[2] || sender) : (parts[1] || sender);
            const fullMsg = parts.slice(isV2 ? 4 : 3).join('|');
            let title = 'Community Notice';
            let body = fullMsg;
            if (fullMsg.indexOf('::') !== -1) {
                const tb = fullMsg.split('::');
                title = tb[0].trim() || 'Community Notice';
                body = tb.slice(1).join('::').trim();
            }
            const stableKey = makeStableNotifKey(rawId, from, title, body);
            broadcastsMap.set(stableKey, {
                id: stableKey,
                rawId: rawId,
                type: 'BROADCAST',
                from,
                title,
                text: body,
                time,
                order: index
            });
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
    });

    if (typeof dynamicSubAdmins !== 'undefined') {
        dynamicSubAdmins = subAdminSet;
    }
    localStorage.setItem('zs_sub_admins', JSON.stringify(Array.from(subAdminSet)));

    return {
        chats: Array.from(chatsMap.values()),
        broadcasts: Array.from(broadcastsMap.values()),
        onlineMap,
        seenMap,
        notifSeenOrderMap
    };
}

function isPartnerCurrentlyOnline(partnerName, state) {
    if (!partnerName) return false;
    const p = partnerName.toLowerCase();
    if (p === 'admin') {
        return ZS_ADMIN_LIST.some(a => (Date.now() - (state.onlineMap[a] || 0)) < 10 * 60 * 1000);
    }
    return (Date.now() - (state.onlineMap[p] || 0)) < 10 * 60 * 1000;
}

function getMessageTickStatus(chatObj, state) {
    if (chatObj.isAdminReply) {
        const memberLower = (chatObj.to || '').toLowerCase();
        const seenOrder = state.seenMap[`${memberLower}->admin`];
        if (seenOrder !== undefined && seenOrder > chatObj.order) return 3;
        return isPartnerCurrentlyOnline(memberLower, state) ? 2 : 1;
    } else {
        const senderLower = (chatObj.from || '').toLowerCase();
        const seenOrder = state.seenMap[`admin->${senderLower}`];
        if (seenOrder !== undefined && seenOrder > chatObj.order) return 3;
        return isPartnerCurrentlyOnline('admin', state) ? 2 : 1;
    }
}

async function markConversationSeen() {
    const myName = (localStorage.getItem('namaz_user') || '').trim();
    if (!myName) return;
    if (isUserAdmin()) {
        const selectedMember = (document.getElementById('adminReplyTarget').value || '').trim().toLowerCase();
        if (!selectedMember) return;
        const payload = `SEEN|admin|${selectedMember}`;
        globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
        try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
    } else {
        const myLower = myName.toLowerCase();
        const payload = `SEEN|${myLower}|admin`;
        globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
        try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
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
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
}

async function editChatMessage(msgId, oldText) {
    const updated = prompt('✏️ Edit your message:', oldText);
    if (!updated || updated.trim() === oldText) return;
    const myName = (localStorage.getItem('namaz_user') || 'Member').trim();
    const payload = `EDIT|${msgId}|${updated.trim()}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
    refreshChatAndNotificationsUI();
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
}

async function deleteChatMessage(msgId) {
    if (!confirm('🗑️ Delete message?')) return;
    const myName = (localStorage.getItem('namaz_user') || 'Member').trim();
    const payload = `DELETE|${msgId}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
    refreshChatAndNotificationsUI();
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
}

function checkAndPopPhoneNotifications(broadcasts, chats) {
    const myName = (localStorage.getItem('namaz_user') || '').trim();
    if (!myName || typeof triggerNativePhoneNotification !== 'function') return;

    const poppedIds = JSON.parse(localStorage.getItem('zs_popped_phone_notifs') || '[]');
    let updated = false;

    broadcasts.forEach(b => {
        if (!poppedIds.includes(b.id)) {
            poppedIds.push(b.id);
            updated = true;
            triggerNativePhoneNotification(`🔔 ${b.title || 'ZikrSphere Notice'}`, b.text);
        }
    });

    chats.forEach(c => {
        if (c.isAdminReply && c.to.toLowerCase() === myName.toLowerCase() && !poppedIds.includes(c.id)) {
            poppedIds.push(c.id);
            updated = true;
            triggerNativePhoneNotification(`👑 Admin Message (${c.from})`, c.text);
        }
    });

    if (updated) {
        localStorage.setItem('zs_popped_phone_notifs', JSON.stringify(poppedIds.slice(-100)));
    }
}

function refreshChatAndNotificationsUI() {
    const t = translations[currentLang];
    const state = buildMessageSystemState();

    const myName = (localStorage.getItem('namaz_user') || '').trim();
    const myLower = myName.toLowerCase();
    const loggedIn = Boolean(myName);
    const adminMode = loggedIn && isUserAdmin();

    document.getElementById('adminChatBadge').classList.toggle('hidden', !adminMode);
    document.getElementById('adminReplySelectorWrap').classList.toggle('hidden', !adminMode);
    document.getElementById('adminBroadcastComposer').classList.toggle('hidden', !adminMode);
    const supremeBadge = document.getElementById('supremeAdminHeaderBadge');
    supremeBadge.classList.toggle('hidden', !adminMode);
    if (adminMode) {
        supremeBadge.innerText = checkIsSupremeAdmin() ? '👑 SUPREME ADMIN: ABBU SHAHMA' : `👑 COMMUNITY ADMIN: ${myName.toUpperCase()}`;
    }
    document.getElementById('navAdminBtn').classList.toggle('hidden', !adminMode);

    const cutSet = getPermanentCutSet();
    const seenSet = getPermanentSeenSet();
    const serverSeenOrder = state.notifSeenOrderMap[myLower] !== undefined ? state.notifSeenOrderMap[myLower] : -1;

    // 1. Hide notifications where user clicked Cut (×) or Clear All
    const visibleBroadcasts = state.broadcasts.filter(b => !cutSet.has(b.id) && !cutSet.has(b.rawId));

    // If popup is currently open, mark all visible broadcasts as seen right away
    const popupEl = document.getElementById('notifDropdownPopup');
    if (popupEl && !popupEl.classList.contains('hidden')) {
        visibleBroadcasts.forEach(b => {
            seenSet.add(b.id);
            seenSet.add(b.rawId);
        });
        savePermanentSeenSet(seenSet);
    }

    // 2. Unread notifications = visible notifications that have never been seen
    const unreadBroadcasts = visibleBroadcasts.filter(b => !seenSet.has(b.id) && !seenSet.has(b.rawId) && b.order > serverSeenOrder);

    if (loggedIn) {
        checkAndPopPhoneNotifications(visibleBroadcasts, state.chats);
    }

    const notifBox = document.getElementById('notifListBox');
    const badgeDot = document.getElementById('notifBadgeCount');
    const unreadCount = unreadBroadcasts.length;

    document.getElementById('notifPopupCountPill').innerText = unreadCount;

    if (unreadCount === 0) {
        if (badgeDot) badgeDot.classList.add('hidden');
    } else {
        if (badgeDot) {
            badgeDot.innerText = unreadCount;
            badgeDot.classList.remove('hidden');
        }
    }

    if (visibleBroadcasts.length === 0) {
        notifBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:12px; padding:22px 14px;">${t.emptyNotif}</div>`;
    } else {
        notifBox.innerHTML = visibleBroadcasts.slice().reverse().map(b => {
            const safeId = (b.id || '').replace(/'/g, "\\'");
            const safeRawId = (b.rawId || '').replace(/'/g, "\\'");
            return `
                <div class="notif-card-row">
                    <div class="notif-circle-icon notif-icon-gold">🔔</div>
                    <div class="notif-body-col">
                        <div class="notif-item-heading" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${b.title || 'Community Notice'}</span>
                            <span class="notif-single-del" onclick="deleteSingleNotification('${safeId}', '${safeRawId}', event)" title="Cut Message" style="cursor:pointer; color:#fca5a5; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.45); border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; line-height:1;">&times;</span>
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
        globalUsers.forEach(u => { if (!ZS_SUPREME_LIST.includes(u.name.toLowerCase())) memberNames.add(u.name); });
        state.chats.forEach(c => { if (!c.isAdminReply && !ZS_SUPREME_LIST.includes(c.from.toLowerCase())) memberNames.add(c.from); });
        const arr = Array.from(memberNames);
        targetSelect.innerHTML = arr.length === 0 ? `<option value="ALL">All Members</option>` : arr.map(m => `<option value="${m}">👤 ${m}</option>`).join('');
        if (currentTarget && arr.includes(currentTarget)) targetSelect.value = currentTarget;
    }

    renderChatConversation();
}

function renderChatConversation() {
    const t = translations[currentLang];
    const myName = (localStorage.getItem('namaz_user') || 'Guest').trim();
    const adminMode = isUserAdmin();
    const chatBox = document.getElementById('chatMessagesBox');
    const state = buildMessageSystemState();

    const partnerBar = document.getElementById('chatPartnerOnlineStatus');
    if (adminMode) {
        const selectedMember = document.getElementById('adminReplyTarget').value || 'Member';
        const online = isPartnerCurrentlyOnline(selectedMember, state);
        partnerBar.innerHTML = `<span class="status-dot ${online ? 'online' : 'offline'}"></span><span>${selectedMember}: <strong>${online ? 'Online' : 'Offline'}</strong></span>`;
    } else {
        const adminOnline = isPartnerCurrentlyOnline('admin', state);
        partnerBar.innerHTML = `<span class="status-dot ${adminOnline ? 'online' : 'offline'}"></span><span>Admin: <strong>${adminOnline ? 'Online' : 'Offline'}</strong></span>`;
    }

    const target = adminMode ? (document.getElementById('adminReplyTarget').value || '').toLowerCase() : myName.toLowerCase();
    const filtered = state.chats.filter(c => c.from.toLowerCase() === target || c.to.toLowerCase() === target);

    if (filtered.length === 0) {
        chatBox.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:11.5px; margin:auto; padding:12px;">${t.emptyChat}</div>`;
        return;
    }

    chatBox.innerHTML = filtered.map(c => {
        const isMine = adminMode ? c.isAdminReply : (!c.isAdminReply && c.from.toLowerCase() === myName.toLowerCase());
        const senderLabel = c.isAdminReply ? `👑 Admin (${c.from})` : `👤 ${c.from}`;
        const safeText = c.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const tickLevel = getMessageTickStatus(c, state);
        const tickHTML = isMine ? (tickLevel === 3 ? `<span class="tick-3">✓✓✓</span>` : (tickLevel === 2 ? `<span class="tick-2">✓✓</span>` : `<span class="tick-1">✓</span>`)) : '';
        const actionsHTML = isMine ? `<span class="chat-actions"><span class="chat-action-btn" onclick="editChatMessage('${c.id}', '${safeText}')">✏️</span><span class="chat-action-btn" onclick="deleteChatMessage('${c.id}')">🗑️</span></span>` : '';

        return `
            <div class="chat-bubble ${isMine ? 'me' : 'other'}">
                <div class="chat-sender"><span>${senderLabel}</span>${actionsHTML}</div>
                <div>${c.text} ${c.edited ? '<span style="font-size:9px; opacity:0.75;">(edited)</span>' : ''}</div>
                <div class="chat-meta-row"><span>${c.time}</span>${tickHTML}</div>
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
    const targetMember = adminMode ? (document.getElementById('adminReplyTarget').value || 'Member') : 'ADMIN';
    const senderField = myName;
    const encodedPayload = adminMode ? `CHAT2|${msgId}|${myName}|${targetMember}|1|${text}` : `CHAT2|${msgId}|${myName}|ADMIN|0|${text}`;

    globalMessages.push({ date: new Date().toISOString(), name: senderField, message: encodedPayload });
    input.value = '';
    refreshChatAndNotificationsUI();
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(senderField)}&message=${encodeURIComponent(encodedPayload)}`); } catch (e) {}
}

async function sendAdminBroadcast() {
    const titleInput = document.getElementById('broadcastTitleInput');
    const bodyInput = document.getElementById('broadcastInput');
    const title = (titleInput.value || '').trim() || 'Community Notice';
    const text = (bodyInput.value || '').trim();
    if (!text) return;

    const myName = (localStorage.getItem('namaz_user') || 'ABBU SHAHMA').trim();
    const bId = 'b_' + Date.now();
    const encodedPayload = `BROADCAST2|${bId}|${myName}|ALL|${title}::${text}`;
    globalMessages.push({ date: new Date().toISOString(), name: myName, message: encodedPayload });
    titleInput.value = '';
    bodyInput.value = '';
    refreshChatAndNotificationsUI();
    try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(encodedPayload)}`); } catch (e) {}
}
