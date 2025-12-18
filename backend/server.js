const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const xss = require('xss');
const Filter = require('bad-words');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'https://chatnow-room.netlify.app', // Update this with your Netlify URL
    process.env.FRONTEND_URL
].filter(Boolean);

// Initialize Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware
app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    credentials: true
}));
app.use(express.json());

// Serve static files from frontend folder (for local dev)
app.use(express.static(path.join(__dirname, '../frontend')));

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Bad words filter
const filter = new Filter();

// Custom bad words list (add more as needed)
const customBadWords = ['badword1', 'badword2'];
filter.addWords(...customBadWords);

// Rate limiting map
const messageRateLimit = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX = 5; // Max 5 messages per second

// Online users tracking
const onlineUsers = new Map();
const mutedUsers = new Set();
const bannedIPs = new Set();

// Room ID (single public room)
const PUBLIC_ROOM = 'public-room';

// ==================== HELPER FUNCTIONS ====================

function sanitizeMessage(message) {
    // XSS sanitization
    let sanitized = xss(message);
    // Trim and limit length
    sanitized = sanitized.trim().substring(0, 500);
    return sanitized;
}

function filterBadWords(message) {
    try {
        return filter.clean(message);
    } catch (e) {
        return message;
    }
}

function checkRateLimit(socketId) {
    const now = Date.now();
    const userRateData = messageRateLimit.get(socketId) || { count: 0, timestamp: now };

    if (now - userRateData.timestamp > RATE_LIMIT_WINDOW) {
        // Reset window
        messageRateLimit.set(socketId, { count: 1, timestamp: now });
        return true;
    }

    if (userRateData.count >= RATE_LIMIT_MAX) {
        return false; // Rate limited
    }

    userRateData.count++;
    messageRateLimit.set(socketId, userRateData);
    return true;
}

function getOnlineUsersList() {
    return Array.from(onlineUsers.values()).map(user => ({
        username: user.username,
        joinedAt: user.joinedAt
    }));
}

// ==================== DATABASE FUNCTIONS ====================

async function saveUserToDb(username, socketId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert({
                username,
                socket_id: socketId,
                joined_at: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        console.error('Error saving user:', err);
        return null;
    }
}

async function removeUserFromDb(socketId) {
    try {
        await supabase
            .from('users')
            .delete()
            .eq('socket_id', socketId);
    } catch (err) {
        console.error('Error removing user:', err);
    }
}

async function saveMessageToDb(username, message, roomId) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert({
                username,
                message,
                room_id: roomId,
                timestamp: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        console.error('Error saving message:', err);
        return null;
    }
}

async function getRecentMessages(roomId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data.reverse();
    } catch (err) {
        console.error('Error fetching messages:', err);
        return [];
    }
}

