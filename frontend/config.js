// ChatNow Room - Configuration
// Update BACKEND_URL after deploying backend to Render

const CONFIG = {
    // Replace with your Render backend URL after deployment
    // Example: 'https://chatnow-room-backend.onrender.com'
    BACKEND_URL: 'https://YOUR-RENDER-APP.onrender.com',

    // Keep this for local development
    LOCAL_URL: 'http://localhost:3001'
};

// Auto-detect environment
const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

// Export the socket URL
window.SOCKET_URL = isLocalhost ? CONFIG.LOCAL_URL : CONFIG.BACKEND_URL;

console.log('🔌 Socket URL:', window.SOCKET_URL);
