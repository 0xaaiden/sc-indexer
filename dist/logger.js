'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// destructuring the winston object to get the createLogger, transports and format objects

var createLogger = _winston2.default.createLogger,
    transports = _winston2.default.transports,
    format = _winston2.default.format;


var myFormat = format.printf(function (info) {
  return info.timestamp + ' ' + info.level + ': ' + info.message;
});

exports.default = createLogger({
  transports: [new transports.Console()],
  format: format.combine(format.timestamp(), myFormat)
});