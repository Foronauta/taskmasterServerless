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

# ─── DynamoDB stream deserializer ─────────────────────────────────────────────

def _from_ddb_attr(attr):
    if not isinstance(attr, dict):
        return attr
    if "S" in attr:
        return attr["S"]
    if "N" in attr:
        number = attr["N"]
        return int(number) if number.lstrip("-").isdigit() else float(number)
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


# ─── Safe helpers ─────────────────────────────────────────────────────────────

def _safe_str(value):
    return value if isinstance(value, str) else ""


def _safe_list(value):
    return value if isinstance(value, list) else []


def _safe_dict(value):
    return value if isinstance(value, dict) else {}


# ─── Conditional data label mapping ──────────────────────────────────────────

_FIELD_LABELS = {
    "title": "Título",
    "journeyType": "Tipo de jornada",
    "speakers": "Disertante/s",
    "modality": "Modalidad",
    "place": "Lugar",
    "schedule": "Horario",
    "featuredProduct": "Producto a destacar",
    "brands": "Marcas a incluir",
    "topic": "Tema / producto a destacar",
    "slidesCount": "Cantidad de placas",
    "mandatoryTexts": "Textos imprescindibles",
    "product": "Producto",
    "keyFeatures": "Características a destacar",
    "price": "Precio",
    "validity": "Vigencia de la oferta",
    "format": "Formato",
    "estimatedDuration": "Duración estimada",
    "mainMessage": "Mensaje principal",
    "event": "Evento / producto",
    "date": "Fecha",
    "dimensions": "Medidas",
    "brand": "Marca",
    "highlightedContent": "Contenido / producto a destacar",
    "measure": "Medida",
    "content": "Contenido a incluir",
    "detailedRequest": "Descripción detallada",
    "message": "Instrucción",
}

# ─── HTML email builder ───────────────────────────────────────────────────────

_HTML_STYLE = """
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
  .wrapper { max-width: 640px; margin: 32px auto; background: #ffffff; border-radius: 10px;
             box-shadow: 0 2px 8px rgba(0,0,0,0.10); overflow: hidden; }
  .header { background: #1a3f6f; padding: 24px 32px; }
  .header h1 { color: #ffffff; margin: 0; font-size: 20px; }
  .header p { color: #a8c4e0; margin: 6px 0 0; font-size: 13px; }
  .section { padding: 20px 32px; border-bottom: 1px solid #e8ecf2; }
  .section:last-child { border-bottom: none; }
  .section h2 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase;
                letter-spacing: .07em; color: #1a3f6f; }
  .field { display: flex; gap: 10px; margin-bottom: 8px; font-size: 14px; line-height: 1.5; }
  .field .label { min-width: 190px; font-weight: bold; color: #374151; flex-shrink: 0; }
  .field .value { color: #1f2937; }
  .badge { display: inline-block; background: #e8f0fe; color: #1a3f6f;
           border-radius: 999px; font-size: 12px; font-weight: bold;
           padding: 3px 10px; margin: 2px 3px 2px 0; }
  .badge.urgente { background: #fde8e8; color: #b91c1c; }
  .file-list { list-style: none; padding: 0; margin: 8px 0 0; }
  .file-list li { margin-bottom: 10px; font-size: 14px; }
  .file-list img { max-width: 220px; border-radius: 6px; border: 1px solid #ddd;
                   display: block; margin-top: 4px; }
  .file-list a { color: #1a3f6f; word-break: break-all; }
  .footer { padding: 16px 32px; background: #f4f6f9; font-size: 12px;
            color: #9ca3af; text-align: center; }
</style>
"""


def _row(label, value):
    if not value:
        return ""
    return (
        f'<div class="field">'
        f'<span class="label">{escape(label)}</span>'
        f'<span class="value">{escape(str(value))}</span>'
        f'</div>'
    )


