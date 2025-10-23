const { io } = require("socket.io-client");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { log } = require("console");
const logger = require("../config/logger")("masternode");

/**
 * @Class                              		- MasterNode
 * @extends                            		- none
 * @param {string} strWebserverUrl     		- The URL of the Webserver to connect to.
 * @param {number} nSlavePort          		- The port number on which to listen for Slave connections.
 * @param {string} strConfigFilePath   		- Path to the master configuration file.
 * @constructor
 * @description                        		- This is the Master node that connects to the Webserver and listens for Slave nodes.
 *                                       	  	  It waits for Slaves to identify themselves and then sends them their specific configuration 
													  	     from a file.
 * @author                             		- Gaurav Kishore
 * @date                               		- 15-10-2025
 */

function MasterNode(strWebserverUrl, nSlavePort, strConfigFilePath) 
{
  let self = this;
  self._strWebserverUrl = strWebserverUrl;
  self._nSlavePort = nSlavePort;
  self._strConfigFilePath = strConfigFilePath;

  self._config = {};
  self._connectedSlaves = new Map(); // Stores slaves by their self-identified ID. // Client to connect to the Webserver

  self._webserverSocket = null; // Will be initialized in connectToWebServer // Server to listen for Slaves

  self._slaveServer = new Server(nSlavePort, {
    cors: { origin: "*" },
  });

  logger.info("[Master] Initialized.");
}

/**
 * @method                             		- start
 * @param                           			- none
 * @returns                         			- none
 * @summary                         			- Starts the Master Node operations including connecting to the Webserver 
													  	     and listening for Slaves.
 * @author                          			- Gaurav Kishore
 * @date                            			- 15 - Oct - 2025
 */
MasterNode.prototype.start = function () {
  let self = this;
  self.connectToWebServer(); // First, establish connection to the main server
  self.listenForSlaves();
  self.watchConfigFile(); // Load config initially and then watch for changes
};

/**
 * @method                          			- connectToWebServer
 * @param                           			- none
 * @returns                         			- none
 * @summary                         			- Establishes the connection to the Webserver and sets up necessary listeners.
 * @author                          			- Gaurav Kishore
 * @date                            			- 15 - Oct - 2025
 */
MasterNode.prototype.connectToWebServer = function () {
  try 
  {
    let self = this;
    // Initialize the client socket here
    self._webserverSocket = io(self._strWebserverUrl);

    self._webserverSocket.on("connect", () => {
      logger.info(`[Master] Connected to Webserver at ${self._strWebserverUrl}`);
      self._webserverSocket.emit("master-identify"); // Let the server know we are the master
    });

    self._webserverSocket.on("disconnect", () => {
      logger.info(`[Master] Disconnected from Webserver.`);
    });

    self._webserverSocket.on("connect_error", (err) => {
      logger.error(`[Master] Could not connect to Webserver: ${err.message}`);
    });

    // Listen for control commands from the webserver
    self._webserverSocket.on("control-slave", (command) => {
      self.sendControlToSlave(command.slaveId, command.action);
    });
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ", err);
  }
};

/**
 * @method                          			- listenForSlaves
 * @param                           			- none
 * @returns                         			- none
 * @summary                         			- Starts the server to listen for incoming Slave connections.
 * @author                          			- Gaurav Kishore
 * @date                            			- 15 - Oct - 2025
 */
MasterNode.prototype.listenForSlaves = function () {
  try 
  {
    let self = this;
    logger.info(`[Master] Listening for slaves on port ${self._nSlavePort}`);
    self._slaveServer.on("connection", self.handleSlaveConnection.bind(self));
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ", err);
  }
};

/**
 * @method                          			- handleSlaveConnection
 * @param {object} socket           			- The socket object representing the connected Slave.
 * @returns                         			- none
 * @summary                         			- Handles a new Slave connection, sets up listeners for identification 
													  		  and data forwarding.
 * @author                          			- Gaurav Kishore
 * @date                            			- 15 - Oct - 2025
 */
