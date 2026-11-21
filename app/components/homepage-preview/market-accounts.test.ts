import {describe,it,expect} from 'vitest';
import {compatibleAccount} from './full-state';
// Only the scope directory is consumed by this pure selector.
const directory={core:{accounts:[{id:'all'},{id:'a'},{id:'b'},{id:'c'}]},accountIdsByMarket:{CN:['a'],HK:['a','b'],US:['c']}};
describe('market account compatibility',()=>{
 it('keeps the sentinel and compatible cross-market accounts',()=>{
  expect(compatibleAccount(directory,'US','all')).toBe('all');
  expect(compatibleAccount(directory,'CN','a')).toBe('a');
  expect(compatibleAccount(directory,'HK','a')).toBe('a');
 });
 it('resets incompatible and stale identities without narrowing the full catalog',()=>{
  expect(compatibleAccount(directory,'US','a')).toBe('all');
  expect(compatibleAccount(directory,'all','b')).toBe('b');
  expect(compatibleAccount(directory,'all','deleted')).toBe('all');
  expect(directory.core.accounts).toHaveLength(4);
 });
});
