import json
import boto3
import csv
import os
from datetime import datetime
import csv
kjasbdliuasgdliuyawgiuawdiuaswhdusahduasnda

sqs = boto3.client('sqs')

QUEUE_URL = os.environ['SQS_QUEUE_URL']  

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    print("Event: ",event)    
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    # bucket = os.environ['BUCKET_NAME']   ertgwegtw4thw4h6tageatgr5
    # key = "previewCampaignData.csv"
    # purgeQueue = sqs.purge_queue(QueueUrl=QUEUE_URL)    

    response = s3.get_object(Bucket=bucket, Key=key)
    lines = response['Body'].read().decode('utf-8-sig').splitlines()
    print(f"Total lines read: {len(lines)}")

    reader = csv.reader(lines)

    headers = next(reader)

    batch = []
    batch_size = 10
    counter = 0

    for row in reader:        
        # message_body = ','.join(row)
        # sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=message_body)
        dedup_id = datetime.now().strftime("%d%m%Y%H%M%S")
        message_body = {headers[i]: row[i] for i in range(len(headers))}
        message_body["fileName"] = key
        message_body_json = json.dumps(message_body)
        batch.append({
            'Id': str(str(counter)+"-"+dedup_id),
            'MessageBody': message_body_json,
            # 'MessageGroupId': f'group{counter}',
            'MessageGroupId': 'campaign-group',
            'MessageDeduplicationId': str(str(counter)+"-"+dedup_id)
        })
        counter += 1
        print(counter)
        if len(batch) == batch_size:
            sqs.send_message_batch(QueueUrl=QUEUE_URL, Entries=batch)
            batch = []
    if batch:
        print(batch)
        try:
            sqs.send_message_batch(QueueUrl=QUEUE_URL, Entries=batch)
            print("Queues create successfully")
        except Exception as e:
            print(e)

    return {"status": "Messages sent to SQS"}



