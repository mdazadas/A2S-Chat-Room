// Admin Dashboard - Clean Professional Version
// SOCKET_URL is set by config.js, fallback for local dev
const SOCKET_URL = window.SOCKET_URL || (
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `http://${window.location.hostname}:3001`
        : window.location.origin
);

// State
const adminState = {
    socket: null,
    authenticated: false,
    users: [],
    messages: [],
    reports: [],
    refreshInterval: null
};

// DOM Elements
const elements = {
    adminLogin: document.getElementById('adminLogin'),
    adminPassword: document.getElementById('adminPassword'),
    adminLoginBtn: document.getElementById('adminLoginBtn'),
    adminDashboard: document.getElementById('adminDashboard'),
    refreshStats: document.getElementById('refreshStats'),
    adminLogout: document.getElementById('adminLogout'),
    statOnlineUsers: document.getElementById('statOnlineUsers'),
    statTotalMessages: document.getElementById('statTotalMessages'),
    statTotalReports: document.getElementById('statTotalReports'),
    statServerStatus: document.getElementById('statServerStatus'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    adminMessagesList: document.getElementById('adminMessagesList'),
    adminUsersList: document.getElementById('adminUsersList'),
    adminUserCount: document.getElementById('adminUserCount'),
    adminReportsList: document.getElementById('adminReportsList'),
    clearAllChat: document.getElementById('clearAllChat'),
    kickUsername: document.getElementById('kickUsername'),
    kickUserBtn: document.getElementById('kickUserBtn'),
    muteUsername: document.getElementById('muteUsername'),
    muteDuration: document.getElementById('muteDuration'),
    muteUserBtn: document.getElementById('muteUserBtn'),
    banUsername: document.getElementById('banUsername'),
    banUserBtn: document.getElementById('banUserBtn'),
    exportChat: document.getElementById('exportChat'),
    searchMessages: document.getElementById('searchMessages'),
    clearAllReports: document.getElementById('clearAllReports'),
    toastContainer: document.getElementById('toastContainer'),
    themeToggle: document.getElementById('themeToggle'),
    liveIndicator: document.getElementById('liveIndicator')
};

// ==================== INIT ====================
function init() {
    initTheme();
    setupEventListeners();
    connectSocket();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupEventListeners() {
    // Theme
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Login
    elements.adminLoginBtn.addEventListener('click', adminLogin);
    elements.adminPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') adminLogin();
    });

    // Logout & Refresh
    elements.adminLogout.addEventListener('click', adminLogout);
    elements.refreshStats.addEventListener('click', () => {
        refreshAllData();
        showToast('🔄 Refreshing...', 'info');
    });

    // Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Main Actions
    if (elements.clearAllChat) elements.clearAllChat.addEventListener('click', clearAllChat);
    if (elements.kickUserBtn) elements.kickUserBtn.addEventListener('click', kickUser);
    if (elements.muteUserBtn) elements.muteUserBtn.addEventListener('click', muteUser);
    if (elements.banUserBtn) elements.banUserBtn.addEventListener('click', banUser);
    if (elements.exportChat) elements.exportChat.addEventListener('click', exportChat);
    if (elements.searchMessages) elements.searchMessages.addEventListener('input', searchMessages);
    if (elements.clearAllReports) elements.clearAllReports.addEventListener('click', clearAllReports);

    // Broadcast
    const broadcastBtn = document.getElementById('broadcastBtn');
    if (broadcastBtn) broadcastBtn.addEventListener('click', sendBroadcast);
}

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// ==================== SOCKET ====================
function connectSocket() {
    adminState.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true
    });

    adminState.socket.on('connect', () => {
        console.log('✅ Admin connected');
        updateStatus(true);
    });

    adminState.socket.on('disconnect', () => {
        console.log('❌ Admin disconnected');
        updateStatus(false);
    });

    adminState.socket.on('reconnect', () => {
        console.log('🔄 Admin reconnected');
        updateStatus(true);
        if (adminState.authenticated) refreshAllData();
    });

    // Auth
    adminState.socket.on('admin_authenticated', handleAuth);

    // Data
    adminState.socket.on('admin_stats', handleStats);
    adminState.socket.on('admin_messages', handleMessages);
    adminState.socket.on('admin_reports', handleReports);

    // Real-time
    adminState.socket.on('user_joined', handleUserUpdate);
    adminState.socket.on('user_left', handleUserUpdate);
    adminState.socket.on('new_message', handleNewMessage);
    adminState.socket.on('new_report', handleNewReport);
    adminState.socket.on('message_deleted', handleMessageDeleted);
    adminState.socket.on('chat_cleared', handleChatCleared);
}

