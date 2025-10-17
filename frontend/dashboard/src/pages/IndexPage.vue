<template>
  <q-page class="q-pa-md">
    <div class="q-mb-md">
      <q-card flat bordered>
        <q-card-section class="row items-center justify-between">
          <div class="text-h6">Master Node Status</div>
          <q-badge
            :label="masterStatus"
            :color="masterStatus === 'online' ? 'positive' : 'negative'"
            class="q-ml-sm"
          />
        </q-card-section>
      </q-card>
    </div>

    <div
      v-if="Object.keys(slaves).length === 0 && masterStatus === 'online'"
      class="text-center q-pa-xl"
    >
      <q-spinner-dots color="primary" size="40px" />
      <div class="q-mt-md text-grey-8">Waiting for slave data...</div>
    </div>

    <div class="row q-col-gutter-md">
      <div
        v-for="slave in sortedSlaves"
        :key="slave.id"
        class="col-12 col-sm-6 col-md-4 col-lg-3"
      >
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center no-wrap">
              <div class="col">
                <div class="text-subtitle1 text-weight-medium">
                  Slave IP: {{ slave.id }}
                </div>
                <div class="text-caption text-grey">
                  Last seen: {{ new Date(slave.lastSeen).toLocaleTimeString() }}
                </div>
              </div>
              <div class="col-auto">
                <q-badge
                  :label="slave.status"
                  :color="slave.status === 'online' ? 'positive' : 'negative'"
                />
              </div>
            </div>
          </q-card-section>

          <q-list dense v-if="Object.keys(slave.handlers).length > 0">
            <q-item-label header class="text-body2">
              Sensor Handlers
            </q-item-label>
            <q-item
              v-for="(handler, type) in slave.handlers"
              :key="type"
              class="data-row"
              :class="{ 'updated': handler.updated }"
            >
              <q-item-section>
                <q-item-label class="text-capitalize">{{ type }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>
                  {{ handler.value.toFixed(2) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent } from 'vue'
import { io } from 'socket.io-client'

// Establish the socket connection
const socket = io('http://localhost:3000')

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
</script>

<style lang="scss" scoped>
/* Scoped styles only apply to this component */
.data-row.updated {
  animation: flash-blue 0.7s ease;
}

@keyframes flash-blue {
  0% {
    background-color: transparent;
  }
  30% {
    background-color: $blue-1; /* Using Quasar's color palette */
  }
  100% {
    background-color: transparent;
  }
}
</style>