'use strict';

var _abi = require('./abi.json');

var _abi2 = _interopRequireDefault(_abi);

var _mongodb = require('../../src/stores/mongodb.js');

var _mongodb2 = _interopRequireDefault(_mongodb);

var _index = require('../../src/index.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var sync = async function sync() {
  var indexing = {
    events: {
      liquidateBorrowAllowed: {
        keys: ['cTokenBorrowed', 'cTokenCollateral', 'liquidator', 'borrower', 'repayAmount']
      }
    }
  };
  var store = new _mongodb2.default(indexing, 'mongodb+srv://fullstack:fullstack@cluster1.fqooxtv.mongodb.net/events');
  var indexer = new _index.Indexer(store, _abi2.default, '0xe65cdB6479BaC1e22340E4E755fAE7E509EcD06c', 'https://falling-orbital-seed.quiknode.pro/50865472cdc06420870113b67bf37042d6f3a1bf/');
  await indexer.syncAll({
    // fromBlock: 3154100,
    fromBlock: 16312130,
    toBlck: 16315535,
    batchSize: 100
  });
};

sync().then(function () {}).catch(function (error) {
  console.error('Fatal error', error);
});