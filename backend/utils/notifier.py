import json
import urllib.request
import logging

logger = logging.getLogger("Notifier")

def send_expo_push_notification(push_token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Sends a push notification to an Expo Push Token via Expo API.
    Catches all exceptions so backend execution never fails.
    """
    if not push_token or not push_token.startswith("ExponentPushToken"):
        logger.warning(f"[Notifier] Invalid push token format: {push_token}")
        return False

    try:
        payload = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high",
            "data": data or {}
        }

        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://exp.host/--/api/v2/push/send",
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            resp_str = resp.read().decode("utf-8")
            logger.info(f"[Notifier] Push notification sent successfully to {push_token}: {resp_str}")
            print(f"[Notifier] SUCCESS: Push notification sent to {push_token}")
            return True

    except Exception as e:
        logger.error(f"[Notifier] Failed to send push notification to {push_token}: {e}")
        print(f"[Notifier] ERROR: Push notification failed: {e}")
        return False
