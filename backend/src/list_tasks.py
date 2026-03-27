import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            # preserve ints as ints, floats as floats
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    }


def handler(event, context):
    try:
        tasks = []
        scan_kwargs = {}

        while True:
            response = table.scan(**scan_kwargs)
            tasks.extend(response.get("Items", []))

            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

        tasks.sort(key=lambda item: item.get("createdAt", ""), reverse=True)

        return {
            "statusCode": 200,
            "headers": _cors_headers(),
            "body": json.dumps(tasks, cls=_DecimalEncoder)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": _cors_headers(),
            "body": json.dumps({"error": str(e)})
        }
