'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.unserialize = exports.serialize = undefined;

var _bignumber = require('bignumber.js');

var _bignumber2 = _interopRequireDefault(_bignumber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isBigNumber = function isBigNumber(value) {
  return value.isBigNumber === true || value instanceof _bignumber2.default || value.lte && value.toNumber;
};

var serializeBigNumber = function serializeBigNumber(value) {
  if (isBigNumber(value)) {
    return {
      type: 'BigNumber',
      value: value.toString()
    };
  }
  return value;
};

var unserializeBigNumber = function unserializeBigNumber(value) {
  if (value && value.type === 'BigNumber') {
    return new _bignumber2.default(value.value);
  }
  return value;
};

var serialize = exports.serialize = function serialize(event) {
  var doc = Object.assign({}, event);
  for (var key in event) {
    if (event[key]) {
      doc[key] = serializeBigNumber(event[key]);
    }
  }
  for (var _key in event.args) {
    if (event.args[_key]) {
      doc.args[_key] = serializeBigNumber(event.args[_key]);
    }
  }
  return doc;
};

var unserialize = exports.unserialize = function unserialize(doc) {
  var event = Object.assign({}, doc);
  for (var key in doc) {
    if (doc[key]) {
      event[key] = unserializeBigNumber(doc[key]);
    }
  }
  for (var _key2 in doc.args) {
    if (doc.args[_key2]) {
      event.args[_key2] = unserializeBigNumber(doc.args[_key2]);
    }
  }
  return event;
};