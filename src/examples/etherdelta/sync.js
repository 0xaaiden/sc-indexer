const { Indexer, stores } = require('sc-indexer')

const EtherdeltaABI = require('./abi.json')
const indexing = {
  events: {
    Withdraw: {
      keys: ['user']
    },
    Trade: {
      keys: ['tokenGive', 'tokenGet', 'get', 'give']
    }
  }
}
const newStore = new stores.Mongodb(indexing, 'mongodb_url')
const indexer = new Indexer(newStore, EtherdeltaABI, '0x8d12a197cb00d4747a1fe03395095ce2a5cc6819', 'rpc_url')
indexer.syncAll({
// fromBlock: 3154100,
  fromBlock: 4800000,
  toBlockNum: null,
  chunkSize: 50,
  events: indexing.events
})
