import {
  ConnectClient,
  DescribeUserCommand,
  ListRoutingProfileQueuesCommand,
  DescribeQueueCommand,
  DescribePhoneNumberCommand,
  DescribeRoutingProfileCommand
} from "@aws-sdk/client-connect";
import { readFileSync } from 'fs';
import path from 'path';
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from "@aws-sdk/client-secrets-manager";

const filePath = path.join(process.cwd(), 'index.html');
const jsFilePath = path.join(process.cwd(), 'bundle.js');
const apiEndpoint = process.env.API_ENDPOINT;

let htmlContent = readFileSync(filePath, 'utf8');
const jsContent = readFileSync(jsFilePath, 'utf8');

const connect = new ConnectClient({ region: process.env.REGION });
const INSTANCE_ID = process.env.INSTANCE_ID;
const secret_name = process.env.SECRET_NAME;

const client = new ConnectClient();


const SecretClient = new SecretsManagerClient();

const styles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      place-items: center;
      overflow: scroll;
      margin: 0;
      
    }


    .container {
      backdrop-filter: blur(10px);
      border-radius: 20px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      position: relative;
      overflow: scroll;
    }

    .container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
    }

    h1 {
      color: #2d3748;
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 30px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    #loadingSpinner {
      display: none;
      position: relative;
      width: 60px;
      height: 60px;
      margin: 30px auto;
    }

    #loadingSpinner::after {
      content: '';
      position: absolute;
      width: 50px;
      height: 50px;
      border: 6px solid #e2e8f0;
      border-top: 6px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .radio-option {
      margin: 15px 0;
      padding: 10px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 2px solid transparent;
      border-radius: 12px;
      transition: all 0.3s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .radio-option.current {
      background: linear-gradient(135deg, #e8f5e8 0%, #f0f9f0 100%);
      border-color: #10b981;
    }

    .radio-option.default {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-color: #f59e0b;
    }

    .radio-option.no-number {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-color: #ef4444;
      opacity: 0.6;
      cursor: not-allowed;
    }

    .radio-option::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 1;
    }

    .radio-option:hover:not(.no-number) {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.2);
    }

    .radio-option:hover:not(.no-number)::before {
      opacity: 0.05;
    }

    .radio-option label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-size: 1.1rem;
      font-weight: 500;
      color: #2d3748;
      position: relative;
      z-index: 2;
    }

    .radio-option.no-number label {
      cursor: not-allowed;
      color: #9ca3af;
    }

    .radio-option input[type="radio"] {
      width: 20px;
      height: 20px;
      margin-right: 15px;
      accent-color: #667eea;
      cursor: pointer;
    }

    .radio-option.no-number input[type="radio"] {
      cursor: not-allowed;
    }

    .radio-option small {
      color: #64748b;
      font-weight: 400;
      margin-left: 10px;
    }

    .current-badge {
      background: #10b981;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 10px;
      text-transform: uppercase;
    }

    .default-badge {
      background: #f59e0b;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 10px;
      text-transform: uppercase;
    }

    .no-number-badge {
      background: #ef4444;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 10px;
      text-transform: uppercase;
    }

    .current-info {
      background: #e0f2fe;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      color: #0c4a6e;
    }

    #updateBtn {
      background: green;
      color: white;
      border: none;
      padding: 18px 40px;
      font-size: 1.1rem;
      font-weight: 600;
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      margin-top: 30px;
      position: relative;
      overflow: hidden;
    }

    #updateBtn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s ease;
    }

    #updateBtn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }

    #updateBtn:hover::before {
      left: 100%;
    }

    #updateBtn:active {
      transform: translateY(0);
    }

    .hidden {
      display: none;
    }

    #outboundForm {
      margin-top: 20px;
    }

    .fade-in {
      animation: fadeIn 0.6s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 600px) {
      .container {
        padding: 30px 20px;
        margin: 10px;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      .radio-option {
        padding: 15px;
      }
      
      #updateBtn {
        padding: 15px 30px;
        font-size: 1rem;
      }
    }
  </style>
