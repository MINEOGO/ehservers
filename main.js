// --- Configuration ---
const API_ENDPOINT = "http://127.0.0.1:1111/"; // UPDATED HTTP endpoint
const FETCH_TIMEOUT_MS = 10000; // 10 seconds timeout

// --- DOM Elements ---
const serversContainer = document.getElementById("servers-container");
const logSection = document.getElementById("log-section");
const logContainer = document.getElementById("log-container");
const logsDiv = document.getElementById("logs");
const toggleLogsBtn = document.getElementById("toggle-logs-btn");

// --- Utility Functions ---
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// --- Logging Function ---
function logMessage(message, type = "info") {
  console.log(`[${type.toUpperCase()}] ${message}`);
  if (logSection.style.display === "none") {
    logSection.style.display = "block";
  }

  const p = document.createElement("p");
  p.textContent = `[${new Date().toLocaleTimeString()}] ${sanitizeHTML(message)}`;
  p.classList.add(type);
  logsDiv.appendChild(p);
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

// --- UI Update Functions ---
function displayLoadingMessage(message) {
  serversContainer.innerHTML = `
    <div class="status-message info">
      <div class="spinner"></div>
      <p>${sanitizeHTML(message)}</p>
    </div>`;
}

function displayErrorMessage(title, message, details = "") {
  serversContainer.innerHTML = `
    <div class="status-message error">
      <p><i class="fas fa-exclamation-triangle"></i> <strong>${sanitizeHTML(title)}</strong></p>
      <p>${sanitizeHTML(message)}</p>
      ${details ? `<div style="font-size: 0.9em; margin-top: 10px;">${details}</div>` : ""}
    </div>`;
}

function createServerCard(server, index) {
  const card = document.createElement("div");
  card.className = "server-card";
  card.style.setProperty('--card-index', index);

  const serverName = sanitizeHTML(server.serverName || "Unnamed Server");
  const serverDescription = (server.serverDescription || "No description available.")
                            .split(/\r\n|\r|\n/)
                            .map(line => sanitizeHTML(line))
                            .join("<br>");
  const ownerName = sanitizeHTML(server.ownerName || "Unknown Owner");
  const ownerProfileUrl = server.ownerProfileUrl ? sanitizeHTML(server.ownerProfileUrl) : "https://via.placeholder.com/60/4A00E0/FFFFFF/?text=N/A";
  const currentPlayers = server.currentPlayers !== undefined ? server.currentPlayers : "?";
  const maxPlayers = server.maxPlayers !== undefined ? server.maxPlayers : "?";

  let socialLinksHTML = "";
  if (server.socialLinks) {
    if (server.socialLinks.Discord) {
      const discordInvite = sanitizeHTML(server.socialLinks.Discord);
      socialLinksHTML += ` <a href="https://discord.gg/${discordInvite}" target="_blank" rel="noopener noreferrer" title="Discord"><i class="fab fa-discord"></i></a>`;
    }
    if (server.socialLinks.YouTube) {
      let ytLink = sanitizeHTML(server.socialLinks.YouTube);
      if (ytLink && !ytLink.startsWith('http://') && !ytLink.startsWith('https://')) {
        ytLink = 'https://' + ytLink;
      }
      if(ytLink) socialLinksHTML += ` <a href="${ytLink}" target="_blank" rel="noopener noreferrer" title="YouTube"><i class="fab fa-youtube"></i></a>`;
    }
    if (server.socialLinks.X) {
      let xHandle = sanitizeHTML(server.socialLinks.X.replace(/^@/, ''));
      if(xHandle) socialLinksHTML += ` <a href="https://x.com/${xHandle}" target="_blank" rel="noopener noreferrer" title="X (Twitter)"><i class="fab fa-xing"></i></a>`;
    }
  }

  card.innerHTML = `
    <h3><i class="fas fa-network-wired"></i> ${serverName}</h3>
    <p class="server-description">${serverDescription}</p>
    <div class="owner-info">
      <img src="${ownerProfileUrl}" class="avatar" alt="${ownerName} Avatar"
           onerror="this.onerror=null; this.src='https://via.placeholder.com/60/cc0000/FFFFFF/?text=Err'; this.alt='Image load error';"/>
      <p><strong>Owner:</strong> ${ownerName}</p>
    </div>
    <p class="player-info"><i class="fas fa-users"></i> Players: ${currentPlayers} / ${maxPlayers}</p>
    <div class="social-links">
      ${socialLinksHTML ? socialLinksHTML : '<em><i class="fas fa-link-slash"></i> No social links.</em>'}
    </div>
  `;
  return card;
}

// --- Main Function to Load Servers ---
async function loadServers() {
  displayLoadingMessage(`Attempting to connect to server list at ${API_ENDPOINT}...`);
  logMessage(`Fetching servers from: ${API_ENDPOINT}`, "info");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logMessage(`Fetch request to ${API_ENDPOINT} timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`, "error");
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);

    logMessage(`Received response. Status: ${response.status} ${response.statusText}`, response.ok ? "info" : "warning");

    const responseTextForLogging = await response.text();
    logMessage(`Raw API Response (first 500 chars):\n${responseTextForLogging.substring(0, 500)}${responseTextForLogging.length > 500 ? '...' : ''}`, "info");

    if (!response.ok) {
      const errorTitle = `Error Fetching Servers: ${response.status}`;
      const errorMessage = `The server at ${API_ENDPOINT} responded with: ${response.statusText}. Check developer logs for more details.`;
      displayErrorMessage(errorTitle, errorMessage);
      logMessage(`API Error: ${response.status} ${response.statusText}. Response body might contain clues.`, "error");
      return;
    }

    let data;
    try {
      data = JSON.parse(responseTextForLogging);
      logMessage("Successfully parsed JSON response.", "success");
    } catch (jsonError) {
      const errorTitle = "Data Parsing Error";
      const errorMessage = "Failed to parse JSON response from API. The server's response was not valid JSON. This could be due to a server misconfiguration or an unexpected response format.";
      const errorDetails = `Raw response started with: ${responseTextForLogging.substring(0,100)}...`;
      displayErrorMessage(errorTitle, errorMessage, errorDetails);
      logMessage(`JSON Parsing Error: ${jsonError.message}. Details: ${errorDetails}`, "error");
      console.error("JSON Parsing Error:", jsonError);
      return;
    }

    if (!Array.isArray(data)) {
      const errorTitle = "Invalid Data Format";
      const errorMessage = "Received data from the API, but it's not in the expected list format (array).";
      displayErrorMessage(errorTitle, errorMessage);
      logMessage("API data is not an array. Received:", "warning");
      console.warn("API Data (not an array):", data);
      return;
    }

    if (data.length === 0) {
      serversContainer.innerHTML = `<p class="status-message info"><i class="fas fa-info-circle"></i> No servers are currently listed.</p>`;
      logMessage("API returned an empty list of servers.", "info");
      return;
    }

    serversContainer.innerHTML = "";
    logMessage(`Found ${data.length} servers. Rendering cards...`, "success");

    data.forEach((server, index) => {
      const card = createServerCard(server, index);
      serversContainer.appendChild(card);
    });
    logMessage("Successfully rendered all server cards.", "success");

  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error in loadServers function:", error);

    let errorTitle = "Could Not Load Servers";
    let errorMessage = "An unexpected error occurred while trying to fetch server data.";
    let errorDetails = `Details: ${sanitizeHTML(error.message)}. Check browser console (F12).`;

    if (error.name === 'AbortError') {
      errorTitle = "Request Timed Out";
      errorMessage = `The request to the server at ${API_ENDPOINT} took too long to respond.`;
      errorDetails = `Timeout was set to ${FETCH_TIMEOUT_MS / 1000} seconds.`;
      logMessage(`Fetch aborted (timeout): ${error.message}`, "error");
    } else if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
      errorTitle = "Connection Error";
      errorMessage = `Unable to connect to the server at ${API_ENDPOINT}.`;
      errorDetails = `
        Possible reasons:
        <ul>
          <li>The backend server is not running or is unreachable at ${API_ENDPOINT}.</li>
          <li>A firewall might be blocking the connection to ${API_ENDPOINT}.</li>
          <li><strong>CORS Policy:</strong> If this page is served from a different origin than the API, the server at ${API_ENDPOINT} must be configured with appropriate CORS headers (e.g., 'Access-Control-Allow-Origin: *' or the specific origin of this page).</li>
        </ul>
        Check the browser console (F12) for more specific network errors (e.g., NET::ERR_CONNECTION_REFUSED, CORS errors).`;
      logMessage(`"Failed to fetch" error: ${error.message}. This often indicates the server is down, a network issue, or a CORS misconfiguration.`, "error");
    } else {
      logMessage(`An unexpected JavaScript error occurred: ${error.message}`, "error");
    }
    displayErrorMessage(errorTitle, errorMessage, errorDetails);
  }
}

// --- Event Listeners ---
if (toggleLogsBtn) {
  toggleLogsBtn.addEventListener("click", () => {
    const icon = toggleLogsBtn.querySelector("i");
    if (logContainer.classList.contains("hidden")) {
      logContainer.classList.remove("hidden");
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
      toggleLogsBtn.title = "Hide Logs";
    } else {
      logContainer.classList.add("hidden");
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
      toggleLogsBtn.title = "Show Logs";
    }
  });
}

// --- Initial call ---
document.addEventListener("DOMContentLoaded", () => {
  loadServers();
});
