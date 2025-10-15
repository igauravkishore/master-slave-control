const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

/**
 * @class WebServer
 *	@extends none 	
 * @param {number} nPort      - The port number on which the server listens.
 * @constructor 
 * @summary 						- A simple web server using Express and Socket.IO to facilitate communication 
 * 									   between the Master Node and UI clients.
 */
function WebServer(nPort) {
	let self = this;
    self._nPort = nPort;
    self._app = express();
    self._httpServer = http.createServer(self.app);
    self._io = new Server(self._httpServer, {
        cors: {
            origin: "*", // Allow all connections
        }
    });
    self._masterSocket = null;
    console.log('[WebServer] Initialized.');
}

/**
 * @method								- setupListeners
 * @param								- none
 * @returns								- none
 * @summary								- Sets up the Socket.IO listeners for incoming connections from the Master Node and UI clients.
 * @author								- Gaurav Kishore
 * @date									- 15 - Oct - 2025
 */
WebServer.prototype.setupListeners = function() {
    const self = this; 

    self._io.on('connection', (socket)=>{
			console.log('[WebServer] A client connected:', socket.id);
        const clientType = socket.handshake.query.type;

        if (clientType === 'master') {
            console.log('[WebServer] Master Node has connected.');
            self._masterSocket = socket;
            self._io.emit('master-status', { status: 'online' }); // Inform UI

            // When master disconnects
            socket.on('disconnect', function() {
                console.log('[WebServer] Master Node has disconnected.');
                self._masterSocket = null;
                self._io.emit('master-status', { status: 'offline' });
            });

        } else {
            console.log('[WebServer] A UI Dashboard client has connected.');
        }
    });
};

/**
 * @method									- forwardDataToUI
 * @param {object} data					- The data packet received from the Master Node to be forwarded to the UI.
 * @returns									- none
 * @summary									- Forwards data received from the Master Node to all connected UI clients.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */

WebServer.prototype.forwardDataToUI = function(data) {
	let self = this;
    self._io.emit('update-dashboard', data);
    // console.log('[WebServer] Forwarded data to UI:', data); // Uncomment for verbose logging
};


/**
 * @method									- start
 * @param									- none
 * @returns									- none
 * @summary									- Starts the web server and sets up necessary listeners.
 * @author									- Gaurav Kishore
 * @date										- 15 - Oct - 2025
 */

WebServer.prototype.start = function() {
	let self = this;
    self.setupListeners();

    // The master will push data to us, so we listen on its socket.
    const checkMasterInterval = setInterval(() => {
        if (self._masterSocket) {
            self._masterSocket.on('forward-to-ui', self.forwardDataToUI.bind(self));
            // We only need to set this listener once, so clear the interval.
            clearInterval(checkMasterInterval);
        }
    }, 1000);

    self._httpServer.listen(self._nPort, () => {
			let self = this;
        console.log(`[WebServer] Server listening on port ${self._nPort}`);
    });
};

// --- Instantiate and run the server ---
const webServer = new WebServer(3000);
webServer.start();

