# ChatNow Room - Database Setup

## Supabase Configuration

### Step 1: Go to Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `ytkoszllaauryltagkrb`

### Step 2: Run SQL Schema
1. Go to **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy the contents of `schema.sql`
4. Paste and click **Run**

### Step 3: Enable Realtime
1. Go to **Database** → **Replication**
2. Make sure these tables are enabled for realtime:
   - `messages`
   - `users`
   - `reports`

## Tables Overview

### users (Temporary Users)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | VARCHAR(50) | User's chosen name |
| socket_id | VARCHAR(100) | Unique socket connection ID |
| joined_at | TIMESTAMP | When user joined |

### messages
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | VARCHAR(50) | Message sender |
| message | TEXT | Message content |
| room_id | VARCHAR(100) | Room identifier |
| timestamp | TIMESTAMP | When message was sent |

### reports
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| message_id | UUID | Reference to message |
| reason | TEXT | Report reason |
| reported_by | VARCHAR(50) | Who reported |
| time | TIMESTAMP | When reported |
| status | VARCHAR(20) | pending/reviewed/dismissed |

## API Keys (Already configured in backend/.env)

- **URL**: `https://ytkoszllaauryltagkrb.supabase.co`
- **Anon Key**: For public operations
- **Service Role Key**: For admin operations

## Realtime Subscriptions

The following tables have realtime enabled:
- `messages` - For live chat updates
- `users` - For online users tracking
- `reports` - For admin notifications
