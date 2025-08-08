import {
  ConnectClient,
  UpdateContactAttributesCommand,
  DescribeContactCommand,
  DismissUserContactCommand
} from "@aws-sdk/client-connect";
import os
import {
  SNSClient,
  PublishCommand
} from "@aws-sdk/client-sns";

export const handler = async (event) => {
  console.log("Event: ", JSON.stringify(event));

  const viewResult = event.Details.Parameters.ViewData.Data;
  const relatedContactId = event.Details.ContactData.RelatedContactId;
  const instanceId = event.Details.ContactData.InstanceARN.split("/").pop();

  const snsArn = process.env.SNS_ARN;

  const connectClient = new ConnectClient();
  const snsClient = new SNSClient();

  const formattedData = {
    "Disposition": viewResult.Disposition[0]
  };

  console.log("Attribute JSON:", JSON.stringify(formattedData, null, 2));

  try {
    const updateInput = {
      InitialContactId: relatedContactId,
      InstanceId: instanceId,
      Attributes: formattedData,
    };

    const updateCommand = new UpdateContactAttributesCommand(updateInput);
    const updateAttributeResponse = await connectClient.send(updateCommand);
    console.log("Update Attributes Response:", updateAttributeResponse);
  } catch (err) {
    console.error("Failed to update contact attributes:", err);
  }

  try {
    const messagePayload = {
      ContactId: relatedContactId,
      InstanceId: instanceId,
      Disposition: viewResult.Disposition[0],
      Timestamp: new Date().toISOString()
    };

    const publishCommand = new PublishCommand({
      TopicArn: snsArn,
      Message: JSON.stringify(messagePayload),
      Subject: "Disposition Update"
    });

    const publishResponse = await snsClient.send(publishCommand);
    console.log("SNS Publish Response:", publishResponse);
  } catch (err) {
    console.error("Failed to publish disposition to SNS:", err);
  }

  // ---------- Getting Agent Info via DescribeContact ----------
  let agentUserId = null;

  try {
    const describeInput = {
      ContactId: relatedContactId,
      InstanceId: instanceId,
    };

    const describeCommand = new DescribeContactCommand(describeInput);
    const describeResponse = await connectClient.send(describeCommand);

    console.log("Describe Contact Response:", JSON.stringify(describeResponse, null, 2));

    agentUserId = describeResponse?.Contact?.AgentInfo?.Id;
    console.log("Agent User ID:", agentUserId);

  } catch (err) {
    console.error("Failed to describe contact:", err);
  }

  // --------- Dismiss Contact if agentUserId is available ----------
  if (agentUserId) {
    const dismissInput = {
      UserId: agentUserId,
      InstanceId: instanceId,
      ContactId: relatedContactId,
    };

    try {
      const dismissCommand = new DismissUserContactCommand(dismissInput);
      const dismissResponse = await connectClient.send(dismissCommand);
      console.log("Dismiss Response:", dismissResponse);
    } catch (err) {
      if (
        err.name === "InvalidRequestException" &&
        err.message?.includes("Contact cannot be dismissed")
      ) {
        console.warn("Skipping dismissal: Contact is in a state that cannot be dismissed.");
        return {
          OnContact: "YES"
        };
      } else {
        console.error("Error dismissing contact:", err);
        return {
          OnContact: "YES"  // Unexpected error — assume contact might be active
        };
      }
    }
  }

  // ---------- Return Final Response ----------
  return {
    statusCode: 200,
    OnContact: "NO",
    body: JSON.stringify("Attributes assigned, disposition published to SNS, and contact dismissed (if allowed)."),
  };
};
