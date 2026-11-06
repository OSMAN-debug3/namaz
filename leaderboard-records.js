/* ================= LEADERBOARD, ANTI-CHEAT STREAK & MERI A'AMAL MODULE ================= */

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

function calculateSingleReportPoints(r) {
    if (!r) return 0;
    let pts = 0;
    ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        if (r[p] === 'Ada') pts += 1;
        else if (r[p] === 'Qaza') pts += 0.5;
    });
    if (r.tahajjud === 'Ada') pts += 1;
    if (r.duha === 'Ada') pts += 1;
    if (r.roza === 'Rakha') pts += 1;
    if (r.tarawih === 'Ada') pts += 1;
    if (r.quran && r.quran !== 'Nahi') pts += 1;
    return pts;
}

function getValidUniqueUserReports(userName) {
    const userObj = globalUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
    const joinDateStr = (userObj && userObj.createdAt && userObj.createdAt !== '-') ? cleanDateString(userObj.createdAt) : '';

    const byDateMap = new Map();
    globalReports.forEach(r => {
        if ((r.name || '').toLowerCase() !== userName.toLowerCase()) return;
        const rDate = cleanDateString(r.date);
        if (!rDate) return;
        if (joinDateStr && /^\d{4}-\d{2}-\d{2}$/.test(joinDateStr) && rDate < joinDateStr) return;
        byDateMap.set(rDate, r);
    });
    return Array.from(byDateMap.values());
}