`;

export const handler = async (event, context) => {
  console.log('event',JSON.stringify(event));
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;

 
  let secretResponse, username, password, API_BASE_URL ;

  try {
    secretResponse = await SecretClient.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
      })
    );
    const secret = JSON.parse(secretResponse.SecretString);
    username = secret.Username; 
    password = secret.Password;
    API_BASE_URL = secret.ApiUrl;
  } catch (error) {
    console.error("Error retrieving secret:", error);
    throw error;
  }
  const GET_CALLER_ID_ENDPOINT = `${API_BASE_URL}/config/agent/callerId`;
  const POST_CALLER_ID_ENDPOINT = `${API_BASE_URL}/config/agent/callerId`;

  const basicAuthHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  

  const scriptContent = `
    <script>
      async function sendRequest() {
        try {
          const response = await fetch("${apiEndpoint}", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Request bundle.js' }),
          });

          if (response.ok) {
            const jsContent = await response.text();
            const script = document.createElement('script');
            script.textContent = jsContent;
            document.body.appendChild(script);
          }
        } catch (error) {
          console.error('Fetch Error:', error);
        }
      }
      sendRequest();
    </script>
    <script id="agentDetailsScript">
      window.onload = function() {
        function checkAgentDetails() {
          if (window.agentDetails) {
            clearInterval(intervalId);
            const spinner = document.getElementById('loadingSpinner');
            if (spinner) spinner.style.display = 'block';
            const sendAgentRequest = async () => {
              const url = window.location.href;
              const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extension: window.agentDetails })
              });
              const html = await response.text();
              document.open();
              document.write(html);
              document.close();
              document.getElementById('results').classList.remove('hidden');
              const script = document.getElementById('agentDetailsScript');
              if (script) script.remove();
              const newSpinner = document.getElementById('loadingSpinner');
              if (newSpinner) newSpinner.style.display = 'none';
            }
            sendAgentRequest();
          }
        }
        const intervalId = setInterval(checkAgentDetails, 1000);
      };
    </script>`;

  try {
    if (httpMethod === "GET") {
      const modifiedHtmlContent = htmlContent.replace('<h1 class="Title"></h1>', `
        ${styles}
       
        <div class="container fade-in">
        
          <h1 class="Title">Agent Caller ID</h1>
          <div id="loadingSpinner"></div>
          ${scriptContent}
        </div>
      `);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: modifiedHtmlContent,
      };
    }

    if (httpMethod === "POST") {
      const { message, extension, agentDetails, selectedOutboundNumber } = JSON.parse(event.body || '{}');

      if (message) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/javascript' },
          body: jsContent,
        };
      }
      console.log("Received extension:", extension);

    
      if (extension) {
        const agentId = extension.split("/").pop();
        console.log("Agent ID:", agentId);

        if (!agentId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing agentId" }),
          };
        }

    
        let currentPhoneNumber = null;
        let defaultPhoneNumber = null;


        let FetchedNumberFromDB =false;

        try {
          console.log("URL:", `${GET_CALLER_ID_ENDPOINT}?agentArn=${agentId}`);
          const getResponse = await fetch(`${GET_CALLER_ID_ENDPOINT}?agentArn=${agentId}`, {
            method: 'GET',
            headers: {
              'Authorization': basicAuthHeader
            }
          });
      
          if (!getResponse.ok) {
            throw new Error(`GET request failed with status ${getResponse.status}`);
          }
      
          const data = await getResponse.json();
      
          if (data && data.outboundNumber) {
            currentPhoneNumber = data.outboundNumber;
            FetchedNumberFromDB = true;
            console.log("Fetched from API:", currentPhoneNumber);
          } else {
            console.log("No outboundNumber found for agent.");
          }
        } catch (error) {
          console.error("Error calling Sharecare GET API:", error);
          return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to fetch outbound caller ID from API" })
          };
        }
      
        
      
        const phoneNumbers = [];
        const processedQueues = new Set(); // To track unique queues by name

        try {
         
          const userResp = await connect.send(new DescribeUserCommand({
            InstanceId: INSTANCE_ID,
            UserId: agentId,
          }));
          const routingProfileId = userResp.User.RoutingProfileId;

    
          const queuesResp = await connect.send(new ListRoutingProfileQueuesCommand({
            InstanceId: INSTANCE_ID,
            RoutingProfileId: routingProfileId,
            MaxResults: 100,
          }));

          
          let isFirstQueue = true;
          
          for (const queueConfig of queuesResp.RoutingProfileQueueConfigSummaryList) {
            const queueDetails = await connect.send(new DescribeQueueCommand({
              InstanceId: INSTANCE_ID,
              QueueId: queueConfig.QueueId,
            }));

            const queueName = queueDetails.Queue.Name;
            
            // Check if queue has no name or doesn't start with "OB"
            if (!queueName || !queueName.startsWith("OB")) {
              console.log(`Skipping queue: ${queueName || 'No name'} - doesn't start with OB`);
              continue;
            }

            // Check if we've already processed this queue name
            if (processedQueues.has(queueName)) {
              console.log(`Skipping duplicate queue: ${queueName}`);
              continue;
            }

            // Mark this queue as processed
            processedQueues.add(queueName);

            const phoneId = queueDetails.Queue?.OutboundCallerConfig?.OutboundCallerIdNumberId;

            if (phoneId) {
              try {
                const phoneDetails = await connect.send(new DescribePhoneNumberCommand({
                  PhoneNumberId: phoneId,
                }));

                const phoneNumber = phoneDetails?.ClaimedPhoneNumberSummary?.PhoneNumber;
                
                if (phoneNumber) {
                  // Set first queue's phone number as default if no current number from DB
                  if (isFirstQueue && !currentPhoneNumber) {
                    defaultPhoneNumber = phoneNumber;
                  }
                  isFirstQueue = false;
                  
                  phoneNumbers.push({
                    queueName,
                    phoneNumber,
                    isCurrent: phoneNumber === currentPhoneNumber,
                    isDefault: !currentPhoneNumber && phoneNumber === defaultPhoneNumber,
                    hasNumber: true
                  });
                } else {
                  // Phone ID exists but no phone number found
                  phoneNumbers.push({
                    queueName,
                    phoneNumber: null,
                    isCurrent: false,
                    isDefault: false,
                    hasNumber: false
                  });
                }
              } catch (phoneError) {
                console.error(`Error fetching phone details for phoneId ${phoneId}:`, phoneError);
                // Add queue with no number if phone details fetch fails
                phoneNumbers.push({
                  queueName,
                  phoneNumber: null,
                  isCurrent: false,
                  isDefault: false,
                  hasNumber: false
                });
              }
            } else {
              // No phone ID configured for this queue
              phoneNumbers.push({
                queueName,
                phoneNumber: null,
                isCurrent: false,
                isDefault: false,
                hasNumber: false
              });
            }
          }
        } catch (err) {
          console.error("Error getting phone numbers:", err);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || "Failed to retrieve phone numbers" }),
          };
        }

        // Current caller ID info section
        let currentCallerIdInfo = '';
        if (currentPhoneNumber) {
          currentCallerIdInfo = `
            <div class="current-info">
              <strong>Current Caller ID:</strong> ${currentPhoneNumber}
            </div>
          `;
        } else if (defaultPhoneNumber) {
          currentCallerIdInfo = `
            <div class="current-info">
              <strong>Current Caller ID:</strong> ${defaultPhoneNumber} (Default)
            </div>
          `;
        }

        let radioOptionsHtml = "";
        for (const item of phoneNumbers) {
          if (item.hasNumber && item.phoneNumber) {
            const currentClass = item.isCurrent ? ' current' : (item.isDefault ? ' default' : '');
            const currentBadge = item.isCurrent ? '<span class="current-badge">Current</span>' : 
                               (item.isDefault ? '<span class="default-badge">Default</span>' : '');
            const checked = (item.isCurrent || item.isDefault) ? ' checked' : '';
            
            radioOptionsHtml += `
              <div class="radio-option${currentClass}">
                <label>
                  <input type="radio" name="OutboundNumber" value="${item.phoneNumber}"${checked}>
                  ${item.phoneNumber} <small>(Queue: ${item.queueName})</small>${currentBadge}
                </label>
              </div>`;
          } else {
            // Queue has no number attached
            radioOptionsHtml += `
              <div class="radio-option no-number">
                <label>
                  <input type="radio" name="OutboundNumber" value="" disabled>
                  No Number Attached <small>(Queue: ${item.queueName})</small><span class="no-number-badge">No Number</span>
                </label>
              </div>`;
          }
        }

        // If no queues with OB prefix found, show message
        if (phoneNumbers.length === 0) {
          radioOptionsHtml = `
            <div class="current-info">
              <strong>No queues found with names starting with "OB" in the routing profile.</strong>
            </div>
          `;
        }

