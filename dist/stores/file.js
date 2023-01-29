'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _rimraf = require('rimraf');

var _rimraf2 = _interopRequireDefault(_rimraf);

var _utils = require('../utils.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FileStore = function () {
  function FileStore(indexing, dbPath) {
    _classCallCheck(this, FileStore);

    this.indexing = indexing;
    this.dbPath = dbPath;
  }

  _createClass(FileStore, [{
    key: 'init',
    value: function init() {
      if (!_fs2.default.existsSync(this.dbPath)) {
        _fs2.default.mkdirSync(this.dbPath);
      }
    }
  }, {
    key: 'reset',
    value: async function reset() {
      var _this = this;

      await new Promise(function (resolve) {
        return (0, _rimraf2.default)(_this.dbPath, resolve);
      });
      this.init();
    }
  }, {
    key: 'saveBlockInfo',
    value: async function saveBlockInfo(blockInfo) {
      var filePath = this.dbPath + '/blockInfo.json';
      _fs2.default.writeFileSync(filePath, JSON.stringify(blockInfo));
    }
  }, {
    key: 'getBlockInfo',
    value: async function getBlockInfo() {
      var filePath = _path2.default.resolve(this.dbPath, 'blockInfo.json');
      if (!_fs2.default.existsSync(filePath)) {
        return null;
      }
      return JSON.parse(_fs2.default.readFileSync(filePath).toString());
    }
  }, {
    key: 'put',
    value: function put(events) {
      var _this2 = this;

      var _loop = function _loop(i) {
        var event = events[i];
        var config = _this2.indexing.events[event.event];
        if (config && config.keys) {
          config.keys.forEach(function (key) {
            var indexKey = event.event + '-' + key + '-' + event.args[key];
            var filePath = _this2.dbPath + '/' + indexKey + '.jsons';
            var data = JSON.stringify((0, _utils.serialize)(event));
            _fs2.default.appendFileSync(filePath, data + '\n');
          });
        }
      };

      for (var i = 0; events.length > i; i += 1) {
        _loop(i);
      }
    }
  }, {
    key: 'get',
    value: function get(eventType, indexId, value) {
      var indexKey = eventType + '-' + indexId + '-' + value;
      var filePath = this.dbPath + '/' + indexKey + '.jsons';
      if (!_fs2.default.existsSync(filePath)) {
        return [];
      }
      return _fs2.default.readFileSync(filePath).toString().split('\n').filter(function (line) {
        return line.length > 0;
      }).map(function (line) {
        return JSON.parse(line);
      }).map(function (e) {
        return (0, _utils.unserialize)(e);
      });
    }
  }]);

  return FileStore;
}();

exports.default = FileStore;