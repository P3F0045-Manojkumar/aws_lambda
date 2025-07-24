import boto3
import ossdf
import jsonssssssh
import time
connect = boto3.client('connect')
INSTANCE_ID = os.environ['INSTANCE_ID']

def lambda_handler(event, context):
    print("event",event)
    try:
        uid = eventuid = event['Details']['Parameters']['UID']
        print(f"Searching for user with tag UID = {uid}")

        response = connect.search_users(
            InstanceId=INSTANCE_ID,
            SearchFilter={
                "TagFilter": {
                    "TagCondition": {
                        "TagKey": "UID",
                        "TagValue": uid
                    }
                }
            }
        )

        users = response.get('Users', [])
        if users:
            user = users[0]
            agent_arn = user['Arn']
            agent_id = user['Id']
            return {
                'statusCode': 200,
                'agentId': agent_id,
                'agentArn': agent_arn,
                'message': f"Agent with UID tag {uid} found"
            }
        else:
            return {
                'statusCode': 404,
                'message': f"No agent found with UID tag = {uid}"
            }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'message': str(e)
        }