function updateStatus(online) {
    if (elements.statServerStatus) {
        elements.statServerStatus.textContent = online ? 'Online' : 'Offline';
        elements.statServerStatus.style.color = online ? 'var(--success)' : 'var(--danger)';
    }
    if (elements.liveIndicator) {
        elements.liveIndicator.style.background = online ? 'var(--success)' : 'var(--danger)';
    }
}

// ==================== AUTH ====================
function adminLogin() {
    const password = elements.adminPassword.value;
    if (!password) {
        showToast('Enter password', 'error');
        return;
    }
    elements.adminLoginBtn.disabled = true;
    elements.adminLoginBtn.textContent = 'Connecting...';
    adminState.socket.emit('admin_login', { password });
}

function handleAuth(data) {
    elements.adminLoginBtn.disabled = false;
    elements.adminLoginBtn.innerHTML = '<span>Access Dashboard</span>';

    if (data.success) {
        adminState.authenticated = true;
        elements.adminLogin.classList.add('hidden');
        elements.adminDashboard.classList.remove('hidden');
        refreshAllData();

        // Auto-refresh every 30s
        adminState.refreshInterval = setInterval(() => {
            if (adminState.authenticated) {
                adminState.socket.emit('admin_get_stats');
            }
        }, 30000);

        showToast('Welcome Admin! 🛡️', 'success');
    } else {
        showToast(data.message || 'Invalid password', 'error');
    }
}

function adminLogout() {
    adminState.authenticated = false;
    if (adminState.refreshInterval) clearInterval(adminState.refreshInterval);
    elements.adminDashboard.classList.add('hidden');
    elements.adminLogin.classList.remove('hidden');
    elements.adminPassword.value = '';
    showToast('Logged out', 'info');
}

// ==================== DATA ====================
function refreshAllData() {
    adminState.socket.emit('admin_get_stats');
    adminState.socket.emit('admin_get_messages');
    adminState.socket.emit('admin_get_reports');
}

function handleStats(data) {
    animateNum(elements.statOnlineUsers, data.onlineUsers);
    animateNum(elements.statTotalMessages, data.totalMessages);
    animateNum(elements.statTotalReports, data.totalReports);
    if (elements.adminUserCount) elements.adminUserCount.textContent = data.onlineUsers;
    adminState.users = data.users || [];
    renderUsers();
}

function handleMessages(messages) {
    adminState.messages = messages || [];
    renderMessages();
}

function handleReports(reports) {
    adminState.reports = reports || [];
    renderReports();
}

function animateNum(el, val) {
    if (!el) return;
    const old = parseInt(el.textContent) || 0;
    if (old !== val) {
        el.textContent = val;
        el.style.transform = 'scale(1.2)';
        setTimeout(() => el.style.transform = 'scale(1)', 200);
    }
}

// ==================== REAL-TIME ====================
function handleUserUpdate(data) {
    animateNum(elements.statOnlineUsers, data.onlineCount);
    if (elements.adminUserCount) elements.adminUserCount.textContent = data.onlineCount;
    adminState.users = data.users || [];
    renderUsers();
    flashTab('users');
}

function handleNewMessage(data) {
    adminState.messages.push(data);
    renderMessages();
    const count = parseInt(elements.statTotalMessages?.textContent) || 0;
    animateNum(elements.statTotalMessages, count + 1);
    flashTab('messages');
}

function handleNewReport(data) {
    adminState.reports.unshift(data);
    renderReports();
    const count = parseInt(elements.statTotalReports?.textContent) || 0;
    animateNum(elements.statTotalReports, count + 1);
    flashTab('reports');
    showToast('⚠️ New report!', 'warning');
}

function handleMessageDeleted(data) {
    console.log('Message deleted:', data.messageId);
    adminState.messages = adminState.messages.filter(m => m.id !== data.messageId);
    const el = document.querySelector(`.admin-message[data-id="${data.messageId}"]`);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-20px)';
        setTimeout(() => renderMessages(), 300);
    } else {
        renderMessages();
    }
    const count = parseInt(elements.statTotalMessages?.textContent) || 0;
    if (count > 0) animateNum(elements.statTotalMessages, count - 1);
}

