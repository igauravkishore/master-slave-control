const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');


/**
 * @Class                       			- MasterNode
 * @extends						     			- none
 * @param {string} strWebserverUrl  	- The URL of the Webserver to connect to.
 * @param {number} nSlavePort       	- The port number on which to listen for Slave connections.
 * @param {string} strConfigFilePath 	- Path to the master configuration file.
 * @constructor
 * @description                 			- This is the Master node that connects to the Webserver and listens for Slave nodes.
 *                              				- It waits for Slaves to identify themselves and then sends them their specific configuration from a file.
 * @author                      			- Gaurav Kishore
 * @date                        			- 15-10-2025
 */

function MasterNode(strWebserverUrl, nSlavePort, strConfigFilePath) {
	let self = this;
    self._strWebserverUrl = strWebserverUrl;
    self._nSlavePort = nSlavePort;
    self._strConfigFilePath = strConfigFilePath;

    self._config = {};
    self._connectedSlaves = new Map(); // Stores slaves by their self-identified ID.


    // Client to connect to the Webserver
    self._webserverSocket = io(strWebserverUrl, {
        query: { type: 'master' }
    });

    // Server to listen for Slaves
    self._slaveServer = new Server(nSlavePort, {
        cors: { origin: "*" }
    });

    console.log('[Master] Initialized.');
}

/**
 * @method									- start
 * @param									- none
 * @returns									- none
 * @summary									- Starts the Master Node operations including connecting to the Webserver and listening for Slaves.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.start = function() {
	let self = this;
   //  self.connectToWebServer();
    self.listenForSlaves();
    self.watchConfigFile(); // Load config initially and then watch for changes
};


/**
 * @method									- connectToWebServer
 * @param									- none
 * @returns									- none
 * @summary									- Establishes the connection to the Webserver and sets up necessary listeners.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.connectToWebServer = function() {
	let self = this;
    self._webserverSocket.on('connection', (socket) => {
        console.log(`[Master] Connected to Webserver at ${self._strWebserverUrl} ${socket.id}`);

    });
    self._webserverSocket.on('disconnect', (socket) => {
        console.log(`[Master] Disconnected from Webserver. ${socket.id}`);
    });
    self._webserverSocket.on('connect_error', (err) => {
        console.error(`[Master] Could not connect to Webserver: ${err.message}`);
    });
};


/**
 * @method									- listenForSlaves
 * @param									- none
 * @returns									- none
 * @summary									- Starts the server to listen for incoming Slave connections.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.listenForSlaves = function() {
	let self = this;
    console.log(`[Master] Listening for slaves on port ${self._nSlavePort}`);
    self._slaveServer.on('connection', self.handleSlaveConnection.bind(self));
};


/**
 * @method									- handleSlaveConnection
 * @param {object} socket				- The socket object representing the connected Slave.
 * @returns									- none
 * @summary									- Handles a new Slave connection, sets up listeners for identification and data forwarding.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.handleSlaveConnection = function(socket) {
    let self = this;
    let slaveId = null; // To be set upon identification

    console.log('[Master] A new slave is attempting to connect...');

    socket.on('identify', function(identity) {
        slaveId = identity.id;
        self._connectedSlaves.set(slaveId, socket);
        console.log(`[Master] Slave identified as ${slaveId} and is now connected.`);
        self.sendConfigToSlave(slaveId); // Send config immediately upon identification
    });

    socket.on('sensor-data', function(data) {
        // Forward data to the webserver to be displayed on the UI
        if (self._webserverSocket.connected) {
            self._webserverSocket.emit('forward-to-ui', data);
        }
    });
    
    socket.on('health-status', function(data) {
        if (self._webserverSocket.connected) {
            self._webserverSocket.emit('forward-to-ui', data);
        }
    });

    socket.on('disconnect', function() {
        if (slaveId) {
            self._connectedSlaves.delete(slaveId);
            console.log(`[Master] Slave ${slaveId} disconnected.`);
            // Notify UI that this slave is offline
            self._webserverSocket.emit('forward-to-ui', { slaveIp: slaveId, status: 'offline' });
        }
    });
};



/**
 * @method									- loadConfig
 * @param									- none
 * @returns {boolean}					- True if config loaded successfully, false otherwise.
 * @summary									- Loads the master configuration file from disk.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.loadConfig = function() {
	let self = this;
    try {
        const rawData = fs.readFileSync(self._strConfigFilePath);
        self._config = JSON.parse(rawData);
        console.log('[Master] Configuration loaded successfully.');
        return true;
    } catch (err) {
        console.error(`[Master] Error loading config file: ${err.message}`);
        return false;
    }
};


/**
 * @method									- sendConfigToSlave
 * @param {string} slaveId				- The ID of the slave to send the configuration to.
 * @returns									- none
 * @summary									- Sends the specific configuration to the identified Slave.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.sendConfigToSlave = function(slaveId) {
	let self = this;
    const slaveSocket = self._connectedSlaves.get(slaveId);
    const slaveConfig = self._config.config.find(c => c.slaveIp === slaveId);

    if (slaveSocket && slaveConfig) {
        slaveSocket.emit('config', slaveConfig);
        console.log(`[Master] Sent config to ${slaveId}:`, slaveConfig);
    } else {
        console.log(`[Master] No configuration found for slave ID: ${slaveId}`);
    }
};


/**
 * @method									- sendControlToSlave
 * @param {string} slaveId				- The ID of the slave to send the control command to.
 * @param {string} action				- The control action to send (e.g., 'start', 'stop').
 * @returns									- none
 * @summary									- Sends a control command to the specified Slave.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025 
 */

MasterNode.prototype.sendControlToSlave = function(slaveId, action) {
	let self = this;
   const slaveSocket = self._connectedSlaves.get(slaveId);
    if (slaveSocket) {
        slaveSocket.emit('control', { action: action });
        console.log(`[Master] Sent '${action}' command to slave ${slaveId}.`);
    } else {
        console.warn(`[Master] Attempted to send command to disconnected slave: ${slaveId}`);
    }
};

/**
 * @method									- watchConfigFile
 * @param									- none
 * @returns									- none
 * @summary									- Watches the configuration file for changes and reloads/sends updates to Slaves as needed.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */
MasterNode.prototype.watchConfigFile = function() {
    let self = this;
    
    // Initial load
    self.loadConfig();

    fs.watch(self._strConfigFilePath, (eventType, filename) => {
			let self = this;
        if (eventType === 'change') {
            console.log(`[Master] Config file changed. Reloading and redistributing...`);
            const loaded = self.loadConfig();
            if (loaded) {
                // Resend config to all currently connected slaves
                for (const slaveId of self._connectedSlaves.keys()) {
                    self.sendConfigToSlave(slaveId);
                }
            }
        }
    });
};

// --- Instantiate and run the master ---
const master = new MasterNode('http://localhost:3000', 4000, path.join(__dirname, 'master_config.json'));
master.start();
master.connectToWebServer();