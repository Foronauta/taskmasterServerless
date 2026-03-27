import boto3
import os
import mimetypes
from html import escape

import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

ses = boto3.client("ses")
SENDER_EMAIL = os.environ["SENDER_EMAIL"]
RECIPIENT_EMAIL = os.environ["RECIPIENT_EMAIL"]


def _from_ddb_attr(attr):
    if not isinstance(attr, dict):
        return attr
    if "S" in attr:
        return attr["S"]
    if "N" in attr:
        number = attr["N"]
        return int(number) if number.isdigit() else float(number)
    if "BOOL" in attr:
        return attr["BOOL"]
    if "NULL" in attr:
        return None
    if "L" in attr:
        return [_from_ddb_attr(v) for v in attr["L"]]
    if "M" in attr:
        return {k: _from_ddb_attr(v) for k, v in attr["M"].items()}
    return ""


def _parse_new_image(new_image):
    return {key: _from_ddb_attr(value) for key, value in new_image.items()}


def _safe_str(value):
    return value if isinstance(value, str) else ""


def _safe_list(value):
    return value if isinstance(value, list) else []


def _safe_dict(value):
    return value if isinstance(value, dict) else {}


def _render_structured_details(task):
    lines = []
    base_fields = [
        ("Area/Sector", task.get("area") or _safe_dict(task.get("formData")).get("area", "")),
        ("Prioridad", task.get("priority") or _safe_dict(task.get("formData")).get("priority", "")),
        ("Tipo de pieza", task.get("pieceType") or _safe_dict(task.get("formData")).get("pieceType", "")),
        ("Canales", ", ".join(task.get("channels", [])) or ", ".join(_safe_list(_safe_dict(task.get("formData")).get("channels")))),
        ("Descripcion general", task.get("generalDescription") or _safe_dict(task.get("formData")).get("generalDescription", "")),
        ("Accion esperada", task.get("userAction") or _safe_dict(task.get("formData")).get("userAction", "")),
        ("Comentarios adicionales", task.get("additionalComments") or _safe_dict(task.get("formData")).get("additionalComments", "")),
    ]

    for label, value in base_fields:
        value = _safe_str(value)
        if value:
            lines.append(f"<p><strong>{escape(label)}:</strong> {escape(value)}</p>")

    conditional_data = task.get("conditionalData") or _safe_dict(task.get("formData")).get("conditionalData")
    conditional_data = _safe_dict(conditional_data)
    if conditional_data:
        lines.append("<p><strong>Datos condicionales:</strong></p><ul>")
        for key, value in conditional_data.items():
            lines.append(f"<li><strong>{escape(str(key))}:</strong> {escape(str(value))}</li>")
        lines.append("</ul>")

    return "".join(lines)


def _download_attachments(file_urls):
    attachments = []
    for idx, url in enumerate(file_urls):
        if not isinstance(url, str) or not url.startswith("http"):
            continue
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                continue

            guessed_type = mimetypes.guess_type(url)[0] or "application/octet-stream"
            main_type, sub_type = guessed_type.split("/", 1)
            ext = os.path.splitext(url.split("?")[0])[1] or ""

            attachments.append({
                "filename": f"file{idx + 1}{ext}",
                "data": resp.content,
                "main_type": main_type,
                "sub_type": sub_type,
                "content_type": guessed_type,
            })
        except Exception as ex:
            print(f"Error downloading file {url}: {ex}")
    return attachments


def _send_email(html_body, subject, attachments):
    if attachments:
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECIPIENT_EMAIL
        msg.attach(MIMEText(html_body, "html"))

        for att in attachments:
            part = MIMEBase(att["main_type"], att["sub_type"])
            part.set_payload(att["data"])
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename=\"{att['filename']}\"")
            part.add_header("Content-Type", att["content_type"])
            msg.attach(part)

        ses.send_raw_email(
            Source=SENDER_EMAIL,
            Destinations=[RECIPIENT_EMAIL],
            RawMessage={"Data": msg.as_string()}
        )
        return

    ses.send_email(
        Source=SENDER_EMAIL,
        Destination={"ToAddresses": [RECIPIENT_EMAIL]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Html": {"Data": html_body}}
        }
    )

def handler(event, context):
    for record in event["Records"]:
        if record["eventName"] == "INSERT":
            task = _parse_new_image(record["dynamodb"]["NewImage"])

            task_id = _safe_str(task.get("id"))
            description = _safe_str(task.get("description"))
            responsible = _safe_str(task.get("responsible"))
            due_date = _safe_str(task.get("dueDate")) or _safe_str(task.get("due_date"))
            notes = _safe_str(task.get("notes"))
            file_urls = _safe_list(task.get("files"))
            audio_url = _safe_str(task.get("audio"))
            if audio_url and audio_url not in file_urls:
                file_urls.append(audio_url)

            html_parts = [
                "<h2>Nueva tarea creada</h2>",
                f"<p><strong>ID:</strong> {escape(task_id)}</p>",
                f"<p><strong>Descripcion:</strong> {escape(description)}</p>",
                f"<p><strong>Solicitante:</strong> {escape(responsible)}</p>",
                f"<p><strong>Fecha solicitada:</strong> {escape(due_date)}</p>",
            ]

            structured_html = _render_structured_details(task)
            if structured_html:
                html_parts.append("<hr />")
                html_parts.append("<h3>Detalle del pedido</h3>")
                html_parts.append(structured_html)

            if notes:
                html_parts.append(f"<p><strong>Notas:</strong><br />{escape(notes).replace(chr(10), '<br />')}</p>")

            if file_urls:
                html_parts.append("<div><b>Archivos adjuntos:</b><ul>")
                for url in file_urls:
                    if any(url.lower().split("?")[0].endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
                        html_parts.append(f'<li><img src="{escape(url)}" width="200"/></li>')
                    elif any(url.lower().split("?")[0].endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".webm", ".m4a"]):
                        html_parts.append(f'<li><audio src="{escape(url)}" controls></audio></li>')
                    else:
                        html_parts.append(f'<li><a href="{escape(url)}">{escape(url)}</a></li>')
                html_parts.append("</ul></div>")

            subject = f"Nueva tarea: {description or task_id}"
            attachments = _download_attachments(file_urls)
            _send_email("".join(html_parts), subject, attachments)

    return {"statusCode": 200}
