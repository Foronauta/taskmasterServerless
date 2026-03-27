import json
import boto3
import os
import uuid
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def _safe_str(value):
    return value if isinstance(value, str) else ""


def _safe_list(value):
    return value if isinstance(value, list) else []


def _safe_dict(value):
    return value if isinstance(value, dict) else {}


def _build_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
    }

def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        form_data = _safe_dict(body.get("formData"))

        full_name = _safe_str(body.get("responsible")) or _safe_str(form_data.get("fullName"))
        area = _safe_str(body.get("area")) or _safe_str(form_data.get("area"))
        due_date = _safe_str(body.get("dueDate")) or _safe_str(form_data.get("dueDate"))
        priority = _safe_str(body.get("priority")) or _safe_str(form_data.get("priority")) or "Normal"
        piece_type = _safe_str(body.get("pieceType")) or _safe_str(form_data.get("pieceType"))
        channels = _safe_list(body.get("channels")) or _safe_list(form_data.get("channels"))
        general_description = _safe_str(body.get("generalDescription")) or _safe_str(form_data.get("generalDescription"))
        user_action = _safe_str(body.get("userAction")) or _safe_str(form_data.get("userAction"))
        additional_comments = _safe_str(body.get("additionalComments")) or _safe_str(form_data.get("additionalComments"))
        conditional_data = _safe_dict(body.get("conditionalData")) or _safe_dict(form_data.get("conditionalData"))

        description = _safe_str(body.get("description"))
        if not description:
            description = f"{piece_type} - {general_description}".strip(" -")

        task_item = {
            "id": str(uuid.uuid4()),
            "schemaVersion": 2,
            "description": description,
            "responsible": full_name,
            "area": area,
            "dueDate": due_date,
            "priority": priority,
            "pieceType": piece_type,
            "channels": channels,
            "generalDescription": general_description,
            "userAction": user_action,
            "additionalComments": additional_comments,
            "conditionalData": conditional_data,
            "notes": _safe_str(body.get("notes")),
            "files": _safe_list(body.get("files")),
            "audio": _safe_str(body.get("audio")),
            "formData": form_data,
            "completed": False,
            "canceled": False,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }

        table.put_item(Item=task_item)

        return {
            "statusCode": 201,
            "headers": _build_cors_headers(),
            "body": json.dumps(task_item, cls=_DecimalEncoder)
        }
    except Exception as e:
        print(f"Error creating task: {e}")
        return {
            "statusCode": 500,
            "headers": _build_cors_headers(),
            "body": json.dumps({"error": "Failed to create task"})
        }