MasterNode.prototype.handleSlaveConnection = function (socket) {
  try 
  {
    let self = this;
    let slaveId = null; // To be set upon identification

    logger.info("[Master] A new slave is attempting to connect...");

    socket.on("identify", function (identity) {
      try 
		{
        slaveId = identity.id;
        self._connectedSlaves.set(slaveId, socket);
        logger.info(`[Master] Slave identified as ${slaveId} and is now connected.`);
        self.sendConfigToSlave(slaveId); // Send config immediately upon identification
      } 
		catch (err) 
		{
        logger.error("[Master] Error: ",err);
      }
    });

    // Listen for data and forward it
    socket.on("sensor-data", function (data) {
      try 
		{
        logger.info(`[Master] >>> Received SENSOR-DATA from ${data.slaveIp}`);
        self.forwardDataToWebserver(data);
      } 
		catch (err) 
		{
        logger.error("[Master] Error: ",err);
      }
    });

    socket.on("health-status", function (data) {
      try 
		{
        logger.info(`[Master] >>> Received HEALTH-STATUS from ${data.slaveIp}`);
        self.forwardDataToWebserver(data);
      } 
		catch (err) 
		{
        logger.error("[Master] Error: ",err);
      }
    });

    socket.on("disconnect", function () {
      try 
		{
        if (slaveId) 
		  {
          self._connectedSlaves.delete(slaveId);
          logger.info(`[Master] Slave ${slaveId} disconnected.`); // Notify UI that this slave is offline
          self.forwardDataToWebserver({ slaveIp: slaveId, status: "offline" });
        }
      } 
		catch (err) 
		{
        logger.error("[Master] Error: ",err);
      }
    });
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ",err);
  }
};

/**
 * @method                      				- forwardDataToWebserver
 * @param {object} data         				- The data packet from the slave.
 * @returns                     				- none
 * @summary                    	 			- Forwards a data packet from a slave to the webserver.
 */
MasterNode.prototype.forwardDataToWebserver = function (data) {
  try 
  {
    let self = this;
    console.log(data);
    self._webserverSocket.emit("forward-data", data);
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ",err);
  }
};

/**
 * @method                          		- loadConfig
 * @param                           		- none
 * @returns {boolean}               		- True if config loaded successfully, false otherwise.
 * @summary                         		- Loads the master configuration file from disk.
 * @author                          		- Gaurav Kishore
 * @date                            		- 15 - Oct - 2025
 */
MasterNode.prototype.loadConfig = function () {
  let self = this;
  try 
  {
    const rawData = fs.readFileSync(self._strConfigFilePath);
    self._config = JSON.parse(rawData);
    logger.info("[Master] Configuration loaded successfully.");
    return true;
  } 
  catch (err) 
  {
    logger.error(`[Master] Error loading config file: ${err.message}`);
    return false;
  }
};

/**
 * @method                          		- sendConfigToSlave
 * @param {string} slaveId          		- The ID of the slave to send the configuration to.
 * @returns                         		- none
 * @summary                         		- Sends the specific configuration to the identified Slave.
 * @author                          		- Gaurav Kishore
 * @date                            		- 15 - Oct - 2025
 */
MasterNode.prototype.sendConfigToSlave = function (slaveId) {
  let self = this;
  try 
  {
    const slaveSocket = self._connectedSlaves.get(slaveId);
    const slaveConfig = self._config.config.find((c) => c.slaveIp === slaveId);

    if (slaveSocket && slaveConfig) 
	 {
      slaveSocket.emit("config", slaveConfig);
      logger.info(`[Master] Sent config to ${slaveId}:`, slaveConfig);
    } 
	 else 
    {
      logger.warn(`[Master] No configuration found for slave ID: ${slaveId}`);
    }
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ", err);
  }
};

/**
 * @method                          		- sendControlToSlave
 * @param {string} slaveId          		- The ID of the slave to send the control command to.
 * @param {string} action           		- The control action to send (e.g., 'start', 'stop').
 * @returns                         		- none
 * @summary                         		- Sends a control command to the specified Slave.
 * @author                          		- Gaurav Kishore
 * @date                            		- 15 - Oct - 2025
 */

MasterNode.prototype.sendControlToSlave = function (slaveId, action) {
  let self = this;
  try 
  {
    const slaveSocket = self._connectedSlaves.get(slaveId);
    if (slaveSocket) 
	 {
      slaveSocket.emit("control", { action: action });
      logger.info(`[Master] Sent '${action}' command to slave ${slaveId}.`);
    } 
	 else 
    {
      logger.warn(`[Master] Attempted to send command to disconnected slave: ${slaveId}`);
    }
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ", err);
  }
};

/**
 * @method                          		- watchConfigFile
 * @param                           		- none
 * @returns                         		- none
 * @summary                         		- Watches the configuration file for changes and reloads/sends updates to Slaves as needed.
 * @author                          		- Gaurav Kishore
 * @date                            		- 15 - Oct - 2025
 */
MasterNode.prototype.watchConfigFile = function () {
  let self = this;
  try 
  {
    // Initial load
    self.loadConfig();

    fs.watch(self._strConfigFilePath, (eventType, filename) => {
      if (eventType === "change") 
		{
        logger.info(`[Master] Config file changed. Reloading and redistributing...`);
        const loaded = self.loadConfig();
        if (loaded) 
		  {
          // Resend config to all currently connected slaves
          for (const slaveId of self._connectedSlaves.keys()) 
			 {
            self.sendConfigToSlave(slaveId);
          }
        }
      }
    });
  } 
  catch (err) 
  {
    logger.error("[Master] Error: ", err);
  }
};

module.exports = { MasterNode };
