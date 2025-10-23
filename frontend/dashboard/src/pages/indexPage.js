import { defineComponent } from 'vue'
import { io } from 'socket.io-client'
import CONFIG_PARAMS from '../config/Config.js'
// Establish the socket connection
const socket = io(CONFIG_PARAMS.WEBSERVER_URL);

export default defineComponent({
  name: 'IndexPage',

  data() {
    return {
      masterStatus: 'offline',
      slaves: {},
    }
  },

  computed: {
    sortedSlaves() {
      return Object.values(this.slaves).sort((a, b) => a.id.localeCompare(b.id))
    },
  },

  mounted() {
    // --- Socket.IO Event Listeners ---

    socket.on('connect', () => {
      console.log('[UI] SUCCESS: Connected to webserver.')
    });

    socket.on('disconnect', () => {
      console.error('[UI] ERROR: Disconnected from webserver.')
      this.masterStatus = 'offline'
      Object.keys(this.slaves).forEach((id) => (this.slaves[id].status = 'offline'))
    });

    socket.on('connect_error', (err) => {
      console.error('[UI] ERROR: Connection to webserver failed:', err.message)
    });

    socket.on('master-status', (data) => {
      this.masterStatus = data.status
    });

    socket.on('data-ui', (data) => {
      if (!data || !data.slaveIp) {
        console.warn('[UI] Received invalid data packet:', data)
        return
      }

      // Initialize slave object if it doesn't exist
      if (!this.slaves[data.slaveIp]) {
        this.slaves[data.slaveIp] = {
          id: data.slaveIp,
          status: 'offline',
          lastSeen: Date.now(),
          handlers: {},
        }
      }

      const slave = this.slaves[data.slaveIp]
      slave.lastSeen = data.timestamp || Date.now()

      // Handle status updates or sensor data
      if (data.status) {
        slave.status = data.status
      } else if (data.handler && data.value !== undefined) {
        slave.status = 'online' // If we get data, it's online

        if (!slave.handlers[data.handler]) {
          slave.handlers[data.handler] = {}
        }

        slave.handlers[data.handler].value = data.value
        slave.handlers[data.handler].updated = true // For animation flash

        // Reset the flash animation
        setTimeout(() => {
          if (slave.handlers[data.handler]) {
            slave.handlers[data.handler].updated = false
          }
        }, 700)
      }
    });
  },
})