const {WebServer} = require("./WebServer");
const {CONFIG_PARAMS: config} = require("../config/Config");

(() => {
  const webServer = new WebServer(
    config.WEBSERVER_PORT
  );
  webServer.start();
})();