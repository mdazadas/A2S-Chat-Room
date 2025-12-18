// ChatNow Room - Professional Mobile-First Chat App
// SOCKET_URL is set by config.js, fallback for local dev
const SOCKET_URL = window.SOCKET_URL || (
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `http://${window.location.hostname}:3001`
        : window.location.origin
);

// App State
const state = {
    socket: null,
    username: null,
    connected: false,
    users: [],
    blockedUsers: JSON.parse(localStorage.getItem('blockedUsers') || '[]'),
    reportingMessageId: null,
    soundEnabled: JSON.parse(localStorage.getItem('soundEnabled') ?? 'true'),
    notifyEnabled: JSON.parse(localStorage.getItem('notifyEnabled') ?? 'true'),
    messageCount: 0
};

// DOM Elements
const elements = {
    entryScreen: document.getElementById('entryScreen'),
    usernameInput: document.getElementById('usernameInput'),
    joinBtn: document.getElementById('joinBtn'),
    previewOnlineCount: document.getElementById('previewOnlineCount'),
    chatScreen: document.getElementById('chatScreen'),
    messagesArea: document.getElementById('messagesArea'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    onlineCount: document.getElementById('onlineCount'),
    sidebarOnlineCount: document.getElementById('sidebarOnlineCount'),
    usersList: document.getElementById('usersList'),
    typingIndicator: document.getElementById('typingIndicator'),
    toggleUsersBtn: document.getElementById('toggleUsersBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    emojiBtn: document.getElementById('emojiBtn'),
    closeSidebar: document.getElementById('closeSidebar'),
    usersSidebar: document.getElementById('usersSidebar'),
    emojiPicker: document.getElementById('emojiPicker'),
    settingsModal: document.getElementById('settingsModal'),
    reportModal: document.getElementById('reportModal'),
    closeSettings: document.getElementById('closeSettings'),
    closeReport: document.getElementById('closeReport'),
    settingsUsername: document.getElementById('settingsUsername'),
    settingsAvatar: document.getElementById('settingsAvatar'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    blockedUsersList: document.getElementById('blockedUsersList'),
    submitReportBtn: document.getElementById('submitReportBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    toastContainer: document.getElementById('toastContainer'),
    themeToggle: document.getElementById('themeToggle'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    soundToggle: document.getElementById('soundToggle'),
    notifyToggle: document.getElementById('notifyToggle'),
    darkModeToggle: document.getElementById('darkModeToggle')
};

// ==================== INITIALIZATION ====================
function init() {
    initTheme();
    initSettings();
    setupEventListeners();
    connectSocket();
    requestNotificationPermission();
    setupMobileKeyboard();
}

// Handle mobile keyboard resize
function setupMobileKeyboard() {
    // Use visualViewport API for better keyboard handling
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            // Scroll to bottom when keyboard opens
            if (elements.messagesContainer) {
                requestAnimationFrame(() => {
                    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
                });
            }
        });
    }

    // Focus input scroll fix
    if (elements.messageInput) {
        elements.messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                elements.messagesContainer?.scrollTo({
                    top: elements.messagesContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }, 300);
        });
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Update dark mode toggle
    if (elements.darkModeToggle) {
        elements.darkModeToggle.checked = savedTheme === 'dark';
    }
}

function initSettings() {
    // Load saved settings
    if (elements.soundToggle) {
        elements.soundToggle.checked = state.soundEnabled;
    }
    if (elements.notifyToggle) {
        elements.notifyToggle.checked = state.notifyEnabled;
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function setupEventListeners() {
    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Username input
    elements.usernameInput.addEventListener('input', () => {
        elements.joinBtn.disabled = elements.usernameInput.value.trim().length === 0;
    });

    elements.usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !elements.joinBtn.disabled) {
            joinChat();
        }
    });

    elements.joinBtn.addEventListener('click', joinChat);

    // Message input
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    elements.messageInput.addEventListener('input', handleTyping);
    elements.sendBtn.addEventListener('click', sendMessage);

    // Toggle buttons
    elements.toggleUsersBtn.addEventListener('click', toggleSidebar);
    elements.closeSidebar.addEventListener('click', closeSidebar);
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    elements.settingsBtn.addEventListener('click', () => openModal(elements.settingsModal));
    elements.closeSettings.addEventListener('click', () => closeModal(elements.settingsModal));
    elements.closeReport.addEventListener('click', () => closeModal(elements.reportModal));

    // Emoji picker
    elements.emojiBtn.addEventListener('click', () => {
        elements.emojiPicker.classList.toggle('hidden');
    });

    document.querySelectorAll('.emoji-item').forEach(emoji => {
        emoji.addEventListener('click', () => {
            elements.messageInput.value += emoji.textContent;
            elements.messageInput.focus();
            elements.emojiPicker.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!elements.emojiPicker.contains(e.target) && e.target !== elements.emojiBtn) {
            elements.emojiPicker.classList.add('hidden');
        }
    });

    // Settings actions
    elements.clearChatBtn.addEventListener('click', clearLocalChat);
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);
    elements.submitReportBtn.addEventListener('click', submitReport);

    // Settings toggles
    if (elements.soundToggle) {
        elements.soundToggle.addEventListener('change', () => {
            state.soundEnabled = elements.soundToggle.checked;
            localStorage.setItem('soundEnabled', state.soundEnabled);
            showToast(state.soundEnabled ? '🔊 Sound on' : '🔇 Sound off', 'info');
        });
    }

    if (elements.notifyToggle) {
        elements.notifyToggle.addEventListener('change', () => {
            state.notifyEnabled = elements.notifyToggle.checked;
            localStorage.setItem('notifyEnabled', state.notifyEnabled);
            if (state.notifyEnabled && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            showToast(state.notifyEnabled ? '🔔 Notifications on' : '🔕 Notifications off', 'info');
        });
    }

    if (elements.darkModeToggle) {
        elements.darkModeToggle.addEventListener('change', () => {
            const theme = elements.darkModeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    // Modal overlay close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
        });
    });

    // Focus management
    window.addEventListener('focus', () => {
        state.messageCount = 0;
        document.title = 'ChatNow Room';
    });
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

function toggleSidebar() {
    const isHidden = elements.usersSidebar.classList.contains('hidden');
    if (isHidden) {
        elements.usersSidebar.classList.remove('hidden');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.add('active');
        }
    } else {
        closeSidebar();
    }
}

