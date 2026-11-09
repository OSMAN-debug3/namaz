/* ================= CHAT, PERMANENT SEEN BADGE & WORKING CUT (×) NOTIFICATIONS MODULE ================= */

function getStableBroadcastId(rawId, from, title, body) {
    if (rawId && !rawId.startsWith('legacy_')) return rawId;
    const rawStr = `${from}_${title}_${body}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return 'bst_' + rawStr.slice(0, 36);
}

function getSeenNotifsSet() {
    const myName = (localStorage.getItem('namaz_user') || 'guest').trim().toLowerCase();
    const globalSeen = JSON.parse(localStorage.getItem('zs_seen_notifs_v3') || '[]');
    const userSeen = JSON.parse(localStorage.getItem(`zs_seen_notifs_${myName}`) || '[]');
    return new Set([...globalSeen, ...userSeen]);
}

function saveSeenNotifsSet(seenSet) {
    const myName = (localStorage.getItem('namaz_user') || 'guest').trim().toLowerCase();
    const arr = Array.from(seenSet);
    localStorage.setItem('zs_seen_notifs_v3', JSON.stringify(arr));
    localStorage.setItem(`zs_seen_notifs_${myName}`, JSON.stringify(arr));
}

function getDeletedNotifsSet() {
    const myName = (localStorage.getItem('namaz_user') || 'guest').trim().toLowerCase();
    const globalDel = JSON.parse(localStorage.getItem('zs_deleted_notifs_v3') || '[]');
    const userDel = JSON.parse(localStorage.getItem(`zs_deleted_notifs_${myName}`) || '[]');
    return new Set([...globalDel, ...userDel]);
}

function saveDeletedNotifsSet(delSet) {
    const myName = (localStorage.getItem('namaz_user') || 'guest').trim().toLowerCase();
    const arr = Array.from(delSet);
    localStorage.setItem('zs_deleted_notifs_v3', JSON.stringify(arr));
    localStorage.setItem(`zs_deleted_notifs_${myName}`, JSON.stringify(arr));
}

async function markAllCurrentBroadcastsSeen() {
    const state = buildMessageSystemState();
    const seenSet = getSeenNotifsSet();
    let changed = false;

    state.broadcasts.forEach(b => {
        if (!seenSet.has(b.id)) {
            seenSet.add(b.id);
            changed = true;
        }
    });

    if (changed) {
        saveSeenNotifsSet(seenSet);
        const myName = (localStorage.getItem('namaz_user') || '').trim();
        if (myName && state.broadcasts.length > 0) {
            const maxOrder = Math.max(...state.broadcasts.map(b => b.order));
            const payload = `NOTIF_SEEN|${myName.toLowerCase()}|${maxOrder}`;
            globalMessages.push({ date: new Date().toISOString(), name: myName, message: payload });
            try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent(myName)}&message=${encodeURIComponent(payload)}`); } catch (e) {}
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
        markAllCurrentBroadcastsSeen();
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
    const delSet = getDeletedNotifsSet();
    const seenSet = getSeenNotifsSet();

    state.broadcasts.forEach(b => {
        delSet.add(b.id);
        seenSet.add(b.id);
    });
    saveDeletedNotifsSet(delSet);
    saveSeenNotifsSet(seenSet);

    if (isUserAdmin()) {
        const payload = `CLEAR_BROADCASTS|${Date.now()}`;
        globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });
        try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`); } catch (e) {}
    }
    refreshChatAndNotificationsUI();
}

/* ✅ WORKING 1-CLICK CUT (×) BUTTON FOR SINGLE NOTIFICATION */
async function deleteSingleNotification(notifId, ev) {
    if (ev) ev.stopPropagation();

    const delSet = getDeletedNotifsSet();
    const seenSet = getSeenNotifsSet();
    delSet.add(notifId);
    seenSet.add(notifId);
    saveDeletedNotifsSet(delSet);
    saveSeenNotifsSet(seenSet);

    const payload = `DELETE|${notifId}`;
    globalMessages.push({ date: new Date().toISOString(), name: 'ABBU SHAHMA', message: payload });
    refreshChatAndNotificationsUI();

    if (isUserAdmin()) {
        try { await fetch(`${SCRIPT_URL}?action=sendMessage&name=${encodeURIComponent('ABBU SHAHMA')}&message=${encodeURIComponent(payload)}`); } catch (e) {}
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
            const orderNum = parseInt(parts[2] || '0', 10);
            if (viewer) {
                notifSeenOrderMap[viewer] = Math.max(notifSeenOrderMap[viewer] || -1, orderNum);
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
            const stableId = getStableBroadcastId(rawId, from, title, body);
            broadcastsMap.set(stableId, { id: stableId, type: 'BROADCAST', from, title, text: body, time, order: index });
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

    dynamicSubAdmins = subAdminSet;
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
        return DEFAULT_ADMINS.some(a => (Date.now() - (state.onlineMap[a] || 0)) < 10 * 60 * 1000);
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
        supremeBadge.innerText = isSupremeAdmin() ? '👑 SUPREME ADMIN: ABBU SHAHMA' : `👑 COMMUNITY ADMIN: ${myName.toUpperCase()}`;
    }
    document.getElementById('navAdminBtn').classList.toggle('hidden', !adminMode);

    const delSet = getDeletedNotifsSet();
    const seenSet = getSeenNotifsSet();
    const serverSeenOrder = state.notifSeenOrderMap[myLower] !== undefined ? state.notifSeenOrderMap[myLower] : -1;

    // 1. Filter out notifications the user has clicked Cut (×) or Clear All on
    const visibleBroadcasts = state.broadcasts.filter(b => !delSet.has(b.id));

    // 2. Unread count = visible broadcasts that are NOT in seenSet AND have order > serverSeenOrder
    const unreadBroadcasts = visibleBroadcasts.filter(b => !seenSet.has(b.id) && b.order > serverSeenOrder);

    if (loggedIn) {
        checkAndPopPhoneNotifications(visibleBroadcasts, state.chats);
    }

    const notifBox = document.getElementById('notifListBox');
    const badgeDot = document.getElementById('notifBadgeCount');
    const unreadCount = unreadBroadcasts.length;

    document.getElementById('notifPopupCountPill').innerText = visibleBroadcasts.length;

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
            const safeId = b.id.replace(/'/g, "\\'");
            return `
                <div class="notif-card-row">
                    <div class="notif-circle-icon notif-icon-gold">🔔</div>
                    <div class="notif-body-col">
                        <div class="notif-item-heading" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${b.title || 'Community Notice'}</span>
                            <button type="button" onclick="deleteSingleNotification('${safeId}', event)" title="Cut Message" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.45); border-radius:50%; width:22px; height:22px; font-size:14px; font-weight:900; line-height:1; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;">&times;</button>
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
        globalUsers.forEach(u => { if (!SUPREME_ADMINS.includes(u.name.toLowerCase())) memberNames.add(u.name); });
        state.chats.forEach(c => { if (!c.isAdminReply && !SUPREME_ADMINS.includes(c.from.toLowerCase())) memberNames.add(c.from); });
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
