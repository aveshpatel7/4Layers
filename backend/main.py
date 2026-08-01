from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from backend.database import engine, Base
from backend.routes import users, devices, homes, rooms, schedules, alerts, history, voice_assistant, admin, sharing
from backend import mqtt, admin_ui
from apscheduler.schedulers.background import BackgroundScheduler
import datetime
from backend.database import SessionLocal
from backend import models

# Initialize FastAPI App (v1.0.1 Admin Production)
app = FastAPI(
    title="SmartNest Home Automation Backend",
    description="A backend for managing users, IoT devices, and real-time state synchronization via MQTT.",
    version="1.0.1"
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
app.include_router(admin.router)
app.include_router(sharing.router)

# Embedded Web Admin Console Routes (100% Zero Disk Path Dependency)
@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
@app.get("/admin/", response_class=HTMLResponse, include_in_schema=False)
def serve_admin_index():
    return HTMLResponse(content=admin_ui.ADMIN_HTML)

@app.get("/admin/style.css", include_in_schema=False)
def serve_admin_css():
    return Response(content=admin_ui.ADMIN_CSS, media_type="text/css")

@app.get("/admin/app.js", include_in_schema=False)
def serve_admin_js():
    return Response(content=admin_ui.ADMIN_JS, media_type="application/javascript")

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

# Track already-fired schedules per minute to prevent duplicate firing
_fired_schedules_this_minute: dict = {}  # {schedule_id: "HH:MM"}

def check_schedules():
    """Runs every 1 second. Fires schedules with zero delay (<1 sec)."""
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

        # Query only enabled schedules matching current HH:MM directly from DB for ultra-fast performance
        enabled_schedules = db.query(models.Schedule).filter(
            models.Schedule.enabled == True,
            models.Schedule.time == current_time_str
        ).all()

        for schedule in enabled_schedules:
            # Prevent firing the same schedule twice in the same minute
            if _fired_schedules_this_minute.get(schedule.id) == current_time_str:
                continue

            days_list = [d.strip().lower() for d in schedule.days.split(',')]
            if "daily" in days_list or "everyday" in days_list or current_day_str in days_list:
                # Execute all target actions (multi-switch support)
                actions_list = schedule.actions_json if (schedule.actions_json and isinstance(schedule.actions_json, list)) else [{"device_id": str(schedule.device_id), "action": schedule.action}]
                print(f"[Scheduler] Processing schedule {schedule.id} with {len(actions_list)} multi-switch actions...")

                import time
                for idx, act_item in enumerate(actions_list):
                    target_dev_id = act_item.get("device_id")
                    target_act = act_item.get("action", schedule.action or "ON")
                    if not target_dev_id:
                        continue

                    device = db.query(models.Device).filter(models.Device.id == target_dev_id).first()
                    if device:
                        requested_state = { "status": target_act }
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
                            message=f"Schedule auto-toggled appliance '{device.name}' to {target_act} state.",
                            is_read=False
                        )
                        db.add(alert_entry)

                        mqtt.publish_control_message(
                            node_id=device.node_id,
                            state=requested_state
                        )
                        print(f"[Scheduler] Action {idx+1}/{len(actions_list)} Fired: Schedule {schedule.id} -> Device '{device.name}' (node_id: {device.node_id}) set to {target_act}")
                        time.sleep(0.05)  # 50ms delay between consecutive MQTT publishes to prevent hardware rx buffer drops

                # Mark schedule as fired this minute
                _fired_schedules_this_minute[schedule.id] = current_time_str

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
            import logging
            logger = logging.getLogger("UVicorn")
            logger.warning("SECURITY WARNING: Using fallback SECRET_KEY in production environment.")

    # Create database tables if they do not exist
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE schedules ADD COLUMN IF NOT EXISTS actions_json JSON;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR;"))
            conn.commit()
            print("PostgreSQL migration: Verified actions_json and expo_push_token columns.")
    except Exception as m_err:
        print("PostgreSQL migration notice:", m_err)
    print("Database tables initialized.")

    # Start MQTT connection and client background loop
    mqtt.start_mqtt()
    print("MQTT background listener started.")

    # Start schedules background worker — runs every 1 sec for zero-delay instant firing (<1s)
    scheduler.add_job(check_schedules, 'interval', seconds=1)
    # Start device heartbeat checker — runs every 2 min to detect offline devices
    scheduler.add_job(check_device_heartbeats, 'interval', minutes=2)
    scheduler.start()
    print("Scheduler daemon process started (schedule check: 1s, heartbeat: 2min).")

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

