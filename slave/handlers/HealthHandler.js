const config = require("../../config/Config.js");
const logger = require("../../config/logger")("handler");
/**
 * @class                                   - HealthHandler
 * @extends                                 - N/A
 * @param {string} strSlaveId               - The unique identifier of the slave node.
 * @param {function} onHealthCallback       - Callback function to send health status to the master.
 * @constructor
 * @summary                                 - Handles periodic health status reporting from the slave to the master.
 * @author                                  - Gaurav Kishore
 * @date                                    - 15 - Oct - 2025
 *
 */

function HealthHandler(strSlaveId, onHealthCallback) 
{
  let self = this;
  self._slaveId = strSlaveId;
  self._onHealthCallback = onHealthCallback;
  self._intervalId = null;
  logger.info(`[Handler] Created health handler for: ${self._slaveId}`);
}

/**
 * @method                                  - start
 * @param                                   - none
 * @returns                                 - none
 * @summary                                 - Starts the timer for this handler to periodically send health status.
 * @author                                  - Gaurav Kishore
 * @date                                    - 15 - Oct - 2025
 *
 */
HealthHandler.prototype.start = function () {
  let self = this;
  if (self._intervalId) return;
  try 
  {
    self._intervalId = setInterval(function () {
      const healthPacket = {
        slaveIp: self._slaveId,
        status: "online",
        timestamp: new Date().toISOString(),
      };
      self._onHealthCallback(healthPacket);
    }, config.CONFIG_PARAMS.HEALTH_REPORT_INTERVAL_MS); // Send health every 10 seconds
  }
  catch (err) 
  {
    logger.error(err);
  }
};

/**
 * @method                                  - stop
 * @param                                   - none
 * @returns                                 - none
 * @summary                                 - Stops the timer for this handler.
 * @author                                  - Gaurav Kishore
 * @date                                    - 15 - Oct - 2025
 */
HealthHandler.prototype.stop = function () {
  let self = this;
  try 
  {
    if (!self._intervalId) return;
    clearInterval(self._intervalId);
    self._intervalId = null;
  }
  catch (err) 
  {
    logger.error(err);
  }
};

module.exports = HealthHandler;
