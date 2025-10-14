/**
 * @title			          - Slave.js
 * @Architecture	      - The Slave node connects to the Master node via Socket.IO.
 * 					            - It identifies itself, receives configuration, and sends sensor data and health status.
 * @description 	      - This is a simulated Slave node that connects to the Master node, identifies itself, receives configuration,
 * 					            - and sends periodic sensor data and health status updates.
 * @author              - Gaurav Kishore
 * @date 			          - 14-10-2025
 */

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
/**
 * @constant {string} MASTER_URL            - The URL of the Master node to connect to.
 * @constant {string} CONFIG_FILE_PATH      - The path to the JSON configuration file where the Slave saves its received configuration.
 * @constant {string} IDENTITY_FILE_PATH    - The path to the JSON file containing the Slave's identity.
 * @author                                  - Gaurav Kishore
 * @date                                    - 14-10-2025
 */
const MASTER_URL = 'http://localhost:4000';
const CONFIG_FILE_PATH = path.join(__dirname, 'slave_config.json');
const IDENTITY_FILE_PATH = path.join(__dirname, 'slave_identity.json');

// --- State ---
let myConfig = null;
let myIdentity = null;
const activeHandlers = new Map();


/**
 * @description                         - Reads the slave's identity from a local JSON file.
 *                                        - This identity is used to identify itself to the Master node.
 * @throws {Error}                      - If the identity file cannot be read or parsed.
 * @author                              - Gaurav Kishore
 * @date                                - 14-10-2025
 */
try {
    const rawData = fs.readFileSync(IDENTITY_FILE_PATH);
    myIdentity = JSON.parse(rawData);
    if (!myIdentity.id) {
        throw new Error("Identity file must contain an 'id' field.");
    }
    console.log(`[Slave] Identified as: ${myIdentity.id}`);
} catch (err) {
    console.error(`[Slave] CRITICAL ERROR: Could not read identity file at ${IDENTITY_FILE_PATH}. ${err.message}`);
    process.exit(1);
}


/**
 * @description                 - Connects to the Master node using Socket.IO.
 *                                - Upon connection, it sends its identity for registration.
 *                                  - Listens for configuration updates from the Master.
 *                                    - Handles disconnections and errors.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */
const socket = io(MASTER_URL);
socket.on('connect', () => {
  console.log(`[Slave] Connected to Master at ${MASTER_URL}`);
  socket.emit('identify', { id: myIdentity.id });
  console.log('[Slave] Identification sent to master.');
});


// 3. Listen for configuration from the Master
/**
 * @description                 - Listens for 'config' events from the Master node.
 *                                - Updates local configuration and restarts data handlers accordingly.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */

socket.on('config', (config) => {
  console.log('[Slave] Received configuration:', config);
  myConfig = config;

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    console.log(`[Slave] Configuration saved to ${CONFIG_FILE_PATH}`);
  } catch (err) {
    console.error('[Slave] Error saving config file:', err);
  }

  stopAllHandlers();
  startHandlers();
});


/**
 * @description                 - Listens for disconnection events from the Master node.
 *                                - Stops all active data handlers upon disconnection.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */

socket.on('disconnect', () => {
  console.error('[Slave] Disconnected from Master. Stopping handlers.');
  stopAllHandlers();
});

/**
 * @description                 - Listens for connection error events.
 *                                - Logs connection errors.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */
socket.on('connect_error', (err) => {
    console.error(`[Slave] Could not connect to Master: ${err.message}`);
});

/**
 * @method                      - startHandlers
 * @param                       - None
 * @returns                     - None
 * @description                 - Starts data handlers based on the current configuration.
 *                                - Each handler simulates sending data at regular intervals. 
 *                                - Also starts a health check handler.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025 
 */

function startHandlers() {
  if (!myConfig || !myConfig.handlers) {
    console.log('[Slave] startHandlers called, but no valid config found.');
    return;
  }

  console.log('[Slave] Spawning handlers...');
  myConfig.handlers.forEach(handlerType => {
    console.log(`[Slave] Setting up handler for: ${handlerType}`); // New log

    // Send the first packet after 2 seconds to confirm timer works
    const firstTimeout = setTimeout(() => {
        sendData(handlerType);
    }, 2000);
    activeHandlers.set(`${handlerType}-first`, firstTimeout);


    // Then, set the interval for subsequent packets
    const interval = setInterval(() => {
      sendData(handlerType);
    }, 5000); // Increased interval for clarity

    activeHandlers.set(handlerType, interval);
  });
  
  const healthInterval = setInterval(sendHealthStatus, 10000);
  activeHandlers.set('health-check', healthInterval);
}

// NEW: Created a dedicated function for sending data
/**
 * @method                        - sendData
 * @param {string} handlerType    - The type of handler (e.g., temperature, humidity).
 * @returns                       - None
 * @description                   - Simulates sending a data packet to the Master node.
 *                                  - The data packet includes the slave's identity, handler type, a random value, and a timestamp.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function sendData(handlerType) {
    const value = (Math.random() * 100).toFixed(2);
    const dataPacket = {
        slaveIp: myIdentity.id,
        handler: handlerType,
        value: parseFloat(value),
        timestamp: new Date().toISOString(),
    };
    
    socket.emit('sensor-data', dataPacket);
    console.log(`[Slave] Sent data for ${handlerType}:`, dataPacket.value);
}

/**
 * @method                        - sendHealthStatus
 * @param                         - None
 * @returns                       - None
 * @description                   - Sends a health status update to the Master node.
 *                                 - The health status includes the slave's identity, status, and a timestamp.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function sendHealthStatus() {
    socket.emit('health-status', {
        slaveIp: myIdentity.id,
        status: 'online',
        timestamp: new Date().toISOString()
    });
    console.log(`[Slave] Sent health status.`); // Added log for health check
}

/**
 * @method                        - stopAllHandlers
 * @param                         - None
 * @returns                       - None
 * @description                   - Stops all active data handlers and health checks.
 *                                - Clears all intervals and timeouts.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function stopAllHandlers() {
  console.log('[Slave] Stopping all active handlers.'); // New log
  activeHandlers.forEach((timerId) => {
    clearInterval(timerId);
    clearTimeout(timerId); // Also clear timeouts
  });
  activeHandlers.clear();
}

