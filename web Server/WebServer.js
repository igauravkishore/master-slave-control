/***
 * @title			- Webserver.js
 * @Architecture	- The Master node connects to this Webserver via Socket.IO and sends it data received from Slaves.
 * 					- The Webserver can then broadcast this data to any connected dashboard clients (not implemented here).
 * 
 * @description	- This is the central hub that the Master node connects to and the future dashboard will listen to.
 * @author 			- Gaurav Kishore
 * @date 			- 14-10-2025
 *
 */


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity. In production, restrict this.
  },
});

console.log(`[Webserver] Starting on port ${PORT}`);



/**
 * @method 				- masterNamespace
 * @description 		- This namespace handles connections from the Master node.
 * 
 * @author 				- Gaurav Kishore
 * @date 				- 14-10-2025
 * 
 */

const masterNamespace = io.of('/master');
masterNamespace.on('connection', (socket) => {
  console.log('[Webserver] Master node connected successfully.');

  // When the master forwards data from a slave, broadcast it to all dashboard clients.
  socket.on('forward-data', (data) => {
    console.log(`[Webserver] Received data from Master, forwarding to dashboard:`, data);
    // Emit to the default namespace where the dashboard UI will be listening.
    io.emit('update-dashboard', data);
  });

  
  // Handle master disconnection
  socket.on('disconnect', () => {
    console.log('[Webserver] Master node disconnected.');
    // Notify the dashboard that the master is offline
    io.emit('master-status', { status: 'offline' });
  });
  
  // Notify the dashboard that the master is online
  io.emit('master-status', { status: 'online' });
});

// A simple check to see if the server is running via HTTP
app.get('/', (req, res) => {
  res.send('Webserver is running.');
});


server.listen(PORT, () => {
  console.log(`[Webserver] Listening for connections.`);
});
