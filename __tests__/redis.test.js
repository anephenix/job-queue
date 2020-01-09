'use strict';

// Dependencies
const bluebird = require('bluebird');
const redisLib = require('redis');
bluebird.promisifyAll(redisLib.RedisClient.prototype);
bluebird.promisifyAll(redisLib.Multi.prototype);
const redis = redisLib.createClient();
module.exports = redis;
