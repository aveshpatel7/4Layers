-- Enable pgcrypto extension for gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if migrating from scratch
DROP TABLE IF EXISTS device_telemetries CASCADE;
DROP TABLE IF EXISTS ownership_audits CASCADE;
DROP TABLE IF EXISTS device_ownership CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS pending_invitations CASCADE;
DROP TABLE IF EXISTS node_shares CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS device_histories CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS homes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    expo_push_token VARCHAR(255),
    phone_number VARCHAR(50),
    terms_accepted BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    block_reason VARCHAR(255),
    profile_pic_url VARCHAR(512),
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    email_verification_token VARCHAR(255),
    email_verification_sent_at TIMESTAMP WITH TIME ZONE,
    reset_password_token VARCHAR(255),
    reset_password_sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexing for users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- 2. Homes Table
CREATE TABLE homes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_homes_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexing for homes
CREATE INDEX idx_homes_owner ON homes(owner_id);

-- 3. Rooms Table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    room_type VARCHAR(50) NOT NULL, -- e.g., living_room, bedroom, kitchen, bathroom
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_rooms_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

-- Indexing for rooms
CREATE INDEX idx_rooms_home ON rooms(home_id);

-- 4. Devices Table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID,
    home_id UUID NOT NULL,
    node_id VARCHAR(100) UNIQUE NOT NULL, -- Unique ESP32 Chip ID String
    mac_address VARCHAR(100), -- Hardware MAC address (not unique due to multi-channels)
    name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- e.g., light, fan, AC
    local_ip VARCHAR(64),
    is_online BOOLEAN DEFAULT FALSE NOT NULL,
    current_state JSONB DEFAULT '{}'::jsonb NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    warranty_status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
    total_toggle_count INTEGER DEFAULT 0 NOT NULL,
    total_on_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    crash_count INTEGER DEFAULT 0 NOT NULL,
    boot_count INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_devices_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    CONSTRAINT fk_devices_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

-- Indexing for devices
CREATE INDEX idx_devices_node ON devices(node_id);
CREATE INDEX idx_devices_mac ON devices(mac_address);
CREATE INDEX idx_devices_room ON devices(room_id);
CREATE INDEX idx_devices_home ON devices(home_id);
CREATE INDEX idx_devices_warranty_status ON devices(warranty_status);

-- 5. Device Histories Table (Timeline Logs)
CREATE TABLE device_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- e.g., command_sent, status_confirmed, device_created
    previous_state JSONB,
    new_state JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_histories_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Indexing for history
CREATE INDEX idx_histories_device ON device_histories(device_id);
CREATE INDEX idx_histories_timestamp ON device_histories(timestamp DESC);

-- 6. Device Telemetries Table (Periodic Usage & Diagnostics Snapshots)
CREATE TABLE device_telemetries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID,
    node_id VARCHAR(100) NOT NULL,
    channel INTEGER,
    toggles INTEGER DEFAULT 0 NOT NULL,
    on_duration_seconds INTEGER DEFAULT 0 NOT NULL,
    on_hours DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    boot_count INTEGER DEFAULT 0 NOT NULL,
    crash_count INTEGER DEFAULT 0 NOT NULL,
    rssi INTEGER,
    uptime_seconds INTEGER,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_telemetries_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Indexing for telemetry
CREATE INDEX idx_telemetries_device ON device_telemetries(device_id);
CREATE INDEX idx_telemetries_node ON device_telemetries(node_id);
CREATE INDEX idx_telemetries_created_at ON device_telemetries(created_at DESC);

-- 7. Schedules Table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    time VARCHAR(10) NOT NULL,
    days VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    actions_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_schedules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedules_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- 8. Alerts Table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_id UUID,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- 9. Node Shares Table
CREATE TABLE node_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL,
    shared_with_user_id UUID NOT NULL,
    access_level VARCHAR(20) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_node_shares_user FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Pending Invitations Table
CREATE TABLE pending_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL,
    invited_email VARCHAR(255) NOT NULL,
    invited_by_user_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_pending_inv_user FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 11. App Settings Table
CREATE TABLE app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 12. Device Ownership Table
CREATE TABLE device_ownership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_dev_ownership_user FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_ownership_node ON device_ownership(node_id);

-- 13. Ownership Audits Table
CREATE TABLE ownership_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_owner_id UUID,
    to_owner_id UUID,
    performed_by_id UUID,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_audit_from_owner FOREIGN KEY (from_owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_to_owner FOREIGN KEY (to_owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_performed_by FOREIGN KEY (performed_by_id) REFERENCES users(id) ON DELETE SET NULL
);
