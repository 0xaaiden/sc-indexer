
import BigNumber from 'bignumber.js'

import logger from './src/logger'
import Ethereum from './src/ethereum'

import fileStore from './src/stores/file'
import mongodbStore from './src/stores/mongodb'
import { serialize, unserialize } from './src/utils'

export const stores = {
  file: fileStore,
  mongodb: mongodbStore
}

export const utils = {
  serialize, unserialize
}

const waitForBlockchainSync = client => new Promise((accept) => {
  let i = 0
  const getAndCheckStatus = (callback) => {
    client.clientStatus().then((status) => {
      if ((i % 10) === 0) {
        logger.log('info', `Waiting for Ethereum client to sync (block ${status.syncing.currentBlock}/${status.syncing.highestBlock})`)
      }
      if (status.syncing) {
        setTimeout(() => getAndCheckStatus(callback), 1000)
      } else {
        callback()
      }
      i += 1
    })
  }
  getAndCheckStatus(() => accept())
})

class Indexer {
  constructor (
    store,
    abi, contractAddress, readProviderUrl = 'http://127.0.0.1:8545', events
  ) {
    this.store = store
    // console.log('i did init that bs');
    this.blockchain = new Ethereum(abi, contractAddress, readProviderUrl)
    this.limiter = this.blockchain.limiter
  }

  async syncAll ({
    chunkSize, fromBlock, toBlockNum = null, eventsList
  }) {
    // wait for db to connect
    const dbpromise = await this.store.init()
    const clientStatus = await this.blockchain.clientStatus()
    const { syncing, blockNumber } = clientStatus
    const toBlock = toBlockNum || blockNumber
    console.log('block number: ', toBlock)
    logger.log('warn', `Current status of Ethereum client: syncing=${JSON.stringify(syncing)}, blockNumber=${blockNumber}`)
    if (syncing) {
      await waitForBlockchainSync(this.blockchain)
    }
    logger.log('warn', `Syncing contract ${this.blockchain.contractAddress} from ${this.blockchain.readProviderUrl} (blocks ${fromBlock} to ${toBlock})`)

    // Track performance
    let eventsCount = 0
    let blocksCount = 0
    let previousEventsCount = 0
    let previousBlocksCount = 0
    setInterval(() => {
      console.log(this.limiter.counts())
      if (previousEventsCount > 0 && blocksCount <= toBlock) {
        const eventsPerSecond = (eventsCount - previousEventsCount) / 5
        const blocksPerSecond = (blocksCount - previousBlocksCount) / 5

        const progress = Math.round((100 * (blocksCount)) / (toBlock - fromBlock))
        const stats = `events=${eventsPerSecond}/s, blocks=${blocksPerSecond}/s (totalBlocks=${blocksCount}, totalEvents=${eventsCount}, progress=${progress}%`
        logger.log('info', `Indexing Ethereum events (${stats})`)
      }
      // console.log(`current events: ${eventsCount} current blocks: ${blocksCount}`);
      // console.log(`previous events: ${previousEventsCount} previous blocks: ${previousBlocksCount}`);
      previousEventsCount = eventsCount
      previousBlocksCount = blocksCount
    }, 5000)

    const skipBlocks = null

    // need to implement this for mongo
    // if (this.store.getBlockInfo) {
    //   const blockInfo = await this.store.getBlockInfo();
    //   if (blockInfo && blockInfo.blockNumber) {
    //     skipBlocks = { min: fromBlock, max: blockInfo.blockNumber };
    //   }
    // }

    this.blockchain.readNewEvents(toBlock, async (event) => {
      logger.log('info', `Processing real-time Ethereum ${event.event} event`)
      const normalizeEvent = event
      normalizeEvent.blockNumber = new BigNumber(normalizeEvent.blockNumber)
      normalizeEvent.transactionIndex = new BigNumber(normalizeEvent.transactionIndex)
      normalizeEvent.logIndex = new BigNumber(normalizeEvent.logIndex)
      this.store.put([normalizeEvent])
    })

    this.blockchain.readAllEvents(
      fromBlock,
      toBlock,
      chunkSize,
      eventsList,
      async (result) => {
        const range = result.constructQuery
        const events = result.result
        // console.log('events: ', events.length, 'range: ', range);
        logger.log('info', `[${range.fromBlock}, ${range.toBlock}] Processed`)
        eventsCount += events.length
        blocksCount += (range.toBlock - range.fromBlock)
        if (events.length > 0) {
          await this.store.put(events)
        }
        // if (this.store.saveBlockInfo) {
        //   this.store.saveBlockInfo({ blockNumber: status.blockNumber }).then(() => {});
        // }
      }

    )
  }
}

module.exports = Indexer