async function saveReportToDb(messageId, reason, reportedBy) {
    try {
        const { data, error } = await supabase
            .from('reports')
            .insert({
                message_id: messageId,
                reason,
                reported_by: reportedBy,
                time: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data[0];
    } catch (err) {
        console.error('Error saving report:', err);
        return null;
    }
}

// ==================== SOCKET.IO EVENTS ====================

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const clientIP = socket.handshake.address;

    // Check if IP is banned
    if (bannedIPs.has(clientIP)) {
        socket.emit('error', { message: 'You have been banned from this chat.' });
        socket.disconnect();
        return;
    }

    // User joins with username
    socket.on('join', async (data) => {
        const { username } = data;

        if (!username || username.trim().length === 0) {
            socket.emit('error', { message: 'Username is required' });
            return;
        }

        let finalUsername = username.trim().substring(0, 20);

        // Check for duplicate username and add suffix if needed
        const existingUser = Array.from(onlineUsers.values()).find(u => u.username === finalUsername);
        if (existingUser) {
            finalUsername = `${finalUsername}_${Math.floor(Math.random() * 1000)}`;
        }

        // Store user data
        const userData = {
            username: finalUsername,
            socketId: socket.id,
            joinedAt: new Date().toISOString(),
            ip: clientIP
        };

        onlineUsers.set(socket.id, userData);

        // Save to database
        await saveUserToDb(finalUsername, socket.id);

        // Join the public room
        socket.join(PUBLIC_ROOM);

        // Send recent messages to the new user
        const recentMessages = await getRecentMessages(PUBLIC_ROOM);
        socket.emit('recent_messages', recentMessages);

        // Confirm join to user
        socket.emit('joined', {
            username: finalUsername,
            room: PUBLIC_ROOM
        });

        // Broadcast user joined to all
        io.to(PUBLIC_ROOM).emit('user_joined', {
            username: finalUsername,
            onlineCount: onlineUsers.size,
            users: getOnlineUsersList()
        });

        console.log(`${finalUsername} joined the chat`);
    });

    // Handle new message
    socket.on('message', async (data) => {
        const user = onlineUsers.get(socket.id);

        if (!user) {
            socket.emit('error', { message: 'You must join first' });
            return;
        }

        // Check if user is muted
        if (mutedUsers.has(socket.id)) {
            socket.emit('error', { message: 'You are currently muted' });
            return;
        }

        // Rate limiting check
        if (!checkRateLimit(socket.id)) {
            socket.emit('error', { message: 'Slow down! You are sending messages too fast.' });
            return;
        }

        let { message } = data;

        if (!message || message.trim().length === 0) {
            return;
        }

        // Sanitize and filter
        message = sanitizeMessage(message);
        message = filterBadWords(message);

        // Save to database
        const savedMessage = await saveMessageToDb(user.username, message, PUBLIC_ROOM);

        const messageData = {
            id: savedMessage?.id || uuidv4(),
            username: user.username,
            message,
            timestamp: new Date().toISOString(),
            roomId: PUBLIC_ROOM
        };

        // Broadcast to all users in room
        io.to(PUBLIC_ROOM).emit('new_message', messageData);

        // Also emit to admin room for real-time monitoring
        io.to('admin-room').emit('new_message', messageData);
    });

    // Report message
    socket.on('report_message', async (data) => {
        const user = onlineUsers.get(socket.id);
        const { messageId, reason } = data;

        if (!user || !messageId) return;

        // Get the reported message details
        let reportedMessage = null;
        try {
            const { data: msgData } = await supabase
                .from('messages')
                .select('*')
                .eq('id', messageId)
                .single();
            reportedMessage = msgData;
        } catch (e) {
            console.log('Could not fetch reported message');
        }

        const reportData = {
            id: uuidv4(),
            message_id: messageId,
            reason: reason || 'No reason provided',
            reported_by: user.username,
            time: new Date().toISOString(),
            message_content: reportedMessage?.message || 'Message not found',
            message_author: reportedMessage?.username || 'Unknown'
        };

        await saveReportToDb(messageId, reason || 'No reason provided', user.username);

        socket.emit('report_submitted', {
            success: true,
            message: 'Report submitted to admin'
        });

        // Notify admin room with full details
        io.to('admin-room').emit('new_report', reportData);
    });

    // Typing indicator
    socket.on('typing', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            socket.to(PUBLIC_ROOM).emit('user_typing', {
                username: user.username,
                isTyping: data.isTyping
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        const user = onlineUsers.get(socket.id);

        if (user) {
            onlineUsers.delete(socket.id);
            await removeUserFromDb(socket.id);

            io.to(PUBLIC_ROOM).emit('user_left', {
                username: user.username,
                onlineCount: onlineUsers.size,
                users: getOnlineUsersList()
            });

            console.log(`${user.username} left the chat`);
        }

        messageRateLimit.delete(socket.id);
    });

    // ==================== ADMIN EVENTS ====================

    socket.on('admin_login', (data) => {
        const { password } = data;

        if (password === process.env.ADMIN_PASSWORD) {
            socket.join('admin-room');
            socket.emit('admin_authenticated', {
                success: true,
                onlineCount: onlineUsers.size,
                users: getOnlineUsersList()
            });
        } else {
            socket.emit('admin_authenticated', {
                success: false,
                message: 'Invalid password'
            });
        }
    });

    socket.on('admin_kick_user', (data) => {
        const { socketId, username } = data;

        let targetSocketId = socketId;

        if (username && !socketId) {
            const targetUser = Array.from(onlineUsers.entries()).find(
                ([, u]) => u.username === username
            );
            if (targetUser) {
                targetSocketId = targetUser[0];
            }
        }

        if (targetSocketId) {
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('kicked', { message: 'You have been kicked by admin' });
                targetSocket.disconnect();
            }
        }
    });

    socket.on('admin_mute_user', (data) => {
        const { socketId, username, duration } = data;

        let targetSocketId = socketId;

        if (username && !socketId) {
            const targetUser = Array.from(onlineUsers.entries()).find(
                ([, u]) => u.username === username
            );
            if (targetUser) {
                targetSocketId = targetUser[0];
            }
        }

        if (targetSocketId) {
            mutedUsers.add(targetSocketId);

            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('muted', {
                    message: 'You have been muted by admin',
                    duration
                });
            }

            // Auto unmute after duration
            if (duration) {
                setTimeout(() => {
                    mutedUsers.delete(targetSocketId);
                    const targetSocketAfter = io.sockets.sockets.get(targetSocketId);
                    if (targetSocketAfter) {
                        targetSocketAfter.emit('unmuted', { message: 'You have been unmuted' });
                    }
                }, duration * 1000);
            }
        }
    });

    socket.on('admin_delete_message', async (data) => {
        const { messageId } = data;

        console.log('Deleting message:', messageId);

        try {
            // Delete from database
            await supabase
                .from('messages')
                .delete()
                .eq('id', messageId);

            // Emit to public room (users will see message disappear)
            io.to(PUBLIC_ROOM).emit('message_deleted', { messageId });

            // Emit to admin room for live sync
            io.to('admin-room').emit('message_deleted', { messageId });

            console.log('Message deleted:', messageId);
        } catch (err) {
            console.error('Error deleting message:', err);
        }
    });

    socket.on('admin_clear_chat', async () => {
        console.log('Clearing all chat messages');

        try {
            // Delete all messages from database
            await supabase
                .from('messages')
                .delete()
                .eq('room_id', PUBLIC_ROOM);

            // Emit to public room
            io.to(PUBLIC_ROOM).emit('chat_cleared');

            // Emit to admin room for live sync
            io.to('admin-room').emit('chat_cleared');

            console.log('All chat cleared');
        } catch (err) {
            console.error('Error clearing chat:', err);
        }
    });

    socket.on('admin_ban_ip', (data) => {
        const { socketId } = data;
        const user = onlineUsers.get(socketId);

        if (user && user.ip) {
            bannedIPs.add(user.ip);

            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                targetSocket.emit('banned', { message: 'You have been banned' });
                targetSocket.disconnect();
            }
        }
    });

    socket.on('admin_get_stats', async () => {
        try {
            const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true });

            const { count: reportCount } = await supabase
                .from('reports')
                .select('*', { count: 'exact', head: true });

            socket.emit('admin_stats', {
                onlineUsers: onlineUsers.size,
                totalMessages: messageCount || 0,
                totalReports: reportCount || 0,
                activeRooms: 1,
                serverStatus: 'online',
                users: getOnlineUsersList()
            });
        } catch (err) {
            console.error('Error getting stats:', err);
        }
    });

    socket.on('admin_get_messages', async () => {
        const messages = await getRecentMessages(PUBLIC_ROOM, 100);
        socket.emit('admin_messages', messages);
    });

    socket.on('admin_get_reports', async () => {
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .order('time', { ascending: false })
                .limit(50);

            if (error) throw error;
            socket.emit('admin_reports', data);
        } catch (err) {
            console.error('Error fetching reports:', err);
            socket.emit('admin_reports', []);
        }
    });

    // Admin broadcast message to all users
    socket.on('admin_broadcast', (data) => {
        const { message } = data;
        if (!message) return;

        console.log('📢 Admin broadcast:', message);

        // Send system message to all users
        io.to(PUBLIC_ROOM).emit('system_message', {
            type: 'broadcast',
            message: `📢 ADMIN: ${message}`,
            timestamp: new Date().toISOString()
        });
    });
});

// ==================== REST API ROUTES ====================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        onlineUsers: onlineUsers.size
    });
});

app.get('/api/stats', (req, res) => {
    res.json({
        onlineUsers: onlineUsers.size,
        users: getOnlineUsersList()
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 ChatNow Room server running on port ${PORT}`);
    console.log(`📡 Socket.io ready for connections`);
});
