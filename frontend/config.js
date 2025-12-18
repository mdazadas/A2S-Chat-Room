// ChatNow Room - Configuration
// Backend on Render

const CONFIG = {
    BACKEND_URL: 'https://a2s-chat-room.onrender.com'
};

// Always use Render backend
window.SOCKET_URL = CONFIG.BACKEND_URL;

console.log('🔌 Socket URL:', window.SOCKET_URL);
