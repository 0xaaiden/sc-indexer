
import { promisify } from 'util'
import { MongoClient } from 'mongodb'
import { serialize, unserialize } from '../utils'

const mongodbInsertMany = (collection, events) => new Promise((accept, reject) => {
  collection.insertMany(events, (err) => {
    if (err) return reject(err)
    return accept()
  })
})

export default class MongodbStore {
  constructor (indexing, mongodbUrl) {
    this.indexing = indexing
    this.mongodbUrl = mongodbUrl
    // console.log('dddthis.dss');
  }

  async init () {
    if (!this.db) {
      // console.log('initbs.db');
      const mongoConnect = promisify(MongoClient.connect).bind(MongoClient)
      this.client = await mongoConnect(this.mongodbUrl)
      const mongoPath = this.mongodbUrl.split('/')
      this.db = this.client.db(mongoPath.slice(-1)[0])
      // console.log('client.db', this.client);
    }
  }

  close () {
    if (this.client) {
      this.client.close()
    }
  }

  async reset () {
    if (!this.db) {
      await this.init()
    }
    const promises = Object.keys(this.indexing.events).map((eventType) => {
      const collection = this.db.collection(eventType)
      const remove = promisify(collection.remove).bind(collection)
      return remove({})
    })
    await Promise.all(promises)
  }

  async put (events) {
    // console.log('putting events: ', events);
    const byCollection = {}
    for (let i = 0; events.length > i; i += 1) {
      // console.log('event', events[i].event, 'i', i, 'events.length', events.length);
      if (!byCollection[events[i].event]) byCollection[events[i].event] = []
      byCollection[events[i].event].push(events[i])
    }
    for (const eventType of Object.keys(byCollection)) {
      // console.log('db', this.db);
      const collection = this.db.collection(eventType)
      const serializedEvents = byCollection[eventType].map(event => serialize(event))
      await mongodbInsertMany(collection, serializedEvents)
    }
  }

  async get (eventType, indexId, value) {
    const collection = this.db.collection(eventType)
    const query = {}
    query[`args.${indexId}`] = value
    return new Promise((accept, reject) => {
      collection.find(query).toArray((err, result) => {
        if (err) return reject(err)
        return accept(result.map(item => unserialize(item)))
      })
    })
  }
}
