/**
 * @title                       - MasterNode.js
 * @Architecture                - Connects to the Webserver via Socket.IO to forward data from Slaves.
 *                                - Listens for Slave connections, waits for them to identify, and sends them their specific configuration.
 * @description                 - This is the Master node that connects to the Webserver and listens for Slave nodes.
 *                              - It waits for Slaves to identify themselves and then sends them their specific configuration from a file.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */

const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

/**
 * @constant {string} WEB_SERVER_URL - The URL of the Webserver to connect to.
 * @constant {number} SLAVE_LISTENING_PORT - The port on which the Master listens for Slave connections.
 * @constant {string} CONFIG_FILE_PATH - The path to the JSON configuration file containing Slave configurations.
 * @author                      - Gaurav Kishore
 * @date                        - 14-10-2025
 */
const WEB_SERVER_URL = 'http://localhost:3000/master';
const SLAVE_LISTENING_PORT = 4000;
const CONFIG_FILE_PATH = path.join(__dirname, 'master_config.json');


/**
 * @description                   - Holds the active Webserver socket connection.
 *                                  - Maps connected Slaves by their self-reported ID to their socket connections.
 *                                    - Debounce timer for config file watcher to prevent multiple rapid reloads.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
let webserverSocket;
// *** IMPORTANT: Map now stores sockets by their self-reported ID, not connection IP ***
/**
 * @type {Map<string, Socket>}    - Maps Slave IDs to their corresponding socket connections.
 * @description                   - This allows the Master to send configuration to the correct Slave after it identifies itself.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
const connectedSlaves = new Map(); 
let configWatcherDebounce = null;

// 1. Connect to the main webserver (No changes here)
/**
 * @method                        - connectToWebServer
 * @parameter                     - None
 * @returns                       - None
 * @description                   - Establishes a Socket.IO connection to the Webserver.
 *                                  - Sets up event handlers for connection success, disconnection, and errors.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function connectToWebServer() {
  console.log('[Master] Attempting to connect to Webserver...');
  webserverSocket = ioClient(WEB_SERVER_URL);
  webserverSocket.on('connect', () => console.log('[Master] Successfully connected to Webserver.'));
  webserverSocket.on('disconnect', () => console.error('[Master] Disconnected from Webserver.'));
  webserverSocket.on('connect_error', (err) => console.error(`[Master] Could not connect to Webserver: ${err.message}. Retrying...`));
}

// 2. Create a server for slaves to connect to
/**
 * @method                        - listenForSlaves
 * @parameter                     - None
 * @returns                       - None
 * @description                   - Sets up a Socket.IO server to listen for Slave connections.
 *                                  - Waits for each Slave to identify itself before sending its specific configuration.
 *                                   - Forwards any received data or health status from Slaves to the Webserver.
 *                                    - Handles Slave disconnections and cleans up state.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function listenForSlaves() {
  const slaveServer = new Server(SLAVE_LISTENING_PORT, { cors: { origin: '*' } });
  console.log(`[Master] Listening for Slaves on port ${SLAVE_LISTENING_PORT}`);

  slaveServer.on('connection', (socket) => {
    const slaveIp = socket.handshake.address; 
    console.log(`[Master] A slave connected from address: ${slaveIp}. Waiting for identification...`);

    // ***Wait for the slave to identify itself ***
    socket.on('identify', (data) => {
        const slaveId = data.id;
        console.log(`[Master] Slave identified as: ${slaveId}`);
        connectedSlaves.set(slaveId, socket);

        // Now that we know who it is, send its specific config
        sendConfigToSlave(slaveId);
    });

    socket.on('sensor-data', (data) => {
      if (webserverSocket && webserverSocket.connected) {
        webserverSocket.emit('forward-data', { type: 'data', payload: data });
      }
    });

    socket.on('health-status', (data) => {
        if (webserverSocket && webserverSocket.connected) {
            webserverSocket.emit('forward-data', { type: 'health', payload: data });
        }
    });

    socket.on('disconnect', () => {
      // Find which slave this was and remove it
      let disconnectedId = null;
      for (const [id, s] of connectedSlaves.entries()) {
          if (s === socket) {
              disconnectedId = id;
              break;
          }
      }

      if (disconnectedId) {
          console.log(`[Master] Slave ${disconnectedId} disconnected.`);
          connectedSlaves.delete(disconnectedId);
          if (webserverSocket && webserverSocket.connected) {
              webserverSocket.emit('forward-data', { 
                  type: 'health', 
                  payload: { slaveIp: disconnectedId, status: 'offline' } 
              });
          }
      }
    });
  });
}


// 3. Load config and send it to ONE specific slave
/**
 * @method                        - sendConfigToSlave
 * @param {string} slaveId        - The ID of the Slave to send configuration to.
 * @returns                       - None
 * @description                   - Reads the configuration file and extracts the specific configuration for the given Slave ID.
 *                                 - Sends the configuration to the Slave via its socket connection.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function sendConfigToSlave(slaveId) {
    console.log(`[Master] Looking up config for slave: ${slaveId}`);
    try {
        const rawData = fs.readFileSync(CONFIG_FILE_PATH);
        const configData = JSON.parse(rawData);

        if (!configData.config || !Array.isArray(configData.config)) {
            console.error('[Master] Config file is missing "config" array.');
            return;
        }

        // Find the specific configuration for the slave that just connected
        const slaveConfig = configData.config.find(c => c.slaveIp === slaveId);
        
        if (slaveConfig) {
            const slaveSocket = connectedSlaves.get(slaveId);
            if (slaveSocket) {
                slaveSocket.emit('config', slaveConfig);
                console.log(`[Master] Sent config to ${slaveId}:`, slaveConfig.handlers);
            }
        } else {
            console.warn(`[Master] No configuration found for slave ID: ${slaveId}`);
        }

    } catch (err) {
        console.error(`[Master] Error reading or parsing config file: ${err.message}`);
    }
}

// 4. Function to reload and distribute config to ALL connected slaves (used by file watcher)
/**
 * @method                        - loadAndDistributeConfigToAll
 * @parameter                     - None
 * @returns                       - None
 * @description                   - Reads the configuration file and sends updated configurations to all currently connected Slaves.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function loadAndDistributeConfigToAll() {
    console.log('[Master] Reloading config for all connected slaves...');
    // Simply iterate over all currently connected slaves and send them their updated config
    for (const slaveId of connectedSlaves.keys()) {
        sendConfigToSlave(slaveId);
    }
}

// 5. Watch the config file for any changes
/**
 * @method                        - watchConfigFile
 * @parameter                     - None
 * @returns                       - None
 * @description                   - Sets up a file watcher on the configuration file.
 *                                 - On detecting changes, it reloads the configuration and distributes updates to all connected Slaves.
 *                                 - Uses a debounce mechanism to prevent multiple rapid reloads.
 * @author                        - Gaurav Kishore
 * @date                          - 14-10-2025
 */
function watchConfigFile() {
    fs.watch(CONFIG_FILE_PATH, (eventType, filename) => {
        if (filename) {
            clearTimeout(configWatcherDebounce);
            configWatcherDebounce = setTimeout(() => {
                console.log(`[Master] Config file '${filename}' changed. Reloading and distributing to all...`);
                loadAndDistributeConfigToAll(); // <-- Call the "all" function
            }, 200);
        }
    });
}

// --- Main Execution ---
connectToWebServer();
listenForSlaves();
watchConfigFile();

