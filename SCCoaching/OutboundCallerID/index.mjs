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
// import fetch from 'node-fetch'; // Must be bundled with Lambda deployment

const instanceID = process.env.INSTANCE_ID;
const secret_name = process.env.SECRET_NAME;

const client = new ConnectClient();

const SecretClient = new SecretsManagerClient();

export const handler = async (event) => {

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
  
  const filePath = path.join(process.cwd(), 'index.html');
  const jsFilePath = path.join(process.cwd(), 'bundle.js');
  const apiEndpoint =  process.env.API_ENDPOINT;

  let htmlContent = readFileSync(filePath, 'utf8');
  const jsContent = readFileSync(jsFilePath, 'utf8');
  let currentOutboundCallerID; 

  const scriptContent = `
    <script>
        async function sendRequest() {
          try {
            console.log("Trying API");
            const response = await fetch("${apiEndpoint}", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ message: 'Request bundle.js' }),
            });

            if (response.ok) {
              console.log("Response received API");
              const jsContent = await response.text();
              const script = document.createElement('script');
              script.textContent = jsContent;
              document.body.appendChild(script);
              console.log('JavaScript from Lambda has been executed');
            } else {
              console.log("Response error API");
              console.error('Error:', response.statusText);
            }
          } catch (error) {
            console.log("Response error API outer branch");
            console.error('Fetch Error:', error);
          }
        }

        sendRequest();
    </script>
    <script id="agentDetailsScript">
        window.onload = function() {
            function checkAgentDetails() {
                console.log("Looking for Agent Details");
                if (window.agentDetails) {
                    console.log('Agent details found in window:', window.agentDetails);
                    clearInterval(intervalId);
                    
                    // Show loading spinner while fetching data
                    const spinner = document.getElementById('loadingSpinner');
                    if (spinner) spinner.style.display = 'block';
                
                    const sendAgentRequest = async () => {
                        const url = window.location.href;
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                extension: window.agentDetails
                            })
                        });
                        console.log("RESPONSE:", response);
                        const html = await response.text();
                        console.log("HTML:", html);
                        document.open();
                        document.write(html);
                        document.close();
                        document.getElementById('results').classList.remove('hidden');
                        const script = document.getElementById('agentDetailsScript');
                        if (script) {
                            script.remove();
                        }
                        
                        // Hide spinner after content is loaded
                        const newSpinner = document.getElementById('loadingSpinner');
                        if (newSpinner) newSpinner.style.display = 'none';
                    }
                    sendAgentRequest();
                } else {
                    console.log('Agent details not found yet...');
                }
            }

            const intervalId = setInterval(checkAgentDetails, 1000);
        };
    </script>`;


  console.log("event", JSON.stringify(event));

  if (event.httpMethod === "GET") {
    // Modify the HTML to include loading spinner and improved styles
    htmlContent = htmlContent.replace('<h1 class="Title"></h1>', `
      <h1 class="Title"></h1>
      <div id="loadingSpinner"></div>
      ${scriptContent}
    `);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: htmlContent,
    };
  } else if (event.httpMethod === "POST") {
  const { message, extension, agentDetails, selectedOutboundNumber } = JSON.parse(event.body);
  console.log("message", message);
  console.log("extension", extension);
  console.log("agentDetails", agentDetails);
  console.log("selectedOutboundNumber", selectedOutboundNumber);

  if (message) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/javascript',
      },
      body: jsContent,
    };
  }

  // Retrieve agent info by extension
  else if (extension) {
    const functionScriptContent = `<script>
    async function handleSubmit(event) {
      event.preventDefault();
      try {
        const agentDetails = window.agentDetails;
        console.log("Submitting form", agentDetails);

        const form = document.getElementById('outboundForm');
        const formData = new FormData(form);
        const selectedValue = formData.get('OutboundNumber');
        
        if (!selectedValue) {
          showNotification('Please select a caller ID before updating.', 'error');
          return;
        }
        
        // Show loading spinner
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = 'flex';
        
        const updateBtn = document.getElementById('updateBtn');
        if (updateBtn) updateBtn.disabled = true;

        // Prepare the payload
        const payload = {
          agentDetails,
          selectedOutboundNumber: selectedValue,
        };

        try {
          const response = await fetch("${apiEndpoint}", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          
          // Hide loading spinner and re-enable button
          if (spinner) spinner.style.display = 'none';
          if (updateBtn) updateBtn.disabled = false;

          if (response.ok) {
            const result = await response.json();
            console.log('Successful response:', result);
            
            if(result.status === "success"){
              showNotification('Caller ID updated successfully!', 'success');
              
              // Update the current caller ID display
              const highlightSpan = document.querySelector('.current-id .highlight');
              if (highlightSpan) {
                highlightSpan.textContent = result.number;
              }
              
              // Update radio buttons and styling
              const radioOptions = document.querySelectorAll('.radio-option');
              radioOptions.forEach(option => {
                const input = option.querySelector('input[type="radio"]');
                const badge = option.querySelector('.current-badge');
                
                if (input && input.value === result.number) {
                  input.checked = true;
                  option.classList.add('selected');
                  
                  // Add current badge if not exists
                  if (!badge) {
                    const label = option.querySelector('label');
                    const badgeDiv = document.createElement('div');
                    badgeDiv.className = 'current-badge';
                    badgeDiv.textContent = 'Current';
                    label.appendChild(badgeDiv);
                  }
                } else {
                  input.checked = false;
                  option.classList.remove('selected');
                  
                  // Remove current badge if exists
                  if (badge) {
                    badge.remove();
                  }
                }
              });
            } else {
              showNotification('Update failed: ' + (result.message || 'Unknown error'), 'error');
            }
          } else {
            showNotification('Server error: ' + response.statusText, 'error');
            console.error('Error:', response.statusText);
          }
        } catch (fetchError) {
          if (spinner) spinner.style.display = 'none';
          if (updateBtn) updateBtn.disabled = false;
          showNotification('Connection error. Please try again.', 'error');
          console.error('Error during fetch:', fetchError);
        }
      } catch (error) {
        console.error('Error in handleSubmit function:', error);
        showNotification('An unexpected error occurred.', 'error');
      }
    }

    function showNotification(message, type) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'notification notification-' + type;
      
      // Add icon based on notification type
      const iconSpan = document.createElement('span');
      iconSpan.className = 'notification-icon';
      iconSpan.textContent = type === 'success' ? '✓' : '⚠️';
      notification.appendChild(iconSpan);
      
      // Add message text
      const messageSpan = document.createElement('span');
      messageSpan.textContent = message;
      notification.appendChild(messageSpan);
      
      // Append the notification to the body
      document.body.appendChild(notification);
      
      // Remove the notification after 4 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 4000);
    }

    // Add event listeners to radio options for better UX
    document.addEventListener('DOMContentLoaded', function() {
      const radioOptions = document.querySelectorAll('.radio-option');
      
      radioOptions.forEach(option => {
        option.addEventListener('click', function(e) {
          // If clicking on the option but not directly on the radio button
          if (e.target.tagName !== 'INPUT') {
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
              radio.checked = true;
              
              // Update selected styling
              radioOptions.forEach(opt => opt.classList.remove('selected'));
              this.classList.add('selected');
            }
          }
        });
      });
    });
    </script>`;
    const agentARN = extension;
    const agentID = extension.split("/").pop();
    let FetchedNumberFromDB =false;

  try {
    console.log("URL:", `${GET_CALLER_ID_ENDPOINT}?agentArn=${agentID}`);
    const getResponse = await fetch(`${GET_CALLER_ID_ENDPOINT}?agentArn=${agentID}`, {
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
      currentOutboundCallerID = data.outboundNumber;
      FetchedNumberFromDB = true;
      console.log("Fetched from API:", currentOutboundCallerID);
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

  const clientNames = [
    "AEP", "BCBSNE", "CENCORA", "CENTENE-CA", "CENTENE-OR", "CF", "SHARECARE",
    "INGREDION", "LEARNINGCARE", "NIAGARA_BOTTLING", "SHBP", "STATEOFTN", "TRANSAMERICA",
    "USI", "AMEDISYS", "BCBSAZ", "DOLLARGENERAL", "FRESENIUS", "GWINNETT",
    "LAFRA", "LAPRA", "MONTEFIORE", "PARSONS", "RELX", "SAMSUNG", "HEIDELBERG_MATERIALS","CARMAX"
  ];
  
  const aliasMap = {
    "SOT": "STATEOFTN",
    "STATE":"STATEOFTN",
    "STATEOF": "STATEOFTN",
    "Fr": "FRESENIUS",
    "CAREFIRST":"CF",
    "HeidelbergMaterials": "HEIDELBERG_MATERIALS",
    "NIAGARA":"NIAGARA_BOTTLING",
    "CENTENECA" : "CENTENE-CA",
    "CENTENEOR":"CENTENE-OR"
  };
    
  if (FetchedNumberFromDB) {
    // currentOutboundCallerID = document.OutboundNumber;
    const {finalList} = await getOutboundQueueList(agentARN, false);
    
    
    
    // Check if queues exist
    if (finalList && finalList.length > 0) { 
      // Check if any queue has an outbound caller number
      const queuesWithNumbers = finalList.filter(queue => queue.OutboundCallerNumberId && queue.OutboundCallerNumberId.trim() !== '');
      
      if (queuesWithNumbers.length > 0) {
        // Condition 1: Queues exist with numbers attached

        
        // Improved UI for the outbound caller ID selection
        htmlContent = htmlContent + `
        <div class="container">
          <div class="header">
            <h1>Outbound Caller ID Management</h1>
            <div class="current-id">
              <h2>Current Caller ID: <span class="highlight">${currentOutboundCallerID}</span></h2>
            </div>
          </div>
          
          <div class="selection-form">
            <h3>Select a new Caller ID</h3>
            <form id="outboundForm">
              <div class="radio-group">`;
              
        // queuesWithNumbers.map((queue, index) => {
        // htmlContent += `
        //   <div class="radio-option ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'selected' : ''}">
        //     <input type='radio' name='OutboundNumber' id='${queue.Queue}' value='${queue.OutboundCallerNumberId}' 
        //       ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'checked' : ''}>
        //     <label for='${queue.Queue}'>
        //       <div class="option-details">
        //         <span class="phone-number">${queue.OutboundCallerNumberId}</span>
        //         <span class="queue-name">${queue.Queue}</span>
        //       </div>
        //       ${currentOutboundCallerID === queue.OutboundCallerNumberId ? '<div class="current-badge">Current</div>' : ''}
        //     </label>
        //   </div>`;
        // });
        const seen = new Set();

        
        const mappedQueues = queuesWithNumbers
          .filter(queue => !queue.Queue.startsWith("IB")) 
          .map(queue => {
            const { displayName, uniqueKey } = getDisplayNameAndKey(queue, clientNames, aliasMap);
            return { queue, displayName, uniqueKey };
          })
          .filter(({ uniqueKey }) => {
            if (seen.has(uniqueKey)) return false;
            seen.add(uniqueKey);
            return true;
          })
          .sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())); 
        
        
        mappedQueues.forEach(({ queue, displayName }) => {
          htmlContent += `
            <div class="radio-option ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'selected' : ''}">
              <input type='radio' name='OutboundNumber' id='${queue.Queue}' value='${queue.OutboundCallerNumberId}' 
                ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'checked' : ''}>
              <label for='${queue.Queue}'>
                <div class="option-details">
                  <span class="phone-number">${queue.OutboundCallerNumberId}</span>
                  <span class="queue-name">${displayName}</span>
                </div>
                ${currentOutboundCallerID === queue.OutboundCallerNumberId ? '<div class="current-badge">Current</div>' : ''}
              </label>
            </div>`;
        });
        
             
        htmlContent += `
              </div>
              <div class="form-actions">
                <button type="submit" id="updateBtn" onclick="handleSubmit(event)">
                  <span class="btn-text">Update Caller ID</span>
                </button>
              </div>
            </form>
          </div>
          <div id="loadingSpinner" class="loading-overlay">
            <div class="spinner"></div>
          </div>
        </div>`;
        
      } else {
        // Condition 3: Queues exist but no numbers are attached
        htmlContent = htmlContent + `
        <div class="container">
          <div class="header">
            <h1>Outbound Caller ID Management</h1>
          </div>
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="12" x2="12" y2="12" stroke="#055647" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="empty-message">No numbers were attached to the queues in your routing profile. Please contact your administrator.</p>
          </div>
        </div>`;
      }
      
    } else {
      // Condition 2: No queues configured
      htmlContent = htmlContent + `
      <div class="container">
        <div class="header">
          <h1>Outbound Caller ID Management</h1>
        </div>
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="0.5" stroke="#055647" stroke-width="2"/>
            </svg>
          </div>
          <p class="empty-message">No queues are configured in your routing profile. Please contact your administrator.</p>
        </div>
      </div>`;
    }
    
    htmlContent += functionScriptContent;
  
    console.log("Returning this");
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: htmlContent,
    };
  } 
  
  if (!FetchedNumberFromDB) {
    console.error("No item found for AgentARN");
    const result = await getOutboundQueueList(agentARN, true);
    console.log("Result from function:", result); // Log the entire object
    const defaultOutboundQueue = result.defaultOutboundQueueId;
  
    const matchingQueue = result.finalList.find((queue) => queue.QueueId === defaultOutboundQueue);
    console.log("Matching queue:", matchingQueue);
  
    if (matchingQueue && !result.defaultOutboundNumber) {
      currentOutboundCallerID = matchingQueue.OutboundCallerNumberId;
    }
  
    if(result.defaultOutboundNumber){
      currentOutboundCallerID = result.defaultOutboundNumber
    }
  
    // Check if queues exist
    if (result.finalList && result.finalList.length > 0) {
      console.log("Final list", result.finalList);
    
      // Check if any queue has an outbound caller number
      const queuesWithNumbers = result.finalList.filter(queue => queue.OutboundCallerNumberId && queue.OutboundCallerNumberId.trim() !== '');
      console.log("Queues with numbers:", queuesWithNumbers);
      if (queuesWithNumbers.length > 0) {
        // Condition 1: Queues exist with numbers attached
        htmlContent = htmlContent + `
        <div class="container">
          <div class="header">
            <h1>Outbound Caller ID Management</h1>
            <div class="current-id">
              <h2>Current Caller ID: <span class="highlight">${currentOutboundCallerID}</span></h2>
            </div>
          </div>
          
          <div class="selection-form">
            <h3>Select a new Caller ID</h3>
            <form id="outboundForm">
              <div class="radio-group">`;
  
        // queuesWithNumbers.map((queue, index) => {
        //   htmlContent += `
        //    <div class="radio-option">
        //           <input type='radio' name='OutboundNumber' id='${queue.Queue}' value='${queue.OutboundCallerNumberId}' 
        //             ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'checked' : ''}>
        //           <label for='${queue.Queue}'>
        //             <span class="phone-number">${queue.OutboundCallerNumberId}</span>
        //             <span class="queue-name">${queue.Queue}</span>
        //           </label>
        //         </div>`;
        // });
        const seen = new Set();

        
        // const mappedQueues = queuesWithNumbers
        //   .filter(queue => !queue.Queue.startsWith("IB")) 
        //   .map(queue => {
        //     const { displayName, uniqueKey } = getDisplayNameAndKey(queue, clientNames, aliasMap);
        //     return { queue, displayName, uniqueKey };
        //   })
        //   .filter(({ uniqueKey }) => {
        //     if (seen.has(uniqueKey)) return false;
        //     seen.add(uniqueKey);
        //     return true;
        //   })
        //   .sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())); 

       
        mappedQueues.forEach(({ queue, displayName }) => {
             htmlContent += `
            <div class="radio-option">
              <input type='radio' name='OutboundNumber' id='${queue.Queue}' value='${queue.OutboundCallerNumberId}' 
                ${currentOutboundCallerID === queue.OutboundCallerNumberId ? 'checked' : ''}>
              <label for='${queue.Queue}'>
              <div class="option-details">
                <span class="phone-number">${queue.OutboundCallerNumberId}</span>
                <span class="queue-name">${displayName}</span>
                </div>
              </label>
            </div>`;
        });

        htmlContent += `
              </div>
              <div class="form-actions">
                <button type="submit" id="updateBtn" onclick="handleSubmit(event)">
                  <span class="btn-text">Update Caller ID</span>
                </button>
              </div>
            </form>
          </div>
          <div id="loadingSpinner" class="loading-overlay">
            <div class="spinner"></div>
          </div>
        </div>`;
        
      } else {
        // Condition 3: Queues exist but no numbers are attached
        htmlContent = htmlContent + `
        <div class="container">
          <div class="header">
            <h1>Outbound Caller ID Management</h1>
          </div>
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="12" x2="12" y2="12" stroke="#055647" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="empty-message">No numbers were attached to the queues in your routing profile. Please contact your administrator.</p>
          </div>
        </div>`;
      }
      
    } else {
      // Condition 2: No queues configured
      htmlContent = htmlContent + `
      <div class="container">
        <div class="header">
          <h1>Outbound Caller ID Management</h1>
        </div>
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12" stroke="#055647" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="0.5" stroke="#055647" stroke-width="2"/>
            </svg>
          </div>
          <p class="empty-message">No queues are configured in your routing profile. Please contact your administrator.</p>
        </div>
      </div>`;
    }
  
    htmlContent += functionScriptContent;
  
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: htmlContent,
    };
  }

  function getDisplayNameAndKey(queue, clientNames, aliasMap) {
    let displayName = queue.Queue;
    const queueLower = queue.Queue.toLowerCase();
  
    // Check alias map
    for (const alias in aliasMap) {
      if (queueLower.includes(alias.toLowerCase())) {
        displayName = aliasMap[alias];
        break;
      }
    }
  
    // If no alias match, check client names
    if (displayName === queue.Queue) {
      const matchedClient = clientNames.find(client =>
        queueLower.includes(client.toLowerCase())
      );
      if (matchedClient) {
        displayName = matchedClient;
      }
    }
  
    const uniqueKey = `${displayName}_${queue.OutboundCallerNumberId}`;
    return { displayName, uniqueKey };
  }
  
      
  }
  
  // Update caller ID via external API
  else if (agentDetails && selectedOutboundNumber) {
  
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

  // If none of the expected values were present
  // return {
  //   statusCode: 400,
  //   body: JSON.stringify({
  //     message: "Invalid request. Required fields missing.",
  //   }),
  // };
}
 // Fix to the getOutboundQueueList function