const functionScriptContent = `<script>
  async function handleSubmit(event) {
    event.preventDefault();

    const agentDetails = window.agentDetails;
    const form = document.getElementById('outboundForm');
    const selectedValue = new FormData(form).get('OutboundNumber');

    if (!selectedValue || selectedValue === '') return alert('Please select a valid number');

    const spinner = document.getElementById('loadingSpinner');
    const success = document.getElementById('success-message');
    success.style.display= 'none';
    if (spinner) {
      spinner.style.display = 'block';
   
    }

    try {
      const response = await fetch("${apiEndpoint}", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentDetails, selectedOutboundNumber: selectedValue })
      });

      const result = await response.json();
      
      if (spinner) { 
        spinner.style.display = 'none';
        success.style.display= 'block';
        success.innerHTML = '<span style="color:green;">✅ Updated successfully</span>';
        
        // Update the current badges
        document.querySelectorAll('.radio-option').forEach(option => {
          option.classList.remove('current', 'default');
          const badges = option.querySelectorAll('.current-badge, .default-badge');
          badges.forEach(badge => badge.remove());
        });
        
        // Add current badge to newly selected option
        const selectedRadio = document.querySelector('input[name="OutboundNumber"]:checked');
        if (selectedRadio && selectedRadio.value !== '') {
          selectedRadio.checked = true; 
          const parentOption = selectedRadio.closest('.radio-option');
          parentOption.classList.add('current');
          const label = parentOption.querySelector('label');
          label.innerHTML += '<span class="current-badge">Current</span>';
          
          // Update current caller ID info
          const currentInfo = document.querySelector('.current-info');
          if (currentInfo) {
            currentInfo.innerHTML = '<strong>Current Caller ID:</strong> ' + selectedValue;
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong. Please try again.');
      if (spinner) spinner.innerHTML = '<span style="color:red;">❌ Update failed</span>';
    } 
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('outboundForm');
    if (form) form.addEventListener('submit', handleSubmit);
  });
</script>`;


        const responseHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Agent Caller ID</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>
            ${styles}
            <div id="head" class="head">
            <h1>OutBound Caller ID Management</h1>
            </div>

            
            <div class="container fade-in">
              <h2>Caller ID Options</h2>
              ${currentCallerIdInfo}
              <div id="results" class="hidden">
                <form id="outboundForm">
                  ${radioOptionsHtml}
                  ${phoneNumbers.length > 0 && phoneNumbers.some(item => item.hasNumber) ? '<button type="submit" id="updateBtn">Update Caller ID</button>' : ''}
                </form>
              </div>
              <div id="loadingSpinner"></div>
              <div id="success-message"></div>
            </div>
            ${functionScriptContent}
          </body>
          </html>
        `;

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html' },
          body: responseHtml,
        };
      }
      
      if (agentDetails && selectedOutboundNumber) {

        const agentId = agentDetails.split("/").pop();
        try {
          const postResponse = await fetch(POST_CALLER_ID_ENDPOINT, {
            method: "POST",
            headers: {
              "Authorization": basicAuthHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              agentArn: agentId,
              outboundNumber: selectedOutboundNumber
            })
          });
      
          if (!postResponse.ok) {
            const errorText = await postResponse.text();
            throw new Error(`POST failed with status ${postResponse.status}: ${errorText}`);
          }
      
          const result = await postResponse.json();
      
          console.log("POST API Response:", result);
      
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: "Outbound caller ID updated successfully via API",
              status: "success",
              number: selectedOutboundNumber
            }),
          };
      
        } catch (e) {
          console.log("Error in POST API:", e);
          return {
            statusCode: 500,
            body: JSON.stringify({
              message: "Failed to update outbound caller ID via API",
              error: e.message,
              status: "error",
            }),
          };
        }
      
      }

      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Invalid request parameters" }),
      };
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: "Method not allowed",
        detectedMethod: httpMethod,
      }),
    };
  } catch (error) {
    console.error("Error in Lambda handler:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message
      }),
    };
  }
};