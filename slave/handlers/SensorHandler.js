/**
 * @class                                   - SensorHandler
 * @param {string} strHandlerType           - The type of sensor (e.g., 'temperature', 'humidity').
 * @param {string} strSlaveId               - The unique identifier of the slave node.
 * @param {function} strOnDataCallback      - Callback function to send data to the master.
 * @constructor
 * @summary                                 - Handles periodic data generation from a specific sensor type and sends it to the master.
 * @author                                  - Gaurav Kishore
 * @date                                    - 15 - Oct - 2025
 */

function SensorHandler(strHandlerType, strSlaveId, strOnDataCallback) {
    let self = this;
    self._handlerType = strHandlerType;
    self._slaveId = strSlaveId;
    self._onDataCallback = strOnDataCallback;
    self._intervalId = null;
    console.log(`[Handler] Created handler for: ${self._handlerType}`);
}

/**
 * @method                                 - start
 * @param                                  - none
 * @returns                                - none
 * @summary                                - Starts the timer for this handler to periodically generate and send data.
 * @author                                 - Gaurav Kishore
 * @date                                   - 15 - Oct - 2025
 */
SensorHandler.prototype.start = function() {
    let self = this;
    if (self._intervalId) return; // Prevent multiple intervals
    
    const randomInterval = 4000 + Math.random() * 5000; // 4-9 seconds

    self._intervalId = setInterval(function() {
        const value = (Math.random() * 100).toFixed(2);
        const dataPacket = {
            slaveIp: self._slaveId,
            handler: self._handlerType,
            value: parseFloat(value),
            timestamp: new Date().toISOString(),
        };
        // Give the data back to the SlaveNode to send
        self._onDataCallback(dataPacket);
    }, randomInterval);
};

/**
 * @method                                 - stop
 * @param                                  - none
 * @returns                                - none
 * @summary                                - Stops the timer for this handler.
 * @author                                 - Gaurav Kishore
 * @date                                   - 15 - Oct - 2025
 */
SensorHandler.prototype.stop = function() {
   let self = this;
    if (!self._intervalId) return;
    clearInterval(self._intervalId);
    self._intervalId = null;
    console.log(`[Handler] Stopped handler for: ${self._handlerType}`);
};

// Export the class
module.exports = SensorHandler;