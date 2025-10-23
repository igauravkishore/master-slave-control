const path = require('path');
const {MasterNode} = require('./MasterNode');
const {CONFIG_PARAMS: config} = require('../config/Config');

(() => {
  const master = new MasterNode(config.WEBSERVER_URL,
    config.SLAVE_PORT,
    path.join(__dirname, "master_config.json")
  );
  master.start();
})();