function getUserStreakAndBadge(userName) {
    const userRecs = getValidUniqueUserReports(userName);
    if (userRecs.length === 0) return { streak: 0, badge: '' };

    userRecs.sort((a, b) => new Date(cleanDateString(b.date)) - new Date(cleanDateString(a.date)));

    let streak = 0;
    let prevDate = null;

    for (let i = 0; i < userRecs.length; i++) {
        const curDate = new Date(cleanDateString(userRecs[i].date));
        const adaCount = [userRecs[i].fajr, userRecs[i].zuhr, userRecs[i].asr, userRecs[i].maghrib, userRecs[i].isha].filter(x => x === 'Ada').length;
        if (adaCount !== 5) break;

        if (prevDate === null) {
            streak = 1;
            prevDate = curDate;
        } else {
            const diffDays = Math.round((prevDate - curDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                streak++;
                prevDate = curDate;
            } else {
                break;
            }
        }
    }

    let badge = '';
    if (streak >= 30) badge = '👑 Aashiq-e-Namaz (30+ Days)';
    else if (streak >= 7) badge = '⭐ 7-Day Streaker';
    else if (streak >= 3) badge = '✨ Consistent (3+ Days)';
    return { streak, badge };
}

function createDetailedRecordHTML(r) {
    const t = translations[currentLang];
    const cleanDate = cleanDateString(r.date);
    const timeBadge = (r.time && r.time !== '-') ? ` • 🕒 ${r.time}` : '';
    const reportPts = calculateSingleReportPoints(r);
    return `
        <div class="detailed-record-card">
            <div class="detailed-record-header">
                <span>📅 ${cleanDate} (${r.day || ''})${timeBadge}</span>
                <span style="color: var(--emerald-bright);">⭐ ${reportPts} Pts</span>
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

function renderCommunityLeaderboard() {
    const podiumContainer = document.getElementById('podiumContainer');
    const leaderboardList = document.getElementById('leaderboardList');
    if (!podiumContainer || !leaderboardList) return;
    const t = translations[currentLang];

    podiumContainer.innerHTML = '';
    leaderboardList.innerHTML = '';

    let userScores = globalUsers.map(u => {
        const validReports = getValidUniqueUserReports(u.name);
        let totalPoints = 0;
        validReports.forEach(rep => { totalPoints += calculateSingleReportPoints(rep); });
        const st = getUserStreakAndBadge(u.name);
        return { name: u.name, photo: u.photo, points: totalPoints, badge: st.badge };
    });

    userScores.sort((a, b) => b.points - a.points);

    if (userScores.length === 0) {
        leaderboardList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12.5px;">${t.emptyRecord}</div>`;
        return;
    }

    podiumContainer.style.cssText = 'display:flex; justify-content:center; align-items:flex-end; gap:12px; margin:20px auto;';
    const top3 = userScores.slice(0, 3);
    const podiumOrder = [];
    if (top3[1]) podiumOrder.push({ user: top3[1], rank: 2, badgeText: '🥈 2nd', order: 1 });
    if (top3[0]) podiumOrder.push({ user: top3[0], rank: 1, badgeText: '👑 1st', order: 2 });
    if (top3[2]) podiumOrder.push({ user: top3[2], rank: 3, badgeText: '🥉 3rd', order: 3 });

    podiumOrder.forEach(item => {
        const { user, rank, badgeText, order } = item;
        const isFirst = rank === 1;
        const card = document.createElement('div');
        card.className = `podium-card ${isFirst ? 'rank-1' : ''} zs-podium-${rank}`;
        card.style.cssText = `order:${order}; border-radius:8px; ${isFirst ? 'transform:translateY(-10px); border:2px solid #d4af37;' : 'border:1.5px solid rgba(212,175,55,0.45);'}`;
        card.onclick = () => openMemberProfile(user.name);
        card.innerHTML = `
            <div class="rank-badge">${badgeText}</div>
            <img src="${user.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" alt="img" style="width:72px !important; height:72px !important; border-radius:6px !important; aspect-ratio:1/1 !important; object-fit:cover !important;">
            <div class="name">${user.name}</div>
            <div class="score">⭐ ${user.points} Pts</div>
            ${user.badge ? `<div class="badge-chip">${user.badge}</div>` : ''}
        `;
        podiumContainer.appendChild(card);
    });

    userScores.slice(3).forEach((user, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.onclick = () => openMemberProfile(user.name);
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${user.photo || 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png'}" style="width:38px; height:38px; border-radius:6px; object-fit:cover; border:1px solid var(--gold);">
                <div>
                    <span style="font-weight:600; display:block;">${user.name}</span>
                    ${user.badge ? `<span style="font-size:9.5px; color:var(--gold-light);">${user.badge}</span>` : ''}
                </div>
            </div>
            <span style="color:var(--emerald-bright); font-weight:700;">⭐ ${user.points} Pts</span>
        `;
        leaderboardList.appendChild(item);
    });
}

function openMemberProfile(userName) {
    const t = translations[currentLang];
    const userObj = globalUsers.find(u => u.name.toLowerCase() === userName.toLowerCase());
    const userRecords = getValidUniqueUserReports(userName);
    const st = getUserStreakAndBadge(userName);
    const info = getMemberSerialAndInfo(userName);

    let totalNamazAda = 0, totalRoza = 0, totalPoints = 0;
    userRecords.forEach(r => {
        totalNamazAda += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
        if (r.roza === 'Rakha') totalRoza++;
        totalPoints += calculateSingleReportPoints(r);
    });

    document.getElementById('modalUserName').innerText = userName;
    const avatarEl = document.getElementById('modalUserAvatar');
    avatarEl.src = userObj ? userObj.photo : 'https://i.ibb.co/6Wv1V6Zm/default-avatar.png';
    avatarEl.style.borderRadius = '8px';
    document.getElementById('modalUserJoinDate').innerText = `📅 Joined: ${info.createdAt || '-'}`;
    document.getElementById('modalUserBadges').innerHTML = st.badge ? `<span class="badge-chip">${st.badge}</span>` : '';
    document.getElementById('modalUserPoints').innerText = `⭐ ${totalPoints} Pts | ${t.statsDays}: ${userRecords.length} | ${t.statsNamaz}: ${totalNamazAda} | ${t.statsRoza}: ${totalRoza}`;

    const histContainer = document.getElementById('modalUserHistory');
    histContainer.innerHTML = userRecords.length === 0
        ? `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">${t.emptyHistory}</div>`
        : userRecords.slice().reverse().map(r => createDetailedRecordHTML(r)).join('');

    document.getElementById('memberModal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('memberModal').classList.add('hidden');
}

function renderUserHistory() {
    const listContainer = document.getElementById('userHistoryList');
    const savedName = localStorage.getItem('namaz_user');
    if (!listContainer || !savedName) return;
    const t = translations[currentLang];

    const userRecords = getValidUniqueUserReports(savedName);
    const st = getUserStreakAndBadge(savedName);

    let totalFarzAda = 0, totalRoza = 0;
    userRecords.forEach(r => {
        totalFarzAda += [r.fajr, r.zuhr, r.asr, r.maghrib, r.isha].filter(x => x === 'Ada').length;
        if (r.roza === 'Rakha') totalRoza++;
    });
    const farzRate = userRecords.length > 0 ? Math.round((totalFarzAda / (userRecords.length * 5)) * 100) : 0;

    document.getElementById('myStatTotalDays').innerText = userRecords.length;
    document.getElementById('myStatFarzRate').innerText = `${farzRate}%`;
    document.getElementById('myStatTotalRoza').innerText = totalRoza;
    document.getElementById('myStatStreak').innerText = `${st.streak}🔥`;

    if (userRecords.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 16px;">${t.emptyHistory}</div>`;
        return;
    }

    const searchQ = (document.getElementById('myRecordSearchInput')?.value || '').trim().toLowerCase();
    const filtered = userRecords.filter(r => !searchQ || cleanDateString(r.date).toLowerCase().includes(searchQ) || (r.day || '').toLowerCase().includes(searchQ));
    listContainer.innerHTML = filtered.slice().reverse().map(r => createDetailedRecordHTML(r)).join('');
}

function exportMyReportCSV() {
    const savedName = localStorage.getItem('namaz_user');
    const userRecords = getValidUniqueUserReports(savedName);
    if (userRecords.length === 0) return alert(translations[currentLang].emptyHistory);

    let csvContent = "data:text/csv;charset=utf-8,Date,Day,Time,Name,Fajr,Zuhr,Asr,Maghrib,Isha,Tahajjud,Duha_Ishraq,Roza,Quran,Tarawih\n";
    userRecords.forEach(r => {
        csvContent += `${cleanDateString(r.date)},${r.day || ''},${r.time || '-'},${r.name},${r.fajr},${r.zuhr},${r.asr},${r.maghrib},${r.isha},${r.tahajjud || 'Nahi'},${r.duha || 'Nahi'},${r.roza},${r.quran},${r.tarawih}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${savedName}_Ibadat_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
