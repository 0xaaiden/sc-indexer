'use strict';

var _require = require('sc-indexer'),
    Indexer = _require.Indexer,
    stores = _require.stores;

var EtherdeltaABI = require('./abi.json');
var indexing = {
  events: {
    Withdraw: {
      keys: ['user']
    },
    Trade: {
      keys: ['tokenGive', 'tokenGet', 'get', 'give']
    }
  }
};
var newStore = new stores.Mongodb(indexing, 'mongodb_url');
var indexer = new Indexer(newStore, EtherdeltaABI, '0x8d12a197cb00d4747a1fe03395095ce2a5cc6819', 'rpc_url');
indexer.syncAll({
  // fromBlock: 3154100,
  fromBlock: 4800000,
  toBlockNum: null,
  chunkSize: 50,
  events: indexing.events
});