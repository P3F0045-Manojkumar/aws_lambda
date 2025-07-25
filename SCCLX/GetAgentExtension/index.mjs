import { ConnectClient, ListUsersCommand, ListTagsForResourceCommand } from "@aws-sdk/client-connect";

const region=process.env.REGION;

const connectClient = new ConnectClient({ region: region }); 

const INSTANCE_ID = process.env.INSTANCE_ID;

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  try {
    const extension = event?.Details?.ContactData?.Attributes?.Extension;

    if (!extension) {
      throw new Error("Extension attribute missing in contact data");
    }

    // List all users
    const users = [];
    let nextToken;

    do {
      const listUsersResponse = await connectClient.send(
        new ListUsersCommand({
          InstanceId: INSTANCE_ID,
          NextToken: nextToken,
          MaxResults: 100,
        })
      );

      users.push(...(listUsersResponse?.UserSummaryList || []));
      nextToken = listUsersResponse?.NextToken;
    } while (nextToken);

    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      console.log("User:", JSON.stringify(user));
      const tagResponse = await connectClient.send(
        new ListTagsForResourceCommand({
          resourceArn: user.Arn,
        })
      );

      const tags = tagResponse?.tags || {};
      console.log("Tag Response:",JSON.stringify(tagResponse.tags));
      if (tags.Extension === extension) {
        console.log(`Matched agent: ${user.Username} with extension ${extension}`);
        return {
          statusCode: 200,
          Username: user.Username
        };
      }
    }

    return {
      statusCode: 400,
      errorMessage: `No agent found with extension ${extension}`,
    };
  } catch (err) {
    console.error("Error occurred:", err);
    return {
      statusCode: 500,
      errorMessage: err.message || "Internal error",
    };
  }
};
