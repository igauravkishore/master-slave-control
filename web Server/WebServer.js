const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const logger = require("../config/logger")("webserver");

/**
 * @class 									      - WebServer
 * @extends 								      - none
 * @param {number} nPort      				- The port number on which the server listens.
 * @constructor
 * @summary 										- A simple web server using Express and Socket.IO to facilitate communication
 * 									   	  		  between the Master Node and UI clients.
 */
function WebServer(nPort) 
{
  let self = this;
  self._nPort = nPort;
  self._app = express();
  self._httpServer = http.createServer(self._app);
  self._io = new Server(self._httpServer, {
    cors: {
      origin: "*", // Allow all connections
    },
  });
  self._masterSocket = null;
  logger.info("[WebServer] Initialized.");
}

/**
 * @method											- setupListeners
 * @param											- none
 * @returns											- none
 * @summary											- Sets up the Socket.IO listeners for incoming connections from the Master Node
 * 											  		  and UI clients.
 * @author											- Gaurav Kishore
 * @date												- 15 - Oct - 2025
 */
WebServer.prototype.setupListeners = function () {
  const self = this;

  self._io.on("connection", (socket) => {
    try 
	 {
      logger.info("[WebServer] A client connected:", socket.id);
      const clientType = socket.id;

      if (clientType)
		{
        logger.info("[WebServer] Master Node has connected.");
        self._masterSocket = socket;
        self._masterSocket.emit("master-status", { status: "online" }); // Inform UI

        socket.on("forward-data", (data) => {
          try 
			 {
				
            logger.info(`data to UI: ${JSON.stringify(data)}`);
            self._masterSocket.emit("data-ui", data);
          } 
			 catch (err) 
			 {
            logger.error("[WebServer] Error:", err);
          }
        });

        // Listen for control commands coming from a UI and forward to master
        socket.on("control-slave", (command) => {
          if (self._masterSocket)
            self._masterSocket.emit("control-slave", command);
        });

        // When master disconnects
        socket.on("disconnect", function () {
          try 
			 {
            logger.info("[WebServer] Master Node has disconnected.");
            self._masterSocket = null;
            self._io.emit("master-status", { status: "offline" });
          } 
			 catch (err) 
			 {
            logger.error("[WebServer] err: ", err);
          }
        });
      } 
		else 
		{
        logger.info("[WebServer] A UI Dashboard client has connected.");
      }
    } 
	 catch (error) 
	 {
      logger.error("[WebServer] Error: ", error);
    }
  });
};

/**
 * @method											- start
 * @param											- none
 * @returns											- none
 * @summary											- Starts the web server and sets up necessary listeners.
 * @author											- Gaurav Kishore
 * @date												- 15 - Oct - 2025
 */

WebServer.prototype.start = function () {
  let self = this;
  self.setupListeners();

  self._httpServer.listen(self._nPort, () => {
    try 
	 {
      let self = this;
      logger.info(`[WebServer] Server listening on port ${self._nPort}`);
    } 
	 catch (err) 
	 {
      logger.error("[WebServer] Error: ", err);
    }
  });
};

module.exports = { WebServer };