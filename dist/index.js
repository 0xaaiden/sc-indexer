'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Indexer = exports.stores = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /* eslint-disable no-unused-vars */

var _bignumber = require('bignumber.js');

var _bignumber2 = _interopRequireDefault(_bignumber);

var _logger = require('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _ethereum = require('./ethereum.js');

var _ethereum2 = _interopRequireDefault(_ethereum);

var _file = require('./stores/file.js');

var _file2 = _interopRequireDefault(_file);

var _mongodb = require('./stores/mongodb.js');

var _mongodb2 = _interopRequireDefault(_mongodb);

var _utils = require('./utils.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var stores = exports.stores = {
  File: _file2.default,
  Mongodb: _mongodb2.default
};

var utils = {
  serialize: _utils.serialize, unserialize: _utils.unserialize
};

var waitForBlockchainSync = function waitForBlockchainSync(client) {
  return new Promise(function (resolve) {
    var i = 0;
    var getAndCheckStatus = function getAndCheckStatus(callback) {
      client.clientStatus().then(function (status) {
        if (i % 10 === 0) {
          _logger2.default.log('info', 'Waiting for Ethereum client to sync (block ' + status.syncing.currentBlock + '/' + status.syncing.highestBlock + ')');
        }
        if (status.syncing) {
          setTimeout(function () {
            return getAndCheckStatus(callback);
          }, 1000);
        } else {
          callback();
        }
        i += 1;
      });
    };
    getAndCheckStatus(function () {
      return resolve();
    });
  });
};

var Indexer = exports.Indexer = function () {
  function Indexer(store, abi, contractAddress, events) {
    var readProviderUrl = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'http://127.0.0.1:8545';

    _classCallCheck(this, Indexer);

    var eventsList = Object.keys(events);
    this.store = store;
    this.blockchain = new _ethereum2.default(abi, eventsList, contractAddress, readProviderUrl);
    this.limiter = this.blockchain.limiter;
  }

  _createClass(Indexer, [{
    key: 'syncAll',
    value: async function syncAll(_ref) {
      var _this = this;

      var fromBlock = _ref.fromBlock,
          _ref$toBlockNum = _ref.toBlockNum,
          toBlockNum = _ref$toBlockNum === undefined ? null : _ref$toBlockNum,
          chunkSize = _ref.chunkSize,
          _ref$live = _ref.live,
          live = _ref$live === undefined ? false : _ref$live;

      var dbpromise = await this.store.init();
      var clientStatus = await this.blockchain.clientStatus();
      var syncing = clientStatus.syncing,
          blockNumber = clientStatus.blockNumber,
          connected = clientStatus.connected;

      var toBlock = toBlockNum || blockNumber;
      var liveIndex = live;
      _logger2.default.log('warn', 'Current status of Ethereum client: syncing=' + JSON.stringify(syncing) + ', blockNumber=' + blockNumber + ', connected=' + connected);
      if (syncing) {
        await waitForBlockchainSync(this.blockchain);
      }
      _logger2.default.log('warn', 'Syncing contract ' + this.blockchain.contractAddress + ' from ' + this.blockchain.readProviderUrl + ' (blocks ' + fromBlock + ' to ' + toBlock + ')');

      // Track performance
      var eventsCount = 0;
      var blocksCount = 0;
      var previousEventsCount = 0;
      var previousBlocksCount = 0;
      setInterval(function () {
        console.log(_this.limiter.counts());
        if (previousEventsCount > 0 && blocksCount <= toBlock) {
          var eventsPerSecond = (eventsCount - previousEventsCount) / 5;
          var blocksPerSecond = (blocksCount - previousBlocksCount) / 5;

          var progress = Math.round(100 * blocksCount / (toBlock - fromBlock));
          var stats = 'events=' + eventsPerSecond + '/s, blocks=' + blocksPerSecond + '/s (totalBlocks=' + blocksCount + ', totalEvents=' + eventsCount + ', progress=' + progress + '%';
          _logger2.default.log('info', 'Indexing Ethereum events (' + stats + ')');
        }
        // console.log(`current events: ${eventsCount} current blocks: ${blocksCount}`);
        // console.log(`previous events: ${previousEventsCount} previous blocks: ${previousBlocksCount}`);
        previousEventsCount = eventsCount;
        previousBlocksCount = blocksCount;
      }, 5000);

      var skipBlocks = null;

      // need to implement this for mongo
      // if (this.store.getBlockInfo) {
      //   const blockInfo = await this.store.getBlockInfo();
      //   if (blockInfo && blockInfo.blockNumber) {
      //     skipBlocks = { min: fromBlock, max: blockInfo.blockNumber };
      //   }
      // }
      if (liveIndex) {
        this.blockchain.readNewEvents(toBlock, async function (event) {
          _logger2.default.log('info', 'Processing real-time Ethereum ' + event.event + ' event');
          // const normalizeEvent = event
          // normalizeEvent.blockNumber = new BigNumber(normalizeEvent.blockNumber)
          // normalizeEvent.transactionIndex = new BigNumber(normalizeEvent.transactionIndex)
          // normalizeEvent.logIndex = new BigNumber(normalizeEvent.logIndex)
          _this.store.put([event]);
        });
      }

      this.blockchain.readAllEvents(fromBlock, toBlock, chunkSize, async function (result) {
        var range = result.constructQuery;
        var eventsAll = result.result;
        // console.log('events: ', events.length, 'range: ', range);
        _logger2.default.log('info', '[' + range.fromBlock + ', ' + range.toBlock + '] Processed');
        eventsCount += eventsAll.length;
        blocksCount += range.toBlock - range.fromBlock;
        if (eventsAll.length > 0) {
          await _this.store.put(eventsAll);
        }
        // if (this.store.saveBlockInfo) {
        //   this.store.saveBlockInfo({ blockNumber: status.blockNumber }).then(() => {});
        // }
      });
    }
  }]);

  return Indexer;
}();