function closeSidebar() {
    elements.usersSidebar.classList.add('hidden');
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.remove('active');
    }
}

// ==================== SOCKET CONNECTION ====================
function connectSocket() {
    state.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity
    });

    state.socket.on('connect', () => {
        console.log('Connected to server');
        state.connected = true;
        elements.connectionStatus.classList.add('hidden');
    });

    state.socket.on('disconnect', () => {
        state.connected = false;
        elements.connectionStatus.classList.remove('hidden');
    });

    state.socket.on('connect_error', () => {
        elements.connectionStatus.classList.remove('hidden');
    });

    state.socket.on('reconnect', () => {
        showToast('Reconnected! ✅', 'success');
    });

    state.socket.on('joined', handleJoined);
    state.socket.on('recent_messages', handleRecentMessages);
    state.socket.on('new_message', handleNewMessage);
    state.socket.on('user_joined', handleUserJoined);
    state.socket.on('user_left', handleUserLeft);
    state.socket.on('user_typing', handleUserTyping);
    state.socket.on('message_deleted', handleMessageDeleted);
    state.socket.on('chat_cleared', handleChatCleared);
    state.socket.on('report_submitted', handleReportSubmitted);
    state.socket.on('error', handleError);
    state.socket.on('kicked', handleKicked);
    state.socket.on('muted', handleMuted);
    state.socket.on('unmuted', handleUnmuted);
    state.socket.on('banned', handleBanned);
    state.socket.on('system_message', handleSystemMessage);
}

// Handle admin broadcast
function handleSystemMessage(data) {
    addSystemMessage(data.message);
    showToast(data.message, 'warning');
    if (state.soundEnabled) playSound('notification');
}

// ==================== CHAT FUNCTIONS ====================
function joinChat() {
    const username = elements.usernameInput.value.trim();
    if (!username) return;

    elements.joinBtn.disabled = true;
    elements.joinBtn.innerHTML = '<span>Joining...</span>';

    state.socket.emit('join', { username });
}

function handleJoined(data) {
    state.username = data.username;
    elements.entryScreen.classList.add('hidden');
    elements.chatScreen.classList.remove('hidden');
    elements.settingsUsername.textContent = data.username;
    elements.settingsAvatar.textContent = data.username.charAt(0).toUpperCase();
    elements.messageInput.focus();

    elements.joinBtn.disabled = false;
    elements.joinBtn.innerHTML = '<span>Join Chat Room</span>';

    showToast(`Welcome, ${data.username}! 🎉`, 'success');
    playSound('join');
}

