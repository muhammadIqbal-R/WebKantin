import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import {ReplayCipher} from '../src/replay.js';
test('checkout replay uses authenticated encryption, fresh nonce and rejects tampering/missing key',()=>{
 const cipher=new ReplayCipher(randomBytes(32).toString('base64')),input={test:'private replay token'},a=cipher.encrypt(input),b=cipher.encrypt(input);assert.notEqual(a,b);assert.deepEqual(cipher.decrypt(a),input);assert.equal(a.includes(input.test),false);
 const raw=Buffer.from(a.slice(3),'base64url');raw[raw.length-1]^=1;assert.throws(()=>cipher.decrypt('v1:'+raw.toString('base64url')));assert.throws(()=>new ReplayCipher(undefined).encrypt(input));
});