async function getOutboundQueueList(agentARN, BooleanToGetDefaultOutbound) {
  const userId = agentARN.split("/").pop();
  const input = {
    UserId: userId,
    InstanceId: instanceID,
  };

  try {
    const command = new DescribeUserCommand(input);
    const describeUserResponse = await client.send(command);
    console.log("Describe User Response:", JSON.stringify(describeUserResponse));

    const routingProfileId = describeUserResponse.User.RoutingProfileId;
    console.log("Routing Profile Id", routingProfileId);

    let defaultOutboundQueueId = null;

    if (BooleanToGetDefaultOutbound) {
      const describeRoutingProfileInput = {
        InstanceId: instanceID,
        RoutingProfileId: routingProfileId,
      };
      const describeRPCommand = new DescribeRoutingProfileCommand(describeRoutingProfileInput);
      const describeRPResponse = await client.send(describeRPCommand);
      console.log("Describe Routing Profile Response:", JSON.stringify(describeRPResponse));
      defaultOutboundQueueId = describeRPResponse.RoutingProfile.DefaultOutboundQueueId;
      console.log("Default Outbound Queue Id", defaultOutboundQueueId);
    }

    const listRoutingProfileQueuesInput = {
      InstanceId: instanceID,
      RoutingProfileId: routingProfileId,
    };

    let NextToken = null;
    let QueueList = [];
    
    // More robust pagination handling
    do {
      if (NextToken) {
        listRoutingProfileQueuesInput.NextToken = NextToken;
      }

      try {
        const listRoutingProfileQueuesCommand = new ListRoutingProfileQueuesCommand(listRoutingProfileQueuesInput);
        const listRoutingProfileQueuesResponse = await client.send(listRoutingProfileQueuesCommand);
        
        if (listRoutingProfileQueuesResponse.RoutingProfileQueueConfigSummaryList) {
          listRoutingProfileQueuesResponse.RoutingProfileQueueConfigSummaryList.forEach((element) => {
            if (element.QueueId && !QueueList.includes(element.QueueId)) {
              QueueList.push(element.QueueId);
            }
          });
        }

        NextToken = listRoutingProfileQueuesResponse.NextToken;
        console.log("List Routing Profile Queues Response:", JSON.stringify(listRoutingProfileQueuesResponse));
      } catch (paginationError) {
        console.error("Error during pagination:", paginationError);
        NextToken = null; // Break the loop if there's an error
      }
    } while (NextToken);

    console.log("QueueList", QueueList);

    let totalQueueList = [];
    let addedOutboundQueueIdToGetNumber = false ;

    if(BooleanToGetDefaultOutbound && !QueueList.includes(defaultOutboundQueueId)){
      addedOutboundQueueIdToGetNumber = true;
      QueueList.push(defaultOutboundQueueId);
      
    }

    // Process queues in smaller batches to avoid timeout
    const BATCH_SIZE = 5;
    for (let i = 0; i < QueueList.length; i += BATCH_SIZE) {
      const batch = QueueList.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (queueId) => {
          try {
            const describeQueueInput = {
              InstanceId: instanceID,
              QueueId: queueId,
            };
            const describeQueueCommand = new DescribeQueueCommand(describeQueueInput);
            const describeQueueResponse = await client.send(describeQueueCommand);

            const queue = describeQueueResponse?.Queue;
            if (queue) {
              // Check if OutboundCallerConfig exists before accessing properties
              const outboundConfig = queue.OutboundCallerConfig || {};
              const outboundId = outboundConfig.OutboundCallerIdNumberId;
              
              return {
                QueueName: queue.Name,
                QueueId: queue.QueueId,
                OutboundCallerNumberId: outboundId || null,
                hasOutboundNumber: !!outboundId,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error processing queue ID ${queueId}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null results and add successful ones to our list
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          totalQueueList.push(result.value);
        }
      });
      
      // Small delay between batches to prevent throttling
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("Total Queue List", totalQueueList);

    // Filter totalQueueList to only include queues with outbound numbers
    const queuesWithOutboundNumbers = totalQueueList.filter(queue => 
      queue && queue.hasOutboundNumber && queue.OutboundCallerNumberId
    );
    
    console.log("Queues with outbound numbers:", queuesWithOutboundNumbers.length);

    let finalList = [];

    // Process phone numbers in smaller batches
    for (let i = 0; i < queuesWithOutboundNumbers.length; i += BATCH_SIZE) {
      const batch = queuesWithOutboundNumbers.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (queue) => {
          try {
            const describePhoneNumberInput = {
              PhoneNumberId: queue.OutboundCallerNumberId,
            };
            const describePhoneNumberCommand = new DescribePhoneNumberCommand(describePhoneNumberInput);
            const describePhoneNumberResponse = await client.send(describePhoneNumberCommand);

            if (describePhoneNumberResponse.ClaimedPhoneNumberSummary) {
              return {
                QueueId: queue.QueueId,
                OutboundCallerNumberId: describePhoneNumberResponse.ClaimedPhoneNumberSummary.PhoneNumber,
                Queue: queue.QueueName,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error describing phone number for queue "${queue.QueueName}":`, error);
            return null;
          }
        })
      );
      
      // Filter out null results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          finalList.push(result.value);
        }
      });
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log("Final List", finalList);
    console.log("Default Outbound Queue Id", defaultOutboundQueueId);
    let defaultOutboundNumber = null;
    if(addedOutboundQueueIdToGetNumber){
      defaultOutboundNumber = finalList.find((queue)=> queue.QueueId === defaultOutboundQueueId).OutboundCallerNumberId;
      finalList = finalList.filter((queue)=>queue.QueueId !== defaultOutboundQueueId);

    }
    return { finalList, defaultOutboundQueueId, defaultOutboundNumber };
   
  } catch (error) {
    console.error("Error in getOutboundQueueList:", error);
    // Return empty list but don't fail
    return { finalList: [], defaultOutboundQueueId: null };
  }
}
};
