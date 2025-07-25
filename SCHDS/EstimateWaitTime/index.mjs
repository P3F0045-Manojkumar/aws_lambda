import { ConnectClient, GetMetricDataCommand } from "@aws-sdk/client-connect";

const connect = new ConnectClient({ region: "us-east-1" });

export const handler = async (event, context, callback) => {
    console.log('INPUT:', JSON.stringify(event));
    const result = {};

    const instanceId = event?.Details?.Parameters?.instanceId;
    const queueARN = event?.Details?.Parameters?.queueARN;
    const channel = event?.Details?.Parameters?.channel;
    const hoursData = parseInt(event?.Details?.Parameters?.hours || "2");

    if (!instanceId || !queueARN || !channel) {
        return callback("Missing required parameters: instanceId, queueARN, or channel");
    }

    const queueId = getQueueId(queueARN);
    const queueAnswerTime = await getMetrics(instanceId, queueId, hoursData, channel);

    result['QUEUE_ANSWER_TIME'] = queueAnswerTime;
    console.log('Result:', result);

    return callback(null, result);
};

function getQueueId(queueARN) {
    return queueARN.substring(queueARN.lastIndexOf('/') + 1);
}

function getStartTime(hours) {
    const start = new Date();
    start.setMinutes(start.getMinutes() - start.getMinutes() % 5);
    start.setHours(start.getHours() - hours);
    start.setSeconds(0);
    start.setMilliseconds(0);
    return start;
}

function getEndTime() {
    const end = new Date();
    end.setMinutes(end.getMinutes() - end.getMinutes() % 5);
    end.setSeconds(0);
    end.setMilliseconds(0);
    return end;
}

async function getMetrics(instanceId, queueId, hoursData, channel) {
    let queueAnswerTime = 1;

    const input = {
        InstanceId: instanceId,
        StartTime: getStartTime(hoursData),
        EndTime: getEndTime(),
        Filters: {
            Queues: [queueId]
        },
        HistoricalMetrics: [
            {
                Name: 'QUEUE_ANSWER_TIME',
                Statistic: 'AVG',
                Unit: 'SECONDS'
            }
        ],
        Groupings: ['QUEUE']
    };

    try {
        const command = new GetMetricDataCommand(input);
        const response = await connect.send(command);

        console.log('Metric Response:', JSON.stringify(response));

        const value = response?.MetricResults?.[0]?.Collections?.[0]?.Value;
        if (value != null) {
            queueAnswerTime = value > 60 ? Math.ceil(value / 60) : Math.ceil(value);
        }
    } catch (err) {
        console.error("Error fetching metrics:", err);
    }

    return queueAnswerTime;
}
