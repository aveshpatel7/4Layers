from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from backend.database import engine, Base
from backend.routes import users, devices, homes, rooms, schedules, alerts, history, voice_assistant
from backend import mqtt
from apscheduler.schedulers.background import BackgroundScheduler
import datetime
from backend.database import SessionLocal
from backend import models

# Initialize FastAPI App
app = FastAPI(
    title="SmartNest Home Automation Backend",
    description="A backend for managing users, IoT devices, and real-time state synchronization via MQTT.",
    version="1.0.0"
)

# Configure CORS Middleware using ALLOWED_ORIGINS env variables (e.g. for web panels, mobile clients)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allowed_origins = ["*"]  # Fallback to wildcard for local development

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(homes.router)
app.include_router(rooms.router)
app.include_router(schedules.router)
app.include_router(alerts.router)
app.include_router(history.router)
app.include_router(voice_assistant.router)

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

# Track already-fired schedules per minute to prevent duplicate firing
_fired_schedules_this_minute: dict = {}  # {schedule_id: "HH:MM"}

def check_schedules():
    """Runs every 15 seconds. Fires schedules with max ~15 sec delay."""
    global _fired_schedules_this_minute
    db = SessionLocal()
    try:
        # Calculate current IST local time
        try:
            from zoneinfo import ZoneInfo
            tz_ist = ZoneInfo("Asia/Kolkata")
            now_local = datetime.datetime.now(tz_ist)
        except Exception:
            utc_now = datetime.datetime.utcnow()
            now_local = utc_now + datetime.timedelta(hours=5, minutes=30)

        current_time_str = now_local.strftime("%H:%M")
        current_day_str = now_local.strftime("%a").lower()

        enabled_schedules = db.query(models.Schedule).filter(models.Schedule.enabled == True).all()
        for schedule in enabled_schedules:
            if schedule.time == current_time_str:
                # Prevent firing the same schedule twice in the same minute
                if _fired_schedules_this_minute.get(schedule.id) == current_time_str:
                    continue

                days_list = [d.strip().lower() for d in schedule.days.split(',')]
                if "daily" in days_list or current_day_str in days_list:
                    device = db.query(models.Device).filter(models.Device.id == schedule.device_id).first()
                    if device:
                        requested_state = { "status": schedule.action }
                        previous_state = device.current_state or {}

                        # Update device current_state in DB so API & UI sync
                        new_state = {**previous_state, **requested_state}
                        device.current_state = new_state
                        device.updated_at = datetime.datetime.utcnow()
                        db.add(device)

                        history_entry = models.DeviceHistory(
                            device_id=device.id,
                            change_type="command_sent",
                            previous_state=previous_state,
                            new_state=requested_state
                        )
                        db.add(history_entry)

                        alert_entry = models.Alert(
                            user_id=schedule.user_id,
                            device_id=device.id,
                            type="schedule_run",
                            message=f"Schedule auto-toggled appliance '{device.name}' to {schedule.action} state.",
                            is_read=False
                        )
                        db.add(alert_entry)

                        mqtt.publish_control_message(
                            node_id=device.node_id,
                            state=requested_state
                        )
                        # Mark as fired this minute
                        _fired_schedules_this_minute[schedule.id] = current_time_str
                        print(f"[Scheduler] Fired schedule {schedule.id} for device {device.name} -> {schedule.action}")

        # Cleanup old entries from _fired_schedules_this_minute
        _fired_schedules_this_minute = {
            k: v for k, v in _fired_schedules_this_minute.items() if v == current_time_str
        }
        db.commit()
    except Exception as e:
        print("[Scheduler] Error running schedules job:", e)
    finally:
        db.close()


DEVICE_OFFLINE_TIMEOUT_MINUTES = 3  # Mark offline if no message for 3 minutes

def check_device_heartbeats():
    """Runs every 2 minutes. Marks devices offline if last_seen is older than 3 minutes."""
    db = SessionLocal()
    try:
        cutoff_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=DEVICE_OFFLINE_TIMEOUT_MINUTES)
        # Find devices that are marked online but haven't been seen recently
        stale_devices = db.query(models.Device).filter(
            models.Device.is_online == True,
            models.Device.last_seen != None,
            models.Device.last_seen < cutoff_time
        ).all()

        for device in stale_devices:
            device.is_online = False
            device.updated_at = datetime.datetime.utcnow()
            db.add(device)

            try:
                owner_id = device.home.owner_id
            except Exception:
                owner_id = None

            if owner_id:
                alert_entry = models.Alert(
                    user_id=owner_id,
                    device_id=device.id,
                    type="device_offline",
                    message=f"Device '{device.name}' went OFFLINE (no heartbeat for {DEVICE_OFFLINE_TIMEOUT_MINUTES} min).",
                    is_read=False
                )
                db.add(alert_entry)
            print(f"[Heartbeat] Device '{device.name}' (node: {device.node_id}) marked OFFLINE — last seen: {device.last_seen}")

        if stale_devices:
            db.commit()
    except Exception as e:
        print("[Heartbeat] Error in heartbeat check:", e)
    finally:
        db.close()

# FastAPI Event Handlers
@app.on_event("startup")
def startup_event():
    # Verify environment variables security
    secret_key = os.getenv("SECRET_KEY")
    database_url = os.getenv("DATABASE_URL")
    
    is_prod = False
    if database_url and ("render.com" in database_url or "amazonaws.com" in database_url):
        is_prod = True
        
    if is_prod:
        if not secret_key or secret_key == "smartnest_super_secret_key_change_me_in_production":
            import sys
            import logging
            logger = logging.getLogger("UVicorn")
            logger.error("FATAL SECURITY ERROR: SECRET_KEY is not configured or uses insecure default fallback in production!")
            sys.exit("SECRET_KEY security violation. Exiting server.")

    # Create database tables if they do not exist
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized.")

    # Start MQTT connection and client background loop
    mqtt.start_mqtt()
    print("MQTT background listener started.")

    # Start schedules background worker — runs every 15 sec for low-latency firing
    scheduler.add_job(check_schedules, 'interval', seconds=15)
    # Start device heartbeat checker — runs every 2 min to detect offline devices
    scheduler.add_job(check_device_heartbeats, 'interval', minutes=2)
    scheduler.start()
    print("Scheduler daemon process started (schedule check: 15s, heartbeat: 2min).")

@app.on_event("shutdown")
def shutdown_event():
    # Stop the MQTT client loop and disconnect
    mqtt.stop_mqtt()
    print("MQTT listener stopped and disconnected.")

    # Stop scheduler
    scheduler.shutdown()
    print("Scheduler stopped.")

@app.get("/")
def read_root():
    """Welcome endpoint to verify backend status."""
    return {
        "status": "online",
        "service": "SmartNest Home Automation API",
        "mqtt_broker": mqtt.MQTT_BROKER,
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    # When run directly, start uvicorn server on port 8000
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

