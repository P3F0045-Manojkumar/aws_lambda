import boto3

def lambda_handler(event, context):
    pinpoint = boto3.client('pinpoint')
    
    app_id = 'b60f236639f44d4cb58e0a49f53f4cbc'
    phone_number = "+1509-618-0223"
    message = "Hii santhosh"

    response = pinpoint.send_messages(
        ApplicationId=app_id,
        MessageRequest={
            'Addresses': {
                phone_number: {
                    'ChannelType': 'SMS'
                }
            },
            'MessageConfiguration': {
                'SMSMessage': {
                    'Body': message,
                    'MessageType': 'TRANSACTIONAL',
                    # 'OriginationNumber': 'optional'  # Remove if not configured
                }
            }
        }
    )

    result = response['MessageResponse']['Result'][phone_number]
    
    if 'MessageId' in result:
        return {
            'statusCode': 200,
            'messageId': result['MessageId'],
            'status': result['DeliveryStatus']
        }
    else:
        return {
            'statusCode': 400,
            'error': result.get('StatusMessage', 'Unknown error'),
            'status': result.get('DeliveryStatus', 'Unknown')
        }
