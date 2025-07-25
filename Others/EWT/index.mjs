import { ConnectClient, GetMetricDataCommand } from "@aws-sdk/client-connect";

const connectClient = new ConnectClient({ region: "us-east-1" });

const hoursData = parseInt(process.env.HOURS || "2");
const instanceId = 'arn:aws:connect:us-east-1:798212935597:instance/19312662-e7bb-42fb-9f82-ffad5fef5ca1';

export const handler = async (event, context, callback) => {
	console.log('INPUT:', JSON.stringify(event));
	const result = {};
  const channel = event?.Details?.ContactData?.Channel;
  const queueARN = event?.Details?.ContactData?.Queue?.ARN;

	if (!queueARN || !channel) {
		return callback("Missing required parameters: queueARN or channel");
	}

	const queueId = getQueueId(queueARN);
	const queueAnswerTime = await getMetrics(queueId, hoursData, channel);

	result['QUEUE_ANSWER_TIME'] = queueAnswerTime;
	console.log('Result:', result);

  callback(null, { "EstimatedWaitTime": `${queueAnswerTime}` });
};

function getQueueId(queueARN) {
	const index = queueARN.lastIndexOf('/');
	return queueARN.substring(index + 1);
}

function getStartTime(hours) {
	const startDate = new Date();
	startDate.setMinutes(startDate.getMinutes() - (startDate.getMinutes() % 5));
	startDate.setHours(startDate.getHours() - hours);
	startDate.setSeconds(0);
	startDate.setMilliseconds(0);
	return startDate;
}

function getEndTime() {
	const endDate = new Date();
	endDate.setMinutes(endDate.getMinutes() - (endDate.getMinutes() % 5));
	endDate.setSeconds(0);
	endDate.setMilliseconds(0);
	return endDate;
}

async function getMetrics(queueId, hours, channel) {
	let queueAnswerTime = 1;

	const input = {
		InstanceId: instanceId,
		StartTime: getStartTime(hours),
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
		console.log("Sending GetMetricDataCommand:", input);
		const command = new GetMetricDataCommand(input);
		const response = await connectClient.send(command);

		const value = response?.MetricResults?.[0]?.Collections?.[0]?.Value;
		if (value != null) {
			queueAnswerTime = value > 60 ? Math.ceil(value / 60) : Math.ceil(value);
			console.log("QUEUE_ANSWER_TIME (raw):", value, "=> Rounded:", queueAnswerTime);
		}
	} catch (error) {
		console.error("Error fetching metrics:", error);
	}

	return queueAnswerTime;
}
