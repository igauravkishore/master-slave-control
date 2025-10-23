const winston = require("winston");

// Format for the console (with colors)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Format for the files (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.uncolorize(), // Removes color codes for clean file output
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

/**
 * Creates a new Winston logger instance for a specific module.
 * @param {string} logName - The base name for the log files (e.g., 'webserver')
 */
const createLogger = (logName) => {
  return winston.createLogger({
    level: "info", // Default log level
    transports: [
      // 1. Log to the console (we still want to see all logs in one place)
      new winston.transports.Console({
        format: consoleFormat,
      }),

      // 2. Log only errors to a specific error file
      new winston.transports.File({
        filename: `${logName}.error.log`, // e.g., webserver.error.log
        level: "error",
        format: fileFormat,
      }),

      // 3. Log all 'info' and higher messages to a combined file
      new winston.transports.File({
        filename: `${logName}.log`, // e.g., webserver.log
        format: fileFormat,
      }),
    ],
  });
};

// Export the function that creates the logger
module.exports = createLogger;