import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger("Emailer")

SMTP_HOST = os.getenv("SMTP_HOST", "mail.4layers.in")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "invites@4layers.in")
SMTP_PASS = os.getenv("SMTP_PASS", "qbwF8zyXtCKcmzvFeSsn")

def send_invitation_email(to_email: str, inviter_name: str, node_id: str) -> bool:
    """
    Sends an invitation email to a non-existing user using SMTP credentials.
    Catches all exceptions so the API does not fail or crash.
    """
    try:
        subject = "Invitation to join 4layers Smart Home"
        
        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #0e0e0e; color: #ffffff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #1c1b1b; padding: 30px; border-radius: 12px; border: 1px solid #333;">
              <h2 style="color: #22c55e;">4layers Smart Home Invitation</h2>
              <p>Hello,</p>
              <p><strong>{inviter_name}</strong> has invited you to control and share smart devices on <strong>4layers</strong> (Node ID: <code>{node_id}</code>).</p>
              <p>Download the 4layers app and register with this email (<strong>{to_email}</strong>) to instantly get access to your family's smart home devices!</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; font-size: 12px; color: #888;">
                &copy; 4layers Smart Home Automation. Sent via invites@4layers.in.
              </div>
            </div>
          </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email

        part_html = MIMEText(html_content, "html")
        msg.attach(part_html)

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()

        logger.info(f"[Emailer] Invitation email successfully sent to {to_email}")
        print(f"[Emailer] SUCCESS: Invitation email sent to {to_email}")
        return True
    except Exception as e:
        import traceback
        err_detail = traceback.format_exc()
        logger.error(f"[Emailer] Failed to send invitation email to {to_email}: {e}\n{err_detail}")
        print(f"[Emailer] SMTP ERROR for {to_email}: {e}\n{err_detail}")
        return False
