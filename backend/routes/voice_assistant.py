from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
import json
import re
import datetime
from uuid import UUID

from backend.database import get_db
from backend import models, auth, mqtt, schemas

router = APIRouter(tags=["Voice Assistant Integration"])

# ----------------------------------------------------------------------
# 1. OAuth2 Account Linking Endpoints (for Google Home & Alexa)
# ----------------------------------------------------------------------

@router.get("/oauth/authorize", response_class=HTMLResponse)
def oauth_authorize_page(request: Request, client_id: str = "", redirect_uri: str = "", state: str = "", response_type: str = "code"):
    """Render 4Layers OAuth2 login page for Google Home and Alexa Account Linking."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>4Layers Smart Home - Account Linking</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #0E0E0E; color: #E5E2E1; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }}
            .card {{ background: #1C1B1B; padding: 32px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            h2 {{ color: #22C55E; margin-top: 0; text-align: center; font-size: 24px; }}
            p {{ color: #9CA3AF; text-align: center; font-size: 14px; margin-bottom: 24px; }}
            input {{ width: 100%; padding: 12px; margin: 8px 0 16px 0; background: #161515; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; box-sizing: border-box; }}
            button {{ width: 100%; padding: 14px; background: #22C55E; border: none; border-radius: 12px; color: #000; font-weight: bold; font-size: 16px; cursor: pointer; }}
            button:hover {{ background: #16a34a; }}
            .logo {{ text-align: center; font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #fff; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="logo">4Layers <span style="color:#22C55E;">IoT</span></div>
            <p>Link your account with Google Assistant & Alexa</p>
            <form action="/oauth/authorize" method="post">
                <input type="hidden" name="redirect_uri" value="{redirect_uri}">
                <input type="hidden" name="state" value="{state}">
                <input type="hidden" name="client_id" value="{client_id}">
                
                <label>Email Address</label>
                <input type="email" name="username" required placeholder="your@email.com">
                
                <label>Password</label>
                <input type="password" name="password" required placeholder="••••••••">
                
                <button type="submit">Authorize & Link</button>
            </form>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.post("/oauth/authorize")
def oauth_authorize_submit(
    username: str = Form(...),
    password: str = Form(...),
    redirect_uri: str = Form(""),
    state: str = Form(""),
    client_id: str = Form(""),
    db: Session = Depends(get_db)
):
    """Authenticate user and issue auth code / token for OAuth linking."""
    user = db.query(models.User).filter(models.User.email == username.strip().lower()).first()
    if not user or not auth.verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    
    if redirect_uri:
        delimiter = "&" if "?" in redirect_uri else "?"
        target_url = f"{redirect_uri}{delimiter}code={access_token}&state={state}"
        return RedirectResponse(url=target_url, status_code=302)
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/oauth/token")
def oauth_token_endpoint(
    grant_type: str = Form(...),
    code: str = Form(None),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    refresh_token: str = Form(None)
):
    """Exchange authorization code or refresh token for OAuth access token."""
    token = code or refresh_token or "demo_token"
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 3600 * 24 * 30, # 30 days
        "refresh_token": token
    }

# ----------------------------------------------------------------------
# 2. Google Home Smart Home Fulfillment Endpoint
# ----------------------------------------------------------------------

@router.post("/api/google/fulfillment")
async def google_fulfillment(request: Request, db: Session = Depends(get_db)):
    """Google Assistant Smart Home Fulfillment Endpoint (SYNC, QUERY, EXECUTE)."""
    body = await request.json()
    inputs = body.get("inputs", [])
    if not inputs:
        return {"requestId": body.get("requestId"), "payload": {}}

    intent = inputs[0].get("intent")
    request_id = body.get("requestId")

    # Extract user from Bearer token
    headers = request.headers
    auth_header = headers.get("Authorization", "")
    user = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            user_id = payload.get("sub")
            user = db.query(models.User).filter(models.User.id == UUID(user_id)).first()
        except Exception:
            pass

    if not user:
        # Fallback to first active user if token unverified during local testing
        user = db.query(models.User).first()

    devices = db.query(models.Device).filter(models.Device.owner_id == user.id).all() if user else []

    if intent == "action.devices.SYNC":
        google_devices = []
        for dev in devices:
            # Exclude master switches
            if dev.node_id and (dev.node_id.endswith('_6') or dev.node_id.endswith('_7')):
                continue
            
            is_fan = dev.node_id and dev.node_id.endswith('_5')
            dev_type = "action.devices.types.FAN" if is_fan else "action.devices.types.SWITCH"
            
            traits = ["action.devices.traits.OnOff"]
            if is_fan:
                traits.append("action.devices.traits.FanSpeed")
                
            attributes = {}
            if is_fan:
                attributes["availableFanSpeeds"] = {
                    "speeds": [
                        {"speed_name": "Off", "speed_values": [{"speed_synonym": ["off", "0"], "speed_value": "0"}]},
                        {"speed_name": "Low", "speed_values": [{"speed_synonym": ["low", "1", "one"], "speed_value": "1"}]},
                        {"speed_name": "Medium", "speed_values": [{"speed_synonym": ["medium", "2", "two"], "speed_value": "2"}]},
                        {"speed_name": "High", "speed_values": [{"speed_synonym": ["high", "3", "three"], "speed_value": "3"}]},
                        {"speed_name": "Max", "speed_values": [{"speed_synonym": ["max", "maximum", "4", "four"], "speed_value": "4"}]}
                    ],
                    "ordered": True
                }

            google_devices.append({
                "id": str(dev.id),
                "type": dev_type,
                "traits": traits,
                "name": {"name": dev.name},
                "willReportState": True,
                "attributes": attributes,
                "deviceInfo": {"manufacturer": "4Layers IoT", "model": "4L-NODE-ESP32"}
            })

        return {
            "requestId": request_id,
            "payload": {
                "agentUserId": str(user.id) if user else "user_1",
                "devices": google_devices
            }
        }

    elif intent == "action.devices.QUERY":
        query_devices = {}
        for dev in devices:
            state_dict = dev.current_state or {}
            if isinstance(state_dict, str):
                try: state_dict = json.loads(state_dict)
                except: state_dict = {}
            
            is_on = state_dict.get("status") in [True, "ON", 1]
            speed = state_dict.get("value") or state_dict.get("speed") or 1

            query_devices[str(dev.id)] = {
                "online": True,
                "on": is_on,
                "currentFanSpeedSetting": str(speed)
            }

        return {
            "requestId": request_id,
            "payload": {"devices": query_devices}
        }

    elif intent == "action.devices.EXECUTE":
        commands_res = []
        payload_commands = inputs[0].get("payload", {}).get("commands", [])

        for cmd in payload_commands:
            target_ids = [d["id"] for d in cmd.get("devices", [])]
            execution_list = cmd.get("execution", [])

            for exec_item in execution_list:
                command_name = exec_item.get("command")
                params = exec_item.get("params", {})

                for dev_id in target_ids:
                    dev = db.query(models.Device).filter(models.Device.id == UUID(dev_id)).first()
                    if dev:
                        state_dict = dev.current_state or {}
                        if isinstance(state_dict, str):
                            try: state_dict = json.loads(state_dict)
                            except: state_dict = {}

                        if command_name == "action.devices.commands.OnOff":
                            new_on = params.get("on", False)
                            state_dict["status"] = "ON" if new_on else "OFF"
                        elif command_name == "action.devices.commands.SetFanSpeed":
                            speed_val = int(params.get("fanSpeed", 1))
                            state_dict["value"] = speed_val
                            if speed_val == 0:
                                state_dict["status"] = "OFF"
                            else:
                                state_dict["status"] = "ON"

                        dev.current_state = state_dict
                        db.commit()

                        # Publish MQTT command to physical board
                        mqtt.publish_device_control(dev.node_id, state_dict)

                        commands_res.append({
                            "ids": [str(dev.id)],
                            "status": "SUCCESS",
                            "states": {
                                "on": state_dict.get("status") == "ON",
                                "currentFanSpeedSetting": str(state_dict.get("value", 1)),
                                "online": True
                            }
                        })

        return {
            "requestId": request_id,
            "payload": {"commands": commands_res}
        }

    return {"requestId": request_id, "payload": {}}

# ----------------------------------------------------------------------
# 3. Amazon Alexa Smart Home Directive Handler
# ----------------------------------------------------------------------

@router.post("/api/alexa/fulfillment")
async def alexa_fulfillment(request: Request, db: Session = Depends(get_db)):
    """Amazon Alexa Smart Home Directive Handler (Alexa.Discovery, Alexa.PowerController)."""
    body = await request.json()
    directive = body.get("directive", {})
    header = directive.get("header", {})
    namespace = header.get("namespace")
    name = header.get("name")

    user = db.query(models.User).first()
    devices = db.query(models.Device).filter(models.Device.owner_id == user.id).all() if user else []

    if namespace == "Alexa.Discovery" and name == "Discover":
        endpoints = []
        for dev in devices:
            if dev.node_id and (dev.node_id.endswith('_6') or dev.node_id.endswith('_7')):
                continue
            
            is_fan = dev.node_id and dev.node_id.endswith('_5')
            category = "FAN" if is_fan else "SWITCH"
            
            endpoints.append({
                "endpointId": str(dev.id),
                "manufacturerName": "4Layers IoT",
                "friendlyName": dev.name,
                "description": f"4Layers {category} in {dev.node_id}",
                "displayCategories": [category],
                "capabilities": [
                    {
                        "type": "AlexaInterface",
                        "interface": "Alexa.PowerController",
                        "version": "3",
                        "properties": {
                            "supported": [{"name": "powerState"}],
                            "proactivelyReported": True,
                            "retrievable": True
                        }
                    }
                ]
            })

        return {
            "event": {
                "header": {
                    "namespace": "Alexa.Discovery",
                    "name": "Discover.Response",
                    "payloadVersion": "3",
                    "messageId": header.get("messageId")
                },
                "payload": {"endpoints": endpoints}
            }
        }

    elif namespace == "Alexa.PowerController":
        endpoint_id = directive.get("endpoint", {}).get("endpointId")
        dev = db.query(models.Device).filter(models.Device.id == UUID(endpoint_id)).first() if endpoint_id else None
        
        target_state = "ON" if name == "TurnOn" else "OFF"
        
        if dev:
            state_dict = dev.current_state or {}
            if isinstance(state_dict, str):
                try: state_dict = json.loads(state_dict)
                except: state_dict = {}
            
            state_dict["status"] = target_state
            dev.current_state = state_dict
            db.commit()

            mqtt.publish_device_control(dev.node_id, state_dict)

            return {
                "event": {
                    "header": {
                        "namespace": "Alexa",
                        "name": "Response",
                        "payloadVersion": "3",
                        "messageId": header.get("messageId")
                    },
                    "endpoint": {"endpointId": endpoint_id},
                    "payload": {}
                },
                "context": {
                    "properties": [
                        {
                            "namespace": "Alexa.PowerController",
                            "name": "powerState",
                            "value": "ON" if target_state == "ON" else "OFF",
                            "timeOfSample": datetime.datetime.utcnow().isoformat() + "Z",
                            "uncertaintyInMilliseconds": 50
                        }
                    ]
                }
            }

    return {"event": {"header": {"namespace": "Alexa", "name": "ErrorResponse", "payloadVersion": "3"}, "payload": {}}}

# ----------------------------------------------------------------------
# 4. In-App Natural Voice Command Parser
# ----------------------------------------------------------------------

@router.post("/api/voice/command")
def process_voice_command(
    command_data: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Process natural speech commands (e.g. 'turn on bedroom light', 'set fan to 3')."""
    raw_text = (command_data.get("command") or "").strip().lower()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Voice command text is empty")

    user_devices = db.query(models.Device).filter(models.Device.owner_id == current_user.id).all()
    user_rooms = db.query(models.Room).all()

    # Determine intent
    is_on = "on" in raw_text or "chalu" in raw_text or "start" in raw_text
    is_off = "off" in raw_text or "band" in raw_text or "stop" in raw_text
    
    # Check for fan speed adjustment (e.g. "fan speed 3", "set fan to 4")
    speed_match = re.search(r'(?:speed|fan|val|level)\s*([0-4])', raw_text) or re.search(r'([0-4])\s*(?:speed|fan)', raw_text)
    target_speed = int(speed_match.group(1)) if speed_match else None

    # Check for target room
    matched_room = None
    for room in user_rooms:
        if room.name.lower() in raw_text or room.room_type.lower() in raw_text:
            matched_room = room
            break

    modified_devices = []
    
    for dev in user_devices:
        # Filter out master switches for direct individual/room commands unless explicitly requested
        is_master = dev.node_id and (dev.node_id.endswith('_6') or dev.node_id.endswith('_7'))
        is_fan = dev.node_id and dev.node_id.endswith('_5')

        # If a room was specified, match device by room_id
        if matched_room and dev.room_id != matched_room.id:
            continue

        # Check device name match if room not specified
        if not matched_room and not is_master and not ("all" in raw_text or "sabhi" in raw_text or "saare" in raw_text):
            dev_name_clean = dev.name.lower()
            if dev_name_clean not in raw_text and not (is_fan and "fan" in raw_text):
                continue

        state_dict = dev.current_state or {}
        if isinstance(state_dict, str):
            try: state_dict = json.loads(state_dict)
            except: state_dict = {}

        updated = False
        if target_speed is not None and is_fan:
            state_dict["value"] = target_speed
            state_dict["status"] = "OFF" if target_speed == 0 else "ON"
            updated = True
        elif is_on:
            state_dict["status"] = "ON"
            updated = True
        elif is_off:
            state_dict["status"] = "OFF"
            updated = True

        if updated:
            dev.current_state = state_dict
            modified_devices.append(dev)
            mqtt.publish_device_control(dev.node_id, state_dict)

    db.commit()

    room_str = f" in {matched_room.name}" if matched_room else ""
    if not modified_devices:
        return {
            "success": False,
            "message": f"Could not find any matching devices for command: '{raw_text}'.",
            "modified_count": 0
        }

    status_str = "turned ON" if is_on else ("turned OFF" if is_off else f"set to speed {target_speed}")
    return {
        "success": True,
        "message": f"Successfully {status_str} {len(modified_devices)} device(s){room_str}.",
        "modified_count": len(modified_devices),
        "command": raw_text
    }
