'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _util = require('util');

var _mongodb = require('mongodb');

var _mongodb2 = _interopRequireDefault(_mongodb);

var _utils = require('../utils.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MongoClient = _mongodb2.default;

var mongodbInsertMany = function mongodbInsertMany(collection, events) {
  return new Promise(function (resolve, reject) {
    collection.insertMany(events, { ordered: false }, function (err) {
      console.log('duplicate events detected, skipping event');
      resolve(err);
    });
  });
};

var MondgoDbOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

var MongodbStore = function () {
  function MongodbStore(indexing, mongodbUrl) {
    _classCallCheck(this, MongodbStore);

    this.indexing = indexing;
    this.mongodbUrl = mongodbUrl;
    // console.log('dddthis.dss');
  }

  _createClass(MongodbStore, [{
    key: 'init',
    value: async function init() {
      if (!this.db) {
        // console.log('initbs.db');
        var mongoConnect = (0, _util.promisify)(MongoClient.connect).bind(MongoClient);
        this.client = await mongoConnect(this.mongodbUrl, MondgoDbOptions);
        var mongoPath = this.mongodbUrl.split('/');
        this.db = this.client.db(mongoPath.slice(-1)[0]);
        // console.log('client.db', this.client);
      }
    }
  }, {
    key: 'close',
    value: function close() {
      if (this.client) {
        this.client.close();
      }
    }
  }, {
    key: 'reset',
    value: async function reset() {
      var _this = this;

      if (!this.db) {
        await this.init();
      }
      var promises = Object.keys(this.indexing.events).map(function (eventType) {
        var collection = _this.db.collection(eventType);
        var remove = (0, _util.promisify)(collection.remove).bind(collection);
        return remove({});
      });
      await Promise.all(promises);
    }
  }, {
    key: 'put',
    value: async function put(events) {
      // console.log('putting events: ', events);
      var byCollection = {};
      for (var i = 0; events.length > i; i += 1) {
        // console.log('event', events[i].event, 'i', i, 'events.length', events.length);
        if (!byCollection[events[i].event]) byCollection[events[i].event] = [];
        byCollection[events[i].event].push(events[i]);
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Object.keys(byCollection)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var eventType = _step.value;

          // console.log('db', this.db);
          var collection = this.db.collection(eventType);
          this.db.collection(eventType).createIndex({ transactionHash: 1, logIndex: 1 }, { unique: true });
          var serializedEvents = byCollection[eventType].map(function (event) {
            return (0, _utils.serialize)(event);
          });
          await mongodbInsertMany(collection, serializedEvents);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: 'get',
    value: async function get(eventType, indexId, value) {
      var collection = this.db.collection(eventType);
      var query = {};
      query['args.' + indexId] = value;
      return new Promise(function (resolve, reject) {
        collection.find(query).toArray(function (err, result) {
          if (err) return reject(err);
          return resolve(result.map(function (item) {
            return (0, _utils.unserialize)(item);
          }));
        });
      });
    }
  }]);

  return MongodbStore;
}();

exports.default = MongodbStore;