@app.get("/health")
def health_check():
    """App Runner Health Check Endpoint."""
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

@app.get("/privacy-policy", response_class=HTMLResponse)
def privacy_policy():
    """Official Privacy Policy Page for Google Home Action & Alexa Certification."""
    return """<!DOCTYPE html>
<html>
<head>
    <title>4Layers Smart Home - Privacy Policy</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 30px 20px; background-color: #f8fafc; }
        .container { background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        h1 { color: #22c55e; font-size: 26px; border-bottom: 2px solid #22c55e; padding-bottom: 10px; margin-top: 0; }
        h2 { color: #0f172a; font-size: 17px; margin-top: 22px; }
        p, li { font-size: 14.5px; color: #475569; }
        ul { padding-left: 20px; }
        a { color: #22c55e; text-decoration: none; font-weight: 600; }
        a:hover { text-decoration: underline; }
        .footer { margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>4Layers Smart Home — Privacy Policy</h1>
        <p><b>Last Updated:</b> July 30, 2026</p>
        <p>At 4Layers Smart Home ("we", "our", or "us"), we value your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use the 4Layers Smart Home mobile app, Cloud API, and integrations with Google Home and Amazon Alexa.</p>

        <h2>1. Information We Collect</h2>
        <p>We may collect:</p>
        <ul>
            <li><b>Account Information:</b> Such as your email address and account ID.</li>
            <li><b>Smart Home Device Information:</b> Device names, status, fan speed, room assignments, and device identifiers.</li>
            <li><b>Diagnostic & Network Data:</b> App usage, diagnostic logs, IP address, and connectivity information.</li>
            <li><b>Voice Integration Commands:</b> Smart home commands received through Google Home or Amazon Alexa to perform requested actions. <i>We do not store voice recordings.</i></li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
            <li>Authenticate your account and maintain security.</li>
            <li>Control and synchronize your smart home devices across platforms.</li>
            <li>Process voice commands from Google Home and Amazon Alexa.</li>
            <li>Improve performance, security, and cloud service reliability.</li>
            <li>Provide prompt customer support.</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell or rent your personal information. We may share information only with trusted service providers (such as AWS cloud infrastructure) necessary to operate our services or when required by law.</p>

        <h2>4. Data Security</h2>
        <p>We protect your information using industry-standard security measures, including TLS/SSL encryption, secure cloud infrastructure, and access controls. While we work to protect your data, no method of transmission over the Internet is completely secure.</p>

        <h2>5. Data Retention</h2>
        <p>We retain your information only for as long as necessary to provide our services, comply with legal obligations, and maintain account functionality. You may request deletion of your account and associated data.</p>

        <h2>6. Children's Privacy</h2>
        <p>Our services are not intended for children under 13 years of age, and we do not knowingly collect personal information from children.</p>

        <h2>7. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date.</p>

        <h2>8. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us:</p>
        <ul>
            <li><b>Email:</b> <a href="mailto:support@4layers.in">support@4layers.in</a></li>
            <li><b>Website:</b> <a href="https://4layers.in" target="_blank">https://4layers.in</a></li>
        </ul>

        <div class="footer">
            &copy; 2026 4Layers. All rights reserved.
        </div>
    </div>
</body>
</html>"""

if __name__ == "__main__":
    import uvicorn
    # When run directly, start uvicorn server on port 8000
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

