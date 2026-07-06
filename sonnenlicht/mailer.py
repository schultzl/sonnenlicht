import os
import smtplib
from email.message import EmailMessage


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email via SMTP configured through environment variables.

    Without SMTP_HOST the mail is printed to stdout instead — dev fallback so
    the reset flow stays testable locally without a mail account.
    """
    host = os.environ.get("SMTP_HOST")
    if not host:
        print(f"[mailer] SMTP_HOST nicht gesetzt — E-Mail an {to} wird nur geloggt:")
        print(f"[mailer] Betreff: {subject}")
        print(body)
        return

    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    sender = os.environ.get("SMTP_FROM", user)

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    if port == 465:
        with smtplib.SMTP_SSL(host, port) as smtp:
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
