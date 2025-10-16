const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const SensorHandler = require('./handlers/SensorHandler');
const HealthHandler = require('./handlers/HealthHandler');

/**
 * @class                                 	- SlaveNode
 * @extends                               	- none
 * @param {string} strMasterUrl           	- The URL of the Master node to connect to.
 * @param {string} strIdentityFilePath    	- Path to the slave identity file.
 * @param {string} strConfigFilePath      	- Path to the slave configuration file.
 * @constructor
 * @description                           	- This is the Slave node that connects to the Master node, identifies itself, receives configuration,
 *                                             and spawns handlers to simulate sensor data and health checks.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 *  
 */
function SlaveNode(strMasterUrl, strIdentityFilePath, strConfigFilePath) {
  let self = this;
    self._strMasterUrl = strMasterUrl;
    self._strIdentityFilePath = strIdentityFilePath;
    self._strConfigFilePath = strConfigFilePath;

    self._identity = null;
    self._config = null;
    self._socket = null;
    self._activeHandlers = new Map();

    console.log('[Slave] Initialized.');
}

/**
 * @method                                 	- start
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Starts the Slave node operations including reading identity 
 *                                           and connecting to the Master.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.start = function() {
  let self = this;
    const hasIdentity = self.readIdentity();
    if (hasIdentity) {
        self.connectToMaster();
    }
};

/**
 * @method                                	- readIdentity
 * @param                                 	- none
 * @returns {boolean}                     	- True if identity read successfully, false otherwise.
 * @summary                               	- Reads the slave identity from the specified file.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 *  
 */
SlaveNode.prototype.readIdentity = function() {
    let self = this;
    try {
        const rawData = fs.readFileSync(self._strIdentityFilePath);
        self._identity = JSON.parse(rawData);
        if (!self._identity.id) {
            throw new Error("Identity file must contain an 'id' field.");
        }
        console.log(`[Slave] Identified as: ${self._identity.id}`);
        return true;
    } catch (err) {
        console.error(`[Slave] CRITICAL ERROR: Could not read identity file. ${err.message}`);
        process.exit(1);
    }
};

/**
 * @method                                 	- connectToMaster
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Establishes a connection to the Master node and sets up event listeners.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.connectToMaster = function() {
    let self = this;
    self._socket = io(self._strMasterUrl);
    self.setupListeners();
};

/**
 * @method                                 	- setupListeners
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Sets up the Socket.IO event listeners for communication with the Master node.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.setupListeners = function() {
    const self = this;

    self._socket.on('connect', function() {
        console.log(`[Slave] Connected to Master at ${self._strMasterUrl}`);
        self._socket.emit('identify', { id: self._identity.id });
        console.log('[Slave] Identification sent to master.');
    });

    self._socket.on('config', function(config) {
        console.log('[Slave] Received configuration:', config);
        self._config = config;
        self.saveConfigToFile();
        
        self.stopAllHandlers();
        self.startHandlers();
    });

    self._socket.on('control', function(command) {
        console.log(`[Slave] Received control command: ${command.action}`);
        switch (command.action) {
            case 'stop':
                self.stopAllHandlers();
                break;
            case 'start':
                self.startHandlers();
                break;
            case 'restart':
                self.stopAllHandlers();
                setTimeout(() => self.startHandlers(), 100);
                break;
            default:
                console.warn(`[Slave] Unknown control command received: ${command.action}`);
        }
    });

    self._socket.on('disconnect', function() {
        console.error('[Slave] Disconnected from Master. Stopping handlers.');
        self.stopAllHandlers();
    });

    self._socket.on('connect_error', function(err) {
        console.error(`[Slave] Could not connect to Master: ${err.message}`);
    });
};

/**
 * @method                                 	- saveConfigToFile
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Saves the current configuration to the specified file.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.saveConfigToFile = function() {
    let self = this;
    try {
        fs.writeFileSync(self._strConfigFilePath, JSON.stringify(self._config, null, 2));
        console.log(`[Slave] Configuration saved to ${self._strConfigFilePath}`);
    } catch (err) {
        console.error('[Slave] Error saving config file:', err);
    }
};

/**
 * @method                                	- startHandlers
 * @param                                 	- none
 * @returns                               	- none
 * @summary                               	- Starts all handlers as per the current configuration.
 * @author                                	- Gaurav Kishore
 *  */
SlaveNode.prototype.startHandlers = function() {
    let self = this;
    
    if (self._activeHandlers.size > 0 || !self._config || !self._config.handlers) {
        console.log('[Slave] Start command ignored: Handlers are already running or config is missing.');
        return;
    }
    
    console.log('[Slave] Spawning handlers...');

    // Create a new SensorHandler for each type in the config
    self._config.handlers.forEach(handlerType => {
        const handler = new SensorHandler(handlerType, self._identity.id, self.sendSensorData.bind(self));
        handler.start();
        self._activeHandlers.set(handlerType, handler);
    });
    
    // Create the HealthHandler
    const healthHandler = new HealthHandler(self._identity.id, self.sendHealthStatus.bind(self));
    healthHandler.start();
    self._activeHandlers.set('health-check', healthHandler);
};

/**
 * @method                                	- stopAllHandlers
 * @param                                 	- none
 * @returns                               	- none
 * @summary                               	- Stops all currently active handlers.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.stopAllHandlers = function() {
    let self = this;
    self._activeHandlers.forEach(handler => handler.stop());
    self._activeHandlers.clear();
    console.log('[Slave] All active handlers have been stopped.');
};

/**
 * @method                                	- sendSensorData
 * @param {object} dataPacket             	- The data packet to send to the master.
 * @returns                               	- none
 * @summary                               	- Sends a sensor data packet to the master.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.sendSensorData = function(dataPacket) {
    let self = this;
    self._socket.emit('sensor-data', dataPacket);
    console.log(`[Slave] Sent data for ${dataPacket.handler}:`, dataPacket.value);
};


/**
 * @method                                	- sendHealthStatus
 * @param {object} healthPacket           	- The health packet to send to the master.
 * @returns                               	- none
 * @summary                               	- Sends a health status packet to the master.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.sendHealthStatus = function(healthPacket) {
 let self = this;
    self._socket.emit('health-status', healthPacket);
};

// --- Instantiate and run the slave ---
const slave = new SlaveNode(
    'http://localhost:4000',
    path.join(__dirname, 'slave_identity.json'),
    path.join(__dirname, 'slave_config.json')
);
slave.start();

