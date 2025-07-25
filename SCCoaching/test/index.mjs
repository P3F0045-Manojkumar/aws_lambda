import JSON
import os
export const handler = async (event) => {
  // TODO implement
  console.log(" asdsdaff update from local 7")
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};