function handleRecentMessages(messages) {
    messages.forEach(msg => {
        if (!state.blockedUsers.includes(msg.username)) {
            appendMessage(msg, false);
        }
    });
    scrollToBottom();
}

function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;

    state.socket.emit('message', { message });
    elements.messageInput.value = '';
    state.socket.emit('typing', { isTyping: false });
}

function handleNewMessage(data) {
    if (state.blockedUsers.includes(data.username)) return;

    appendMessage(data, true);
    scrollToBottom();

    // Notifications for other users' messages
    if (data.username !== state.username) {
        playSound('message');

        // Browser notification
        if (document.hidden && state.notifyEnabled && Notification.permission === 'granted') {
            new Notification('ChatNow Room', {
                body: `${data.username}: ${data.message.substring(0, 50)}`,
                icon: '💬'
            });
        }

        // Update title
        if (document.hidden) {
            state.messageCount++;
            document.title = `(${state.messageCount}) ChatNow Room`;
        }
    }
}

function appendMessage(data, animate = true) {
    const isOwn = data.username === state.username;
    const time = formatTime(data.timestamp);

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isOwn ? 'own' : ''}`;
    messageEl.dataset.id = data.id;

    messageEl.innerHTML = `
        <div class="msg-avatar">${data.username.charAt(0).toUpperCase()}</div>
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-username">${escapeHtml(data.username)}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-text">${formatMessage(data.message)}</div>
            ${isOwn ? '<div class="msg-status">✓✓</div>' : ''}
        </div>
        ${!isOwn ? `
        <div class="msg-actions">
            <button class="action-btn" onclick="reportMessage('${data.id}')" title="Report">⚠️</button>
        </div>
        ` : ''}
    `;

    if (!animate) messageEl.style.animation = 'none';
    elements.messagesArea.appendChild(messageEl);
}

function formatMessage(text) {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = escapeHtml(text).replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return text;
}

function addSystemMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message system ${type}`;
    messageEl.innerHTML = `<span>${text}</span>`;
    elements.messagesArea.appendChild(messageEl);
    scrollToBottom();
}

// ==================== USER EVENTS ====================
function handleUserJoined(data) {
    updateOnlineCount(data.onlineCount);
    updateUsersList(data.users);
    addSystemMessage(`👋 ${data.username} joined the room`, 'join');
    playSound('join');
}

function handleUserLeft(data) {
    updateOnlineCount(data.onlineCount);
    updateUsersList(data.users);
    addSystemMessage(`👋 ${data.username} left the room`, 'leave');
}

function updateOnlineCount(count) {
    elements.onlineCount.textContent = count;
    elements.sidebarOnlineCount.textContent = count;
    elements.previewOnlineCount.textContent = count;
}

function updateUsersList(users) {
    state.users = users;
    elements.usersList.innerHTML = '';

    users.forEach(user => {
        const isYou = user.username === state.username;
        const isBlocked = state.blockedUsers.includes(user.username);

        const userEl = document.createElement('li');
        userEl.className = `user-item ${isYou ? 'you' : ''}`;
        userEl.innerHTML = `
            <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="name">${escapeHtml(user.username)}${isBlocked ? ' 🚫' : ''}</div>
                <div class="status">🟢 Online</div>
            </div>
            ${!isYou ? `
            <button class="user-action-btn" onclick="blockUser('${escapeHtml(user.username)}')" title="Block">
                ${isBlocked ? '🔓' : '🚫'}
            </button>
            ` : ''}
        `;
        elements.usersList.appendChild(userEl);
    });
}

// ==================== TYPING ====================
let typingTimeout;
function handleTyping() {
    state.socket.emit('typing', { isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        state.socket.emit('typing', { isTyping: false });
    }, 2000);
}

function handleUserTyping(data) {
    if (data.username === state.username) return;
    if (data.isTyping) {
        elements.typingIndicator.classList.remove('hidden');
        elements.typingIndicator.querySelector('.typing-text').textContent = `${data.username} is typing...`;
    } else {
        elements.typingIndicator.classList.add('hidden');
    }
}

// ==================== CONTROLS ====================
function clearLocalChat() {
    elements.messagesArea.innerHTML = '';
    closeModal(elements.settingsModal);
    showToast('Chat cleared', 'info');
}

