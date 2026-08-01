import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field, EmailStr
from uuid import UUID

# --- User Schemas ---
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: UUID

    model_config = {
        "from_attributes": True
    }

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class UserUpdateProfile(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)

class UserChangePassword(BaseModel):
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


# --- Home Schemas ---
class HomeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class HomeCreate(HomeBase):
    pass

class HomeResponse(HomeBase):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# --- Room Schemas ---
class RoomBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    room_type: str = Field(..., description="e.g. living_room, bedroom, kitchen, bathroom")

class RoomCreate(RoomBase):
    home_id: UUID

class RoomResponse(RoomBase):
    id: UUID
    home_id: UUID
    name: str
    room_type: str
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# --- Device Schemas ---
class DeviceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    device_type: str = Field(..., description="Must be 'light', 'fan', or 'AC'")
    node_id: str = Field(..., description="Unique ESP32 chip/node ID string")

class DeviceCreate(DeviceBase):
    room_id: Optional[UUID] = None
    home_id: UUID

class DeviceResponse(DeviceBase):
    id: UUID
    room_id: Optional[UUID] = None
    home_id: UUID
    node_id: str
    mac_address: Optional[str] = None
    name: str
    device_type: str
    is_online: bool
    current_state: Dict[str, Any] = {}
    last_seen: Optional[datetime.datetime] = None
    updated_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }

class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    device_type: Optional[str] = Field(None, description="Must be 'light', 'fan', or 'outlet'")
    room_id: Optional[UUID] = None

class DeviceProvision(BaseModel):
    mac_address: str = Field(..., min_length=1, description="MAC address of the physical hardware")
    type: str = Field(..., description="Device type, e.g. LIGHT, FAN, AC")
    name: Optional[str] = Field(None, description="Prefix name to distinguish this board, e.g. Bedside Panel")
    room_id: Optional[UUID] = None
    new_room_name: Optional[str] = None
    new_room_type: Optional[str] = "living_room"
class DeviceProvisionSingle(BaseModel):
    mac_address: str = Field(..., description="MAC address of the physical hardware")
    suffix: str = Field(..., description="Channel suffix, e.g. 1 to 7")
    room_id: UUID = Field(..., description="Destination room UUID")
    device_type: str = Field(..., description="Device type, e.g. light, fan, outlet")

class DeviceControl(BaseModel):
    state: Dict[str, Any] = Field(..., description="JSON representation of desired state updates (e.g. {'status': 'ON'})")


# --- Device History Schemas ---
class DeviceHistoryResponse(BaseModel):
    id: UUID
    device_id: UUID
    change_type: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Dict[str, Any]
    timestamp: datetime.datetime

    model_config = {
        "from_attributes": True
    }

class BulkDeviceControl(BaseModel):
    device_ids: List[UUID]
    state: Dict[str, Any]


# --- Schedule Schemas ---
class ScheduleBase(BaseModel):
    device_id: UUID
    action: str = Field(..., description="ON or OFF")
    time: str = Field(..., description="HH:MM format")
    days: str = Field(..., description="e.g. mon,tue,wed or daily")
    enabled: bool = True
    actions: Optional[List[Dict[str, Any]]] = Field(None, description="Optional multi-switch action list e.g. [{'device_id': '...', 'action': 'ON'}]")

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleUpdate(BaseModel):
    action: Optional[str] = None
    time: Optional[str] = None
    days: Optional[str] = None
    enabled: Optional[bool] = None
    actions: Optional[List[Dict[str, Any]]] = None

class ScheduleResponse(ScheduleBase):
    id: UUID
    user_id: UUID
    actions_json: Optional[List[Dict[str, Any]]] = None
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# --- Alert Schemas ---
class AlertResponse(BaseModel):
    id: UUID
    user_id: UUID
    device_id: Optional[UUID] = None
    type: str
    message: str
    is_read: bool
    created_at: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# --- Event History Schemas ---
class EventHistoryResponse(BaseModel):
    id: UUID
    device_id: UUID
    device_name: str
    change_type: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Dict[str, Any]
    timestamp: datetime.datetime

    model_config = {
        "from_attributes": True
    }


# --- MQTT Config Schema ---
class MqttConfigResponse(BaseModel):
    broker_host: str
    broker_port: int
    username: str
    password: str


# --- Node Sharing Schemas ---
class NodeShareCreate(BaseModel):
    email: EmailStr

class NodeMemberResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    email: str
    username: Optional[str] = None
    status: str  # "active" or "pending"
    access_level: str = "user"
    created_at: datetime.datetime

class NodeShareActionResponse(BaseModel):
    status: str  # "added" or "invite_sent"
    message: str
    member: Optional[NodeMemberResponse] = None

