const { io } = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger")("slavenode");
const SensorHandler = require("./handlers/SensorHandler");
const HealthHandler = require("./handlers/HealthHandler");
const { log } = require("console");

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
  self._instSocketServer = null;
  self._activeHandlers = new Map();

  logger.info("[Slave] Initialized.");
}

/**
 * @method                                 	- start
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Starts the Slave node operations including reading identity
 *                                            and connecting to the Master.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.start = function () {
  let self = this;
  try 
  {
    const bHasIdentity = self.readIdentity();
    if (bHasIdentity)
	 {
      self.connectToMaster();
    }
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
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
SlaveNode.prototype.readIdentity = function () {
  let self = this;
  try 
  {
    const rawData = fs.readFileSync(self._strIdentityFilePath);
    self._identity = JSON.parse(rawData);
    if (!self._identity.id) 
	 {
      throw new Error("Identity file must contain an 'id' field.");
    }
    logger.info(`[Slave] Identified as: ${self._identity.id}`);
    return true;
  } catch (err) 
  {
    logger.error(`[Slave] CRITICAL ERROR: Could not read identity file. ${err.message}`);
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
SlaveNode.prototype.connectToMaster = function () {
  let self = this;
  try 
  {
    self._instSocketServer = io(self._strMasterUrl);
    self.setupListeners();
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
  }
};

/**
 * @method                                 	- setupListeners
 * @param                                  	- none
 * @returns                                	- none
 * @summary                                	- Sets up the Socket.IO event listeners for communication with the Master node.
 * @author                                 	- Gaurav Kishore
 * @date                                   	- 15 - Oct - 2025
 */
SlaveNode.prototype.setupListeners = function () {
  const self = this;

  self._instSocketServer.on("connect", function () {
    try 
	 {
      logger.info(`[Slave] Connected to Master at ${self._strMasterUrl}`);
      self._instSocketServer.emit("identify", { id: self._identity.id });
      logger.info("[Slave] Identification sent to master.");
    } 
	 catch (err) 
	 {
      logger.error("[Slave] Error: ",err);
    }
  });

  self._instSocketServer.on("config", function (config) {
    logger.info("[Slave] Received configuration:", config);
    self._config = config;
    self.saveConfigToFile();
    self.stopAllHandlers();
    self.startHandlers();
  });

  self._instSocketServer.on("control", function (command) {
    try 
	 {
      logger.info(`[Slave] Received control command: ${command.action}`);
      switch (command.action) 
		{
        case "stop":
          self.stopAllHandlers();
          break;
        case "start":
          self.startHandlers();
          break;
        case "restart":
          self.stopAllHandlers();
          setTimeout(() => self.startHandlers(), 100);
          break;
        default:
          logger.warn(
            `[Slave] Unknown control command received: ${command.action}`
          );
          break;
      }
    } 
	 catch (err) 
	 {
      logger.error("[Slave] Error: ",err);
    }
  });

  self._instSocketServer.on("disconnect", function () {
    logger.info("[Slave] Disconnected from Master. Stopping handlers.");
    try 
	 {
      self.stopAllHandlers();
    } 
	 catch (err) 
	 {
      logger.error("[Slave] Error: ",err);
    }
  });

  self._instSocketServer.on("connect_error", function (err) {
    logger.error(`[Slave] Could not connect to Master: ${err.message}`);
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
SlaveNode.prototype.saveConfigToFile = function () {
  let self = this;
  try 
  {
    fs.writeFileSync(
      self._strConfigFilePath,
      JSON.stringify(self._config, null, 2)
    );
    logger.info(`[Slave] Configuration saved to ${self._strConfigFilePath}`);
  } 
  catch (err) 
  {
    logger.error("[Slave] Error saving config file:", err);
  }
};

/**
 * @method                                	- startHandlers
 * @param                                 	- none
 * @returns                               	- none
 * @summary                               	- Starts all handlers as per the current configuration.
 * @author                                	- Gaurav Kishore
 *  */
SlaveNode.prototype.startHandlers = function () {
  let self = this;
  try 
  {
    if (
      self._activeHandlers.size > 0 ||
      !self._config ||
      !self._config.handlers
    ) 
	 {
      logger.warn("[Slave] Start command ignored: Handlers are already running or config is missing.");
      return;
    }
    logger.info("[Slave] Spawning handlers..."); // Create a new SensorHandler for each type in the config

    self._config.handlers.forEach((handlerType) => {
      const handler = new SensorHandler(
        handlerType,
        self._identity.id,
        self.sendSensorData.bind(self)
      );
      handler.start();
      self._activeHandlers.set(handlerType, handler);
    }); // Create the HealthHandler
    const healthHandler = new HealthHandler(
      self._identity.id,
      self.sendHealthStatus.bind(self)
    );
    healthHandler.start();
    self._activeHandlers.set("health-check", healthHandler);
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
  }
};

/**
 * @method                                	- stopAllHandlers
 * @param                                 	- none
 * @returns                               	- none
 * @summary                               	- Stops all currently active handlers.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.stopAllHandlers = function () {
  let self = this;
  try 
  {
    self._activeHandlers.forEach((handler) => handler.stop());
    self._activeHandlers.clear();
    logger.info("[Slave] All active handlers have been stopped.");
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
  }
};

/**
 * @method                                	- sendSensorData
 * @param {object} dataPacket             	- The data packet to send to the master.
 * @returns                               	- none
 * @summary                               	- Sends a sensor data packet to the master.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.sendSensorData = function (dataPacket) {
  let self = this;
  try 
  {
    self._instSocketServer.emit("sensor-data", dataPacket);
    logger.info(`[Slave] Sent data for ${dataPacket.handler}: ${dataPacket.value}`);
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
  }
};

/**
 * @method                                	- sendHealthStatus
 * @param {object} healthPacket           	- The health packet to send to the master.
 * @returns                               	- none
 * @summary                               	- Sends a health status packet to the master.
 * @author                                	- Gaurav Kishore
 * @date                                  	- 15 - Oct - 2025
 */
SlaveNode.prototype.sendHealthStatus = function (healthPacket) {
  let self = this;
  try 
  {
	 self._instSocketServer.emit("health-status", healthPacket);
	 logger.info(`[Slave] Sent health status: ${healthPacket.status}`);
  } 
  catch (err) 
  {
    logger.error("[Slave] Error: ", err);
  }
};

module.exports = { SlaveNode };