function leaveRoom() {
    if (confirm('Leave the chat room?')) {
        state.socket.disconnect();
        elements.chatScreen.classList.add('hidden');
        elements.entryScreen.classList.remove('hidden');
        elements.usernameInput.value = '';
        elements.messagesArea.innerHTML = '';
        closeModal(elements.settingsModal);
        showToast('You left the room', 'info');
        setTimeout(() => state.socket.connect(), 500);
    }
}

// ==================== BLOCK/REPORT ====================
window.blockUser = function (username) {
    if (state.blockedUsers.includes(username)) {
        // Unblock
        state.blockedUsers = state.blockedUsers.filter(u => u !== username);
        showToast(`${username} unblocked`, 'success');
    } else {
        // Block
        state.blockedUsers.push(username);
        showToast(`${username} blocked`, 'warning');

        // Remove their messages
        document.querySelectorAll('.message').forEach(msg => {
            const usernameEl = msg.querySelector('.msg-username');
            if (usernameEl && usernameEl.textContent === username) msg.remove();
        });
    }

    localStorage.setItem('blockedUsers', JSON.stringify(state.blockedUsers));
    updateBlockedUsersList();
    updateUsersList(state.users);
};

function updateBlockedUsersList() {
    if (state.blockedUsers.length === 0) {
        elements.blockedUsersList.innerHTML = '<li class="no-blocked">No blocked users</li>';
    } else {
        elements.blockedUsersList.innerHTML = state.blockedUsers.map(username => `
            <li>
                <span>🚫 ${escapeHtml(username)}</span>
                <button class="unblock-btn" onclick="blockUser('${escapeHtml(username)}')">Unblock</button>
            </li>
        `).join('');
    }
}

window.reportMessage = function (messageId) {
    state.reportingMessageId = messageId;
    openModal(elements.reportModal);
};

function submitReport() {
    const reason = document.querySelector('input[name="reportReason"]:checked');
    if (!reason) {
        showToast('Select a reason', 'error');
        return;
    }
    state.socket.emit('report_message', { messageId: state.reportingMessageId, reason: reason.value });
    closeModal(elements.reportModal);
    state.reportingMessageId = null;
    document.querySelectorAll('input[name="reportReason"]').forEach(r => r.checked = false);
    showToast('Report submitted. Thank you! 🙏', 'success');
}

function handleReportSubmitted(data) {
    // Already shown toast
}

// ==================== MODERATION EVENTS ====================
function handleMessageDeleted(data) {
    const messageEl = document.querySelector(`.message[data-id="${data.messageId}"]`);
    if (messageEl) {
        messageEl.style.animation = 'fadeOut 0.3s';
        setTimeout(() => messageEl.remove(), 300);
    }
}

function handleChatCleared() {
    elements.messagesArea.innerHTML = '';
    addSystemMessage('🗑️ Chat cleared by admin');
}

function handleError(data) {
    showToast(data.message, 'error');
    playSound('error');
}

function handleKicked(data) {
    showToast(data.message || 'You have been kicked!', 'error');
    playSound('error');
    elements.chatScreen.classList.add('hidden');
    elements.entryScreen.classList.remove('hidden');
}

function handleMuted(data) {
    showToast(`🔇 Muted${data.duration ? ` for ${data.duration}s` : ''}`, 'warning');
}

function handleUnmuted() {
    showToast('🔊 You can speak again!', 'success');
}

function handleBanned(data) {
    showToast(data.message || 'You have been banned!', 'error');
    elements.chatScreen.classList.add('hidden');
    elements.entryScreen.classList.remove('hidden');
}

// ==================== UTILITIES ====================
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;

    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    });
}

function openModal(modal) {
    modal.classList.remove('hidden');
    updateBlockedUsersList();
}

function closeModal(modal) {
    modal.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function playSound(type) {
    if (!state.soundEnabled) return;

    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const sounds = {
            message: { freq: 800, dur: 0.1 },
            join: { freq: 600, dur: 0.15 },
            error: { freq: 300, dur: 0.2 },
            success: { freq: 1000, dur: 0.1 }
        };

        const sound = sounds[type] || sounds.message;
        osc.frequency.value = sound.freq;
        gain.gain.value = 0.08;
        osc.start();
        osc.stop(ctx.currentTime + sound.dur);
    } catch (e) { }
}

// Add CSS animation for fadeOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        to { opacity: 0; transform: scale(0.8); }
    }
    .msg-status {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.6);
        text-align: right;
        margin-top: 2px;
    }
    .user-action-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--bg-tertiary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
    }
    .message.system.join { color: var(--success); }
    .message.system.leave { color: var(--text-muted); }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
