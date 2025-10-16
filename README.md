# Master-Slave Control System

**Author:** Gaurav Kishore

**Date:**   16 - Oct - 2025

### 1. Overview

This project implements a small-scale distributed system featuring a Master node that centrally manages and controls multiple Slave nodes. Each Slave simulates a set of sensor handlers (e.g., temperature, humidity, pressure) and reports live data and health status. The Master aggregates this information and forwards it to a Webserver, which acts as a broadcast hub for a real-time monitoring dashboard.

The system is designed to be dynamic, allowing for real-time configuration changes and remote control of slaves without requiring any service restarts.

### 2. System Architecture

   The system consists of three core components that communicate via Socket.IO:

 * #### Webserver (webserver/)

   * **Role:** The central communication hub and broadcast server.

   * It runs a Socket.IO server on port 3000.

   * The Master node connects to it as a client.

   * It receives aggregated data from the Master and broadcasts it to all connected dashboard clients (not implemented in this project).

 * #### Master Node (master/)

   * **Role:** The "brains" of the system; it orchestrates all the slaves.

   * Connects to the Webserver as a client.

   * Runs its own Socket.IO server on port 4000 for slaves to connect to.

   * Reads its configuration from master_config.json, which defines which sensors each slave should run.

   * Watches master_config.json for changes and pushes updates to slaves in real-time.

   * Receives data from slaves and forwards it to the Webserver.

   * Can relay control commands (e.g., stop, start) to specific slaves.

* #### Slave Node (slave/)

  * **Role:** The "worker" or "sensor" unit.

  * Connects to the Master node as a client.

  * Identifies itself to the Master using its unique ID from slave_identity.json.

  * Receives its specific configuration from the Master and spawns the required sensor handlers (SensorHandler, HealthHandler).

  * Periodically sends sensor data and an "online" health status back to the Master.

  * Listens for control commands from the Master to start, stop, or restart its handlers.

### 3. Key Features

* **Dynamic Configuration:** The entire system's behavior is defined in master_config.json. You can add/remove slaves or change their assigned sensor handlers on the fly.

* **Hot-Reload:** The Master node automatically detects changes to master_config.json and pushes new configurations to the relevant slaves without any downtime.

* **Centralized Control:** Slaves can be remotely controlled by the Master with commands like start, stop, and restart.

* **Modular & Organized Code:** The logic is encapsulated using a prototype-based object-oriented style. The slave's sensor logic is further broken down into separate Handler classes for clean separation of concerns.

* **Self-Identification:** Slaves use a unique ID to identify themselves, making the system robust and independent of unreliable network IPs.

* **Detailed Logging:** Comprehensive console logs provide a clear view of the system's state and data flow, making debugging straightforward.

### 4. Setup and Installation

   **1. Clone the repository:**

           git clone <your-repo-url>
           cd master-slave-system



**2. Install dependencies for each component:**
You need to run npm install in each of the three directories.

     #Install for Webserver

     cd webserver
     npm install express socket.io
     cd ..

     #Install for Master
     cd master
     npm install socket.io
     cd ..

     #Install for Slave
     cd slave
     npm install socket.io-client
     cd ..



### 5. How to Run

 The startup order is critical for the components to connect correctly. You will need **three separate terminals.**

**Terminal 1: Start the Webserver (Port 3000)**

     cd webserver
     node server.js

Wait until you see **[WebServer] Server listening on port 3000.**

**Terminal 2: Start the Master Node (Port 4000)**

     cd master
     node master.js



You should see it connect to the Webserver and listen for slaves.

**Terminal 3: Start the Slave Node(s)**

     cd slave
     node slave.js



   The slave will connect to the master, identify itself, and receive its configuration.

To run a second slave, create a copy of the **slave** directory, change the **id** in **slave_identity.json**, and run **node slave.js** from the new directory.

### 6. Configuration

* **master/master_config.json:** This is the main configuration file. You define all your slaves and their handlers here. The **slaveIp** must match the **id** in the corresponding slave's identity file.

      {
        "config": [
          {
            "slaveIp": "192.168.1.10",
            "handlers": ["temperature", "humidity"]
          },
          {
            "slaveIp": "192.168.1.11",
            "handlers": ["vibration", "pressure"]
          }
        ]
      }



* **slave/slave_identity.json:** This file gives each slave a unique name.

       {
         "id": "192.168.1.10"
       }

