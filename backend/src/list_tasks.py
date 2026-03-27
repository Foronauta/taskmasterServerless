import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


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
            "body": json.dumps(tasks)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": _cors_headers(),
            "body": json.dumps({"error": str(e)})
        }
