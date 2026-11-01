const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');

test('concurrent cold requests share one connection; failures and disconnects can retry', async () => {
  const attempts = [];
  const mongoose = { connection: { readyState: 0 }, connect: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })) };
  const context = { require: () => mongoose, module: { exports: {} }, process: { env: { VERCEL: '1', MONGODB_URI: 'mongodb://example.invalid/test' } }, console: { error() {} } };
  vm.runInNewContext(fs.readFileSync('server/config/db.js', 'utf8'), context);
  const connect = context.module.exports;
  const first = connect(), second = connect();
  assert.equal(attempts.length, 1);
  attempts[0].reject(new Error('temporary outage'));
  await assert.rejects(first, /temporary outage/);
  await assert.rejects(second, /temporary outage/);
  const retry = connect();
  assert.equal(attempts.length, 2);
  mongoose.connection.readyState = 1; attempts[1].resolve(mongoose);
  assert.equal(await retry, mongoose);
  assert.equal(await connect(), mongoose);
  assert.equal(attempts.length, 2);
  mongoose.connection.readyState = 0;
  const reconnect = connect();
  assert.equal(attempts.length, 3);
  mongoose.connection.readyState = 1; attempts[2].resolve(mongoose);
  assert.equal(await reconnect, mongoose);
});
