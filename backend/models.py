import uuid
import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    expo_push_token = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    terms_accepted = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    is_active = Column(Boolean, default=True, server_default=text("true"), nullable=False)
    block_reason = Column(String, nullable=True)
    profile_pic_url = Column(String, nullable=True)

    # Relationships
    homes = relationship("Home", back_populates="owner", cascade="all, delete-orphan")


class Home(Base):
    __tablename__ = "homes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="homes")
    rooms = relationship("Room", back_populates="home", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="home", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    home_id = Column(UUID(as_uuid=True), ForeignKey("homes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    room_type = Column(String, nullable=False)  # e.g., "living_room", "bedroom", "kitchen", "bathroom"
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    home = relationship("Home", back_populates="rooms")
    devices = relationship("Device", back_populates="room")


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    home_id = Column(UUID(as_uuid=True), ForeignKey("homes.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(String, unique=True, index=True, nullable=False)  # Unique ESP32 Chip ID String
    mac_address = Column(String, index=True, nullable=True)  # Hardware MAC address (not unique due to multi-channels)
    name = Column(String, nullable=False)
    device_type = Column(String, nullable=False)  # e.g., "light", "fan", "AC"
    local_ip = Column(String, nullable=True)  # LAN local IP address (e.g. 192.168.1.50)
    is_online = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    current_state = Column(JSON, default={}, server_default=text("'{}'"), nullable=False)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    home = relationship("Home", back_populates="devices")
    room = relationship("Room", back_populates="devices")
    history = relationship("DeviceHistory", back_populates="device", cascade="all, delete-orphan")


class DeviceHistory(Base):
    __tablename__ = "device_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    change_type = Column(String, nullable=False)  # "command_sent", "status_confirmed", "device_created"
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    device = relationship("Device", back_populates="history")

    @property
    def device_name(self) -> str:
        return self.device.name if self.device else "Unknown Device"


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)  # "ON" or "OFF"
    time = Column(String, nullable=False)  # "HH:MM" (e.g. "08:30" or "22:00")
    days = Column(String, nullable=False)  # CSV representation e.g. "mon,tue,wed" or "daily"
    enabled = Column(Boolean, default=True, server_default=text("true"), nullable=False)
    actions_json = Column(JSON, nullable=True)  # List of actions e.g. [{"device_id": "...", "action": "ON"}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    device = relationship("Device")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    type = Column(String, nullable=False)  # "device_offline", "device_online", "schedule_run", "info"
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    device = relationship("Device")


class NodeShare(Base):
    __tablename__ = "node_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    node_id = Column(String, index=True, nullable=False)
    shared_with_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    access_level = Column(String, default="user", server_default=text("'user'"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    shared_with_user = relationship("User")


class PendingInvitation(Base):
    __tablename__ = "pending_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    node_id = Column(String, index=True, nullable=False)
    invited_email = Column(String, index=True, nullable=False)
    invited_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", server_default=text("'pending'"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, server_default=text("timezone('utc', now())"), nullable=False)

    # Relationships
    invited_by_user = relationship("User")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)


