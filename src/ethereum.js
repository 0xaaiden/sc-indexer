import BigNumber from 'bignumber.js'
import Eth from 'ethjs'
import EthQuery from 'ethjs-query'
import Web3 from 'web3'
import Bottleneck from 'bottleneck'
import abiDecoder from 'abi-decoder'
import logger from './logger.js'

const normalizeEvent = (event) => {
  const normalizedEvent = Object.assign({}, event)
  if (typeof normalizeEvent.blockNumber === 'number') {
    normalizeEvent.blockNumber = new BigNumber(normalizeEvent.blockNumber)
  }
  if (typeof normalizeEvent.transactionIndex === 'number') {
    normalizeEvent.transactionIndex = new BigNumber(normalizeEvent.transactionIndex)
  }
  if (typeof normalizeEvent.logIndex === 'number') {
    normalizeEvent.logIndex = new BigNumber(normalizeEvent.logIndex)
  }
  return normalizedEvent
}

export default class Ethereum {
  constructor (abi, contractAddress, readProviderUrl) {
    this.readProviderUrl = readProviderUrl
    this.contractAddress = contractAddress
    this.abi = abi
    this.readEthQuery = new EthQuery(new Eth.HttpProvider(readProviderUrl))
    // this.web3 = new Web3(new Web3.providers.HttpProvider(readProviderUrl));
    // wss connection
    this.web3 = new Web3(new Web3.providers.HttpProvider(readProviderUrl))
    abiDecoder.addABI(abi)
    this.web3Contract = new this.web3.eth.Contract(abi, contractAddress)

    this.limiter = new Bottleneck({
      maxConcurrent: 3,
      minTime: 333,
      trackDoneStatus: true
    })
  }

  constructEventSignature (event) {
    // given event name, search in abi
    const eventAbi = this.web3Contract.options.jsonInterface.find(abi => abi.name === event)
    // construct event signature
    const eventSignature = this.web3.eth.abi.encodeEventSignature(eventAbi)
    return eventSignature
  }

  async getEventsForBlock (blockRange, eventsSignatures, numRetries = 0) {
    const constructQuery = {
      fromBlock: blockRange.start,
      toBlock: blockRange.end,
      address: this.contractAddress,
      topics: [this.eventsSignatures]
    }
    try {
      const result = await this.web3.eth.getPastLogs(constructQuery)
      // const logDecoded = logDecoder(result);
      const logsdecoded = abiDecoder.decodeLogs(result)
      for (let i = 0; result.length > i; i += 1) {
        result[i].args = logsdecoded[i]
        result[i].event = result[i].args.name
      }
      // console.log('result', result);
      // console.log('for block range', blockRange, 'got', result.length, 'events', 'size in mb of result', Buffer.byteLength(JSON.stringify(result)) / 1024 / 1024);
      return { constructQuery, result }
    } catch (error) {
      let retries = numRetries

      if (numRetries > 30) {
        logger.log(`error getting logs for block range:${blockRange}too many retries`)
        return []
      }
      if ((blockRange.end - blockRange.start) < 2) {
        // wait for 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000))
        const result = await this.getEventsForBlock(blockRange, retries)
        return result.result
      }
      retries += 1
      logger.log('error', `error getting logs for block range: ${blockRange.end}:${blockRange.start} splitting up range and retrying`)
      const middleBlock = Math.ceil((blockRange.start + blockRange.end) / 2)
      const leftRange = { start: blockRange.start, end: middleBlock }
      const rightRange = { start: middleBlock + 1, end: blockRange.end }
      const leftResult = await this.getEventsForBlock(leftRange, retries)
      const rightResult = await this.getEventsForBlock(rightRange, retries)
      const result = [...leftResult.result, ...rightResult.result]
      return { constructQuery, result }
    }
  }

  // deprecated functions
  readNewEvents (fromBlock, fn) {
    const options = {
      fromBlock,
      address: this.contractAddress,
      topics: [this.eventsSignatures]
    }
    const filter = this.web3.eth.subscribe('logs', options)

    filter.on('connected', (subscriptionId) => {
      logger.log('info', `Subscribed to contract events, subscriptionId: ${subscriptionId}`)
    })
    filter.on('error', (error) => {
      logger.log('error', `Got error while reading realtime events from contract: ${error}`)
    })

    filter.on('data', (event) => {
      const eventClone = event
      const decodedEvent = abiDecoder.decodeLogs([event])
      eventClone.args = decodedEvent[0].args
      eventClone.event = event.args.name

      const normalizedEvent = normalizeEvent(event)
      if (!normalizedEvent) {
        logger.log('warn', `Got error while reading realtime events from contract: ${normalizedEvent}`)
      } else {
        fn(normalizedEvent).then(() => {})
      }
    })
  }

  async clientStatus () {
    const syncing = await this.web3.eth.isSyncing()
    const blockNumber = await this.web3.eth.getBlockNumber()
    return {
      syncing,
      blockNumber
    }
  }

  async readAllEvents (fromBlock, toBlock, chunkSize, eventsList, fn) {
    const blockChunks = []
    const maxBlockChunkSize = chunkSize
    // get events signatures for all events and print them
    const eventsSignatures = []

    for (let i = 0; i < eventsList.length; i += 1) {
      const eventSignature = this.constructEventSignature(eventsList[i])
      eventsSignatures.push(eventSignature)
    }
    this.eventsSignatures = eventsSignatures
    let currentStart = fromBlock
    while (currentStart < toBlock) {
      const currentEnd = Math.min(currentStart + maxBlockChunkSize, toBlock)
      blockChunks.push({ start: currentStart, end: currentEnd })
      currentStart = currentEnd + 1
    }
    const blockPromises = blockChunks.map(range => this.limiter.schedule({ range }, this.getEventsForBlock.bind(this), range).then((events) => {
      events.constructQuery.fromBlock = range.start
      events.constructQuery.toBlock = range.end
      fn(events)
    }))
    const events = await Promise.all(blockPromises)
    logger.log('events are ready', 'length', events.length)
  }
}
