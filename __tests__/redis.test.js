'use strict';

// Dependencies
const redisLib = require('redis');
const redis = redisLib.createClient();
module.exports = redis;
