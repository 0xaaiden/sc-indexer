/* eslint-disable no-unused-vars */

import BigNumber from 'bignumber.js'

import logger from './logger.js'
import Ethereum from './ethereum.js'

import fileStore from './stores/file.js'
import mongodbStore from './stores/mongodb.js'
import { serialize, unserialize } from './utils.js'

export const stores = {
  File: fileStore,
  Mongodb: mongodbStore
}

const utils = {
  serialize, unserialize
}

const waitForBlockchainSync = client => new Promise((resolve) => {
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
  getAndCheckStatus(() => resolve())
})

export class Indexer {
  constructor (
    store,
    abi, contractAddress, events, readProviderUrl = 'http://127.0.0.1:8545'
  ) {
    const eventsList = Object.keys(events)
    this.store = store
    this.blockchain = new Ethereum(abi, eventsList, contractAddress, readProviderUrl)
    this.limiter = this.blockchain.limiter
  }

  async syncAll ({
    fromBlock, toBlockNum = null, chunkSize, live = false
  }) {
    const dbpromise = await this.store.init()
    const clientStatus = await this.blockchain.clientStatus()
    const { syncing, blockNumber, connected } = clientStatus
    const toBlock = toBlockNum || blockNumber
    const liveIndex = live
    logger.log('warn', `Current status of Ethereum client: syncing=${JSON.stringify(syncing)}, blockNumber=${blockNumber}, connected=${connected}`)
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
    if (liveIndex) {
      this.blockchain.readNewEvents(toBlock, async (event) => {
        logger.log('info', `Processing real-time Ethereum ${event.event} event`)
        // const normalizeEvent = event
        // normalizeEvent.blockNumber = new BigNumber(normalizeEvent.blockNumber)
        // normalizeEvent.transactionIndex = new BigNumber(normalizeEvent.transactionIndex)
        // normalizeEvent.logIndex = new BigNumber(normalizeEvent.logIndex)
        this.store.put([event])
      })
    }

    this.blockchain.readAllEvents(
      fromBlock,
      toBlock,
      chunkSize,
      async (result) => {
        const range = result.constructQuery
        const eventsAll = result.result
        // console.log('events: ', events.length, 'range: ', range);
        logger.log('info', `[${range.fromBlock}, ${range.toBlock}] Processed`)
        eventsCount += eventsAll.length
        blocksCount += (range.toBlock - range.fromBlock)
        if (eventsAll.length > 0) {
          await this.store.put(eventsAll)
        }
        // if (this.store.saveBlockInfo) {
        //   this.store.saveBlockInfo({ blockNumber: status.blockNumber }).then(() => {});
        // }
      }

    )
  }
}