function handleChatCleared() {
    console.log('Chat cleared');
    adminState.messages = [];
    renderMessages();
    animateNum(elements.statTotalMessages, 0);
    showToast('🗑️ Chat cleared!', 'info');
}

function flashTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn && !btn.classList.contains('active')) {
        btn.classList.add('flash');
        setTimeout(() => btn.classList.remove('flash'), 1000);
    }
}

// ==================== RENDER ====================
function renderMessages() {
    if (!elements.adminMessagesList) return;

    if (adminState.messages.length === 0) {
        elements.adminMessagesList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">💬</span>
                <p>No messages yet</p>
            </div>`;
        return;
    }

    const sorted = [...adminState.messages].reverse().slice(0, 100);
    elements.adminMessagesList.innerHTML = sorted.map(msg => `
        <div class="admin-message" data-id="${msg.id}" style="transition: all 0.3s ease;">
            <div class="msg-avatar">${(msg.username || 'U').charAt(0).toUpperCase()}</div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="msg-username">${escapeHtml(msg.username)}</span>
                    <span class="msg-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="msg-text">${escapeHtml(msg.message)}</div>
            </div>
            <button class="delete-msg-btn" onclick="deleteMessage('${msg.id}')">🗑️</button>
        </div>
    `).join('');
}

function renderUsers() {
    if (!elements.adminUsersList) return;

    if (adminState.users.length === 0) {
        elements.adminUsersList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">👥</span>
                <p>No users online</p>
            </div>`;
        return;
    }

    elements.adminUsersList.innerHTML = adminState.users.map(user => `
        <div class="admin-user-card">
            <div class="user-avatar">${(user.username || 'U').charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.username)}</div>
                <div class="user-status">🟢 Online • ${formatTime(user.joinedAt)}</div>
            </div>
            <div class="user-actions">
                <button class="quick-btn kick" onclick="quickKick('${escapeHtml(user.username)}')" title="Kick">👢</button>
                <button class="quick-btn mute" onclick="quickMute('${escapeHtml(user.username)}')" title="Mute">🔇</button>
            </div>
        </div>
    `).join('');
}

