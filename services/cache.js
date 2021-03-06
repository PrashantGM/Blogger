const mongoose = require("mongoose");
const redis = require("redis");
const keys=require('../config/keys')

const client = redis.createClient(keys.redisUrl);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");
  return this;
};

async function start() {
  await client.connect();

  mongoose.Query.prototype.exec = async function () {
    if (!this.useCache) {
      return exec.apply(this, arguments);
    }
    const key = JSON.stringify(
      Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name,
      })
    );

    const cacheValue = await client.hGet(this.hashKey, key);

    if (cacheValue) {
      const doc = JSON.parse(cacheValue);

      const completeDoc = Array.isArray(doc)
        ? doc.map((d) => new this.model(d))
        : new this.model(doc);
      return completeDoc;
    }

    const result = await exec.apply(this, arguments);

    client.hSet(this.hashKey, key, JSON.stringify(result), "EX", 10);

    return result;
  };
}
start();

module.exports = {
  clearHash(haskKey) {
    client.del(JSON.stringify(haskKey));
  },
};