def _build_html(task):
    responsible = _safe_str(task.get("responsible"))
    area = _safe_str(task.get("area"))
    due_date = _safe_str(task.get("dueDate")) or _safe_str(task.get("due_date"))
    priority = _safe_str(task.get("priority")) or "Normal"
    piece_type = _safe_str(task.get("pieceType"))
    channels = _safe_list(task.get("channels"))
    general_description = _safe_str(task.get("generalDescription"))
    user_action = _safe_str(task.get("userAction"))
    additional_comments = _safe_str(task.get("additionalComments"))
    conditional_data = _safe_dict(task.get("conditionalData"))
    file_urls = _safe_list(task.get("files"))
    audio_url = _safe_str(task.get("audio"))

    priority_class = "urgente" if priority.lower() == "urgente" else ""
    channels_html = (
        "".join(f'<span class="badge">{escape(c)}</span>' for c in channels)
        if channels else "—"
    )

    general_section = f"""
    <div class="section">
      <h2>Datos del solicitante</h2>
      {_row("Nombre y apellido", responsible)}
      {_row("Área / Sector", area)}
      {_row("Fecha de entrega solicitada", due_date)}
      <div class="field">
        <span class="label">Prioridad</span>
        <span class="value"><span class="badge {priority_class}">{escape(priority)}</span></span>
      </div>
    </div>"""

    cond_rows = "".join(
        _row(_FIELD_LABELS.get(k, k), v)
        for k, v in conditional_data.items()
        if v
    )
    piece_section = f"""
    <div class="section">
      <h2>Tipo de pieza</h2>
      {_row("Tipo", piece_type)}
      {cond_rows}
    </div>""" if piece_type else ""

    info_section = f"""
    <div class="section">
      <h2>Información base</h2>
      <div class="field">
        <span class="label">Canales de publicación</span>
        <span class="value">{channels_html}</span>
      </div>
      {_row("Descripción general del pedido", general_description)}
      {_row("Acción esperada del usuario", user_action)}
      {_row("Comentarios adicionales", additional_comments)}
    </div>"""

    file_items = ""
    for idx, url in enumerate(file_urls):
        url_clean = url.split("?")[0].lower()
        if any(url_clean.endswith(e) for e in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
            file_items += f'<li>🖼️ Imagen {idx+1}<br><img src="{escape(url)}" alt="Adjunto {idx+1}" /></li>'
        elif any(url_clean.endswith(e) for e in [".mp3", ".wav", ".ogg", ".webm", ".m4a"]):
            file_items += f'<li>🎙️ <a href="{escape(url)}">Nota de voz {idx+1}</a></li>'
        else:
            file_items += f'<li>📄 <a href="{escape(url)}">Archivo {idx+1}</a></li>'

    if audio_url and audio_url not in file_urls:
        file_items += f'<li>🎙️ <a href="{escape(audio_url)}">Nota de voz</a></li>'

    files_section = f"""
    <div class="section">
      <h2>Archivos adjuntos</h2>
      <ul class="file-list">{file_items}</ul>
    </div>""" if file_items else ""

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8">{_HTML_STYLE}</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Nuevo pedido de diseño / contenido</h1>
    <p>{escape(piece_type or "Sin tipo")} — solicitado por {escape(responsible)}</p>
  </div>
  {general_section}
  {piece_section}
  {info_section}
  {files_section}
  <div class="footer">Este correo fue generado automáticamente. No responder a este mensaje.</div>
</div>
</body>
</html>"""


# ─── Attachment downloader ────────────────────────────────────────────────────

def _download_attachments(file_urls, audio_url):
    all_urls = list(file_urls)
    if audio_url and audio_url not in all_urls:
        all_urls.append(audio_url)

    attachments = []
    for idx, url in enumerate(all_urls):
        if not isinstance(url, str) or not url.startswith("http"):
            continue
        try:
            resp = requests.get(url, timeout=20)
            if resp.status_code != 200:
                print(f"Skipping {url}: HTTP {resp.status_code}")
                continue

            guessed_type = mimetypes.guess_type(url.split("?")[0])[0] or "application/octet-stream"
            main_type, sub_type = guessed_type.split("/", 1)
            ext = os.path.splitext(url.split("?")[0])[1] or ""

            is_audio = url == audio_url or any(
                url.split("?")[0].lower().endswith(e) for e in [".mp3", ".wav", ".ogg", ".webm", ".m4a"]
            )
            filename = f"nota-de-voz{ext}" if is_audio else f"adjunto-{idx + 1}{ext}"

            attachments.append({
                "filename": filename,
                "data": resp.content,
                "main_type": main_type,
                "sub_type": sub_type,
                "content_type": guessed_type,
            })
        except Exception as ex:
            print(f"Error downloading {url}: {ex}")

    return attachments


# ─── Email sender ─────────────────────────────────────────────────────────────

def _send_email(html_body, subject, attachments):
    if attachments:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = RECIPIENT_EMAIL

        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(alt)

        for att in attachments:
            part = MIMEBase(att["main_type"], att["sub_type"])
            part.set_payload(att["data"])
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{att["filename"]}"')
            part.add_header("Content-Type", att["content_type"])
            msg.attach(part)

        ses.send_raw_email(
            Source=SENDER_EMAIL,
            Destinations=[RECIPIENT_EMAIL],
            RawMessage={"Data": msg.as_string()},
        )
        return

    ses.send_email(
        Source=SENDER_EMAIL,
        Destination={"ToAddresses": [RECIPIENT_EMAIL]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Html": {"Data": html_body}},
        },
    )


# ─── Lambda handler ───────────────────────────────────────────────────────────

def handler(event, context):
    for record in event["Records"]:
        if record["eventName"] != "INSERT":
            continue

        task = _parse_new_image(record["dynamodb"]["NewImage"])

        responsible = _safe_str(task.get("responsible"))
        piece_type = _safe_str(task.get("pieceType"))
        description = _safe_str(task.get("description"))
        file_urls = _safe_list(task.get("files"))
        audio_url = _safe_str(task.get("audio"))

        subject_label = piece_type or description or _safe_str(task.get("id"))
        subject = f"Nuevo pedido: {subject_label} — {responsible}"

        html_body = _build_html(task)
        attachments = _download_attachments(file_urls, audio_url)

        try:
            _send_email(html_body, subject, attachments)
            print(f"Email sent for task {task.get('id')}")
        except Exception as ex:
            print(f"Error sending email for task {task.get('id')}: {ex}")
            raise

    return {"statusCode": 200}
