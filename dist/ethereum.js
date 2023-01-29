'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bignumber = require('bignumber.js');

var _bignumber2 = _interopRequireDefault(_bignumber);

var _ethjs = require('ethjs');

var _ethjs2 = _interopRequireDefault(_ethjs);

var _ethjsQuery = require('ethjs-query');

var _ethjsQuery2 = _interopRequireDefault(_ethjsQuery);

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _bottleneck = require('bottleneck');

var _bottleneck2 = _interopRequireDefault(_bottleneck);

var _abiDecoder = require('abi-decoder');

var _abiDecoder2 = _interopRequireDefault(_abiDecoder);

var _logger = require('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var normalizeEvent = function normalizeEvent(event) {
  var normalizedEvent = Object.assign({}, event);
  if (typeof normalizeEvent.blockNumber === 'number') {
    normalizeEvent.blockNumber = new _bignumber2.default(normalizeEvent.blockNumber);
  }
  if (typeof normalizeEvent.transactionIndex === 'number') {
    normalizeEvent.transactionIndex = new _bignumber2.default(normalizeEvent.transactionIndex);
  }
  if (typeof normalizeEvent.logIndex === 'number') {
    normalizeEvent.logIndex = new _bignumber2.default(normalizeEvent.logIndex);
  }
  return normalizedEvent;
};

var Ethereum = function () {
  function Ethereum(abi, contractAddress, readProviderUrl) {
    _classCallCheck(this, Ethereum);

    this.readProviderUrl = readProviderUrl;
    this.contractAddress = contractAddress;
    this.abi = abi;
    this.readEthQuery = new _ethjsQuery2.default(new _ethjs2.default.HttpProvider(readProviderUrl));
    // this.web3 = new Web3(new Web3.providers.HttpProvider(readProviderUrl));
    // wss connection
    this.web3 = new _web2.default(new _web2.default.providers.HttpProvider(readProviderUrl));
    _abiDecoder2.default.addABI(abi);
    this.web3Contract = new this.web3.eth.Contract(abi, contractAddress);

    this.limiter = new _bottleneck2.default({
      maxConcurrent: 3,
      minTime: 333,
      trackDoneStatus: true
    });
  }

  _createClass(Ethereum, [{
    key: 'constructEventSignature',
    value: function constructEventSignature(event) {
      // given event name, search in abi
      var eventAbi = this.web3Contract.options.jsonInterface.find(function (abi) {
        return abi.name === event;
      });
      // construct event signature
      var eventSignature = this.web3.eth.abi.encodeEventSignature(eventAbi);
      return eventSignature;
    }
  }, {
    key: 'getEventsForBlock',
    value: async function getEventsForBlock(blockRange, eventsSignatures) {
      var numRetries = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      var constructQuery = {
        fromBlock: blockRange.start,
        toBlock: blockRange.end,
        address: this.contractAddress,
        topics: [this.eventsSignatures]
      };
      try {
        var result = await this.web3.eth.getPastLogs(constructQuery);
        // const logDecoded = logDecoder(result);
        var logsdecoded = _abiDecoder2.default.decodeLogs(result);
        for (var i = 0; result.length > i; i += 1) {
          result[i].args = logsdecoded[i];
          result[i].event = result[i].args.name;
        }
        // console.log('result', result);
        // console.log('for block range', blockRange, 'got', result.length, 'events', 'size in mb of result', Buffer.byteLength(JSON.stringify(result)) / 1024 / 1024);
        return { constructQuery: constructQuery, result: result };
      } catch (error) {
        var retries = numRetries;

        if (numRetries > 30) {
          _logger2.default.log('error getting logs for block range:' + blockRange + 'too many retries');
          return [];
        }
        if (blockRange.end - blockRange.start < 2) {
          // wait for 1 second and retry
          await new Promise(function (resolve) {
            return setTimeout(resolve, 1000);
          });
          var _result2 = await this.getEventsForBlock(blockRange, retries);
          return _result2.result;
        }
        retries += 1;
        _logger2.default.log('error', 'error getting logs for block range: ' + blockRange.end + ':' + blockRange.start + ' splitting up range and retrying');
        var middleBlock = Math.ceil((blockRange.start + blockRange.end) / 2);
        var leftRange = { start: blockRange.start, end: middleBlock };
        var rightRange = { start: middleBlock + 1, end: blockRange.end };
        var leftResult = await this.getEventsForBlock(leftRange, retries);
        var rightResult = await this.getEventsForBlock(rightRange, retries);
        var _result = [].concat(_toConsumableArray(leftResult.result), _toConsumableArray(rightResult.result));
        return { constructQuery: constructQuery, result: _result };
      }
    }

    // deprecated functions

  }, {
    key: 'readNewEvents',
    value: function readNewEvents(fromBlock, fn) {
      var options = {
        fromBlock: fromBlock,
        address: this.contractAddress,
        topics: [this.eventsSignatures]
      };
      var filter = this.web3.eth.subscribe('logs', options);

      filter.on('connected', function (subscriptionId) {
        _logger2.default.log('info', 'Subscribed to contract events, subscriptionId: ' + subscriptionId);
      });
      filter.on('error', function (error) {
        _logger2.default.log('error', 'Got error while reading realtime events from contract: ' + error);
      });

      filter.on('data', function (event) {
        var eventClone = event;
        var decodedEvent = _abiDecoder2.default.decodeLogs([event]);
        eventClone.args = decodedEvent[0].args;
        eventClone.event = event.args.name;

        var normalizedEvent = normalizeEvent(event);
        if (!normalizedEvent) {
          _logger2.default.log('warn', 'Got error while reading realtime events from contract: ' + normalizedEvent);
        } else {
          fn(normalizedEvent).then(function () {});
        }
      });
    }
  }, {
    key: 'clientStatus',
    value: async function clientStatus() {
      var syncing = await this.web3.eth.isSyncing();
      var blockNumber = await this.web3.eth.getBlockNumber();
      return {
        syncing: syncing,
        blockNumber: blockNumber
      };
    }
  }, {
    key: 'readAllEvents',
    value: async function readAllEvents(fromBlock, toBlock, chunkSize, eventsList, fn) {
      var _this = this;

      var blockChunks = [];
      var maxBlockChunkSize = chunkSize;
      // get events signatures for all events and print them
      var eventsSignatures = [];

      for (var i = 0; i < eventsList.length; i += 1) {
        var eventSignature = this.constructEventSignature(eventsList[i]);
        eventsSignatures.push(eventSignature);
      }
      this.eventsSignatures = eventsSignatures;
      var currentStart = fromBlock;
      while (currentStart < toBlock) {
        var currentEnd = Math.min(currentStart + maxBlockChunkSize, toBlock);
        blockChunks.push({ start: currentStart, end: currentEnd });
        currentStart = currentEnd + 1;
      }
      var blockPromises = blockChunks.map(function (range) {
        return _this.limiter.schedule({ range: range }, _this.getEventsForBlock.bind(_this), range).then(function (events) {
          events.constructQuery.fromBlock = range.start;
          events.constructQuery.toBlock = range.end;
          fn(events);
        });
      });
      var events = await Promise.all(blockPromises);
      _logger2.default.log('events are ready', 'length', events.length);
    }
  }]);

  return Ethereum;
}();

exports.default = Ethereum;