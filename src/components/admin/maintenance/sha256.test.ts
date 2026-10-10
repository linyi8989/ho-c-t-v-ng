import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { IncrementalSha256 } from './sha256';
test('incremental SHA-256 matches native digest for padding boundaries and chunk splits',()=>{
  for(const size of [0,1,3,55,56,63,64,65,127,128,1024,2*1024*1024+17]){
    const bytes=crypto.randomBytes(size),hash=new IncrementalSha256();
    for(let offset=0;offset<bytes.length;offset+=137)hash.update(bytes.subarray(offset,offset+137));
    assert.equal(hash.digest(),crypto.createHash('sha256').update(bytes).digest('hex'),'size '+size);
  }
});
test('known SHA-256 vector and finalization guard',()=>{
  const hash=new IncrementalSha256().update(new TextEncoder().encode('abc'));
  assert.equal(hash.digest(),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.throws(()=>hash.update(new Uint8Array()),/finalized/);
});
