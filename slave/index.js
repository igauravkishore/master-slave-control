const {SlaveNode} = require("./Slave");
const {CONFIG_PARAMS: config} = require("../config/Config");
const path = require("path");

(() => {
  const slave = new SlaveNode(
    config.SLAVE_URL,
    path.join(__dirname, "slave_identity.json"),
    path.join(__dirname, "slave_config.json")
  );
  slave.start();
})();