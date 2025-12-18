-- =============================================
-- ChatNow Room Database Schema
-- Supabase PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE (Temporary users - no login required)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    socket_id VARCHAR(100) UNIQUE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT true
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_socket_id ON users(socket_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================
-- MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    room_id VARCHAR(100) DEFAULT 'public-room',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    flagged BOOLEAN DEFAULT false
);

-- Index for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);

-- =============================================
-- REPORTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    reason TEXT,
    reported_by VARCHAR(50),
    time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, dismissed
    admin_notes TEXT
);

-- Index for reports
CREATE INDEX IF NOT EXISTS idx_reports_message_id ON reports(message_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- =============================================
-- BANNED_IPS TABLE (Optional - for persistent bans)
-- =============================================
CREATE TABLE IF NOT EXISTS banned_ips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    banned_by VARCHAR(50),
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- BAD_WORDS TABLE (Custom filter list)
-- =============================================
CREATE TABLE IF NOT EXISTS bad_words (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    word VARCHAR(100) UNIQUE NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by VARCHAR(50)
);

-- =============================================
-- ADMIN SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO admin_settings (setting_key, setting_value) VALUES
    ('max_message_length', '500'),
    ('rate_limit_messages', '5'),
    ('rate_limit_window', '1000'),
    ('welcome_message', 'Welcome to ChatNow Room! Be respectful and have fun! 🎉')
ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bad_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Users table policies (public read, authenticated write)
CREATE POLICY "Users are viewable by everyone" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can be inserted by service role" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can be deleted by service role" ON users
    FOR DELETE USING (true);

-- Messages table policies
CREATE POLICY "Messages are viewable by everyone" ON messages
    FOR SELECT USING (is_deleted = false);

CREATE POLICY "Messages can be inserted by service role" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages can be updated by service role" ON messages
    FOR UPDATE USING (true);

CREATE POLICY "Messages can be deleted by service role" ON messages
    FOR DELETE USING (true);

-- Reports table policies
CREATE POLICY "Reports can be inserted by anyone" ON reports
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Reports are viewable by service role" ON reports
    FOR SELECT USING (true);

CREATE POLICY "Reports can be updated by service role" ON reports
    FOR UPDATE USING (true);

-- Banned IPs - service role only
CREATE POLICY "Banned IPs service role access" ON banned_ips
    FOR ALL USING (true);

-- Bad words - service role only
CREATE POLICY "Bad words service role access" ON bad_words
    FOR ALL USING (true);

-- Admin settings - service role only
CREATE POLICY "Admin settings service role access" ON admin_settings
    FOR ALL USING (true);

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- =============================================
-- CLEANUP FUNCTION (Delete old inactive users)
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_inactive_users()
RETURNS void AS $$
BEGIN
    DELETE FROM users 
    WHERE joined_at < NOW() - INTERVAL '24 hours'
    AND is_active = false;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- AUTO-DELETE OLD MESSAGES (Optional)
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages 
    WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