function renderReports() {
    if (!elements.adminReportsList) return;

    if (adminState.reports.length === 0) {
        elements.adminReportsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">✅</span>
                <p>No pending reports</p>
            </div>`;
        return;
    }

    elements.adminReportsList.innerHTML = adminState.reports.map(r => `
        <div class="report-card" data-id="${r.id}">
            <div class="report-header">
                <span class="report-reason-tag">📌 ${escapeHtml(r.reason || 'Report')}</span>
                <span class="report-time">${formatTime(r.time)}</span>
            </div>
            <div class="report-details">
                <div class="report-message-box">
                    <div class="report-label">📝 Message:</div>
                    <div class="report-message-content">"${escapeHtml(r.message_content || 'N/A')}"</div>
                    <div class="report-author">— ${escapeHtml(r.message_author || 'Unknown')}</div>
                </div>
                <div class="report-by">🚨 By: <strong>${escapeHtml(r.reported_by || 'Unknown')}</strong></div>
            </div>
            <div class="report-actions">
                <button class="dismiss-btn" onclick="dismissReport('${r.id}')">✓ Dismiss</button>
                <button class="action-report-btn" onclick="kickReportedUser('${escapeHtml(r.message_author)}')">👢 Kick</button>
                <button class="action-report-btn danger" onclick="deleteReportedMsg('${r.message_id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// ==================== TABS ====================
function switchTab(tabId) {
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
        btn.classList.remove('flash');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`${tabId}Tab`);
    if (panel) panel.classList.add('active');
}

// ==================== ACTIONS ====================
window.deleteMessage = function (id) {
    if (!id) return showToast('Invalid ID', 'error');
    if (confirm('🗑️ Delete this message?')) {
        adminState.socket.emit('admin_delete_message', { messageId: id });
        showToast('Deleting...', 'info');
    }
};

function clearAllChat() {
    if (adminState.messages.length === 0) return showToast('No messages', 'info');
    if (confirm('⚠️ Clear ALL messages?\n\nThis cannot be undone!')) {
        if (confirm('🚨 FINAL: Are you sure?')) {
            adminState.socket.emit('admin_clear_chat');
            showToast('Clearing...', 'info');
        }
    }
}

function kickUser() {
    const username = elements.kickUsername?.value.trim();
    if (!username) return showToast('Enter username', 'error');
    if (confirm(`Kick ${username}?`)) {
        adminState.socket.emit('admin_kick_user', { username });
        elements.kickUsername.value = '';
        showToast(`👢 ${username} kicked!`, 'warning');
    }
}

window.quickKick = function (username) {
    if (confirm(`Kick ${username}?`)) {
        adminState.socket.emit('admin_kick_user', { username });
        showToast(`👢 ${username} kicked!`, 'warning');
    }
};

function muteUser() {
    const username = elements.muteUsername?.value.trim();
    const duration = parseInt(elements.muteDuration?.value) || 60;
    if (!username) return showToast('Enter username', 'error');
    adminState.socket.emit('admin_mute_user', { username, duration });
    elements.muteUsername.value = '';
    showToast(`🔇 ${username} muted for ${duration}s`, 'warning');
}

window.quickMute = function (username) {
    adminState.socket.emit('admin_mute_user', { username, duration: 60 });
    showToast(`🔇 ${username} muted 60s`, 'warning');
};

function banUser() {
    const username = elements.banUsername?.value.trim();
    if (!username) return showToast('Enter username', 'error');
    const user = adminState.users.find(u => u.username === username);
    if (!user) return showToast('User not found', 'error');
    if (confirm(`🚫 BAN ${username}?\n\nThis bans their IP!`)) {
        adminState.socket.emit('admin_ban_ip', { socketId: user.socketId });
        elements.banUsername.value = '';
        showToast(`🚫 ${username} banned!`, 'warning');
    }
}

window.dismissReport = function (id) {
    if (confirm('Dismiss report?')) {
        adminState.reports = adminState.reports.filter(r => r.id !== id);
        renderReports();
        showToast('Report dismissed', 'info');
    }
};

window.kickReportedUser = function (username) {
    if (!username || username === 'Unknown') return showToast('Unknown user', 'error');
    if (confirm(`Kick ${username}?`)) {
        adminState.socket.emit('admin_kick_user', { username });
        showToast(`👢 ${username} kicked!`, 'warning');
    }
};

window.deleteReportedMsg = function (id) {
    if (!id) return showToast('No message ID', 'error');
    if (confirm('Delete message?')) {
        adminState.socket.emit('admin_delete_message', { messageId: id });
        showToast('Deleting...', 'info');
    }
};

function exportChat() {
    if (adminState.messages.length === 0) return showToast('No messages', 'error');
    const lines = adminState.messages.map(m => `[${formatTime(m.timestamp)}] ${m.username}: ${m.message}`);
    const content = `ChatNow Room Export\n${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n${lines.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat-${Date.now()}.txt`;
    a.click();
    showToast('📥 Exported!', 'success');
}

function searchMessages() {
    const q = elements.searchMessages?.value.toLowerCase().trim() || '';
    document.querySelectorAll('.admin-message').forEach(el => {
        const text = (el.querySelector('.msg-text')?.textContent || '').toLowerCase();
        const user = (el.querySelector('.msg-username')?.textContent || '').toLowerCase();
        el.style.display = (q === '' || text.includes(q) || user.includes(q)) ? 'flex' : 'none';
    });
}

function clearAllReports() {
    if (adminState.reports.length === 0) return showToast('No reports', 'info');
    if (confirm(`Clear ${adminState.reports.length} reports?`)) {
        adminState.reports = [];
        renderReports();
        animateNum(elements.statTotalReports, 0);
        showToast('Reports cleared!', 'success');
    }
}

// ==================== UTILS ====================
function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    elements.toastContainer?.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Broadcast message to all users
function sendBroadcast() {
    const input = document.getElementById('broadcastMsg');
    const message = input?.value.trim();
    if (!message) return showToast('Enter message', 'error');

    if (confirm(`📢 Send this to ALL users?\n\n"${message}"`)) {
        adminState.socket.emit('admin_broadcast', { message });
        input.value = '';
        showToast('📢 Broadcast sent!', 'success');
    }
}

document.addEventListener('DOMContentLoaded', init);
