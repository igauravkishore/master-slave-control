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

<script src="./indexPage.js"></script>

<style lang="scss" scoped src="./indexPage.scss"></style>