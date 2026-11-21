import type {ExecutionContentRef} from './execution-content-ref';
import {fullHash} from './full-projection';
const tokens=new WeakMap<object,string>();
export function sourceRefsKey(refs:ExecutionContentRef[]):string{return fullHash(refs.map(ref=>{let token=tokens.get(ref);if(!token){token=fullHash(ref);tokens.set(ref,token);}return token;}));}
export function evidenceKeys(value:unknown):string[]{const keys=new Set<string>(),seen=new WeakSet<object>();const visit=(item:unknown):void=>{if(!item||typeof item!=='object'||seen.has(item))return;seen.add(item);if('sourceRefsKey' in item&&typeof item.sourceRefsKey==='string')keys.add(item.sourceRefsKey);for(const child of Object.values(item))visit(child);};visit(value);return [...keys];}
/** Each coverage points into the same release response's evidence dictionary.
 * Only derived response repetition is removed; immutable published source
 * modules and every read-time manifest/reference validation remain intact. */
export function compactFullEvidence(result:object):Record<string,ExecutionContentRef[]>{
 const refsByKey:Record<string,ExecutionContentRef[]>={},keys=new WeakMap<ExecutionContentRef[],string>(),visited=new WeakSet<object>();
 const walk=(value:unknown):void=>{
  if(!value||typeof value!=='object'||visited.has(value))return;visited.add(value);
  if(!Array.isArray(value)&&'affectedSourceRefs' in value&&Array.isArray(value.affectedSourceRefs)){
   const refs=value.affectedSourceRefs as ExecutionContentRef[];
   let key=keys.get(refs);if(!key){key=sourceRefsKey(refs);keys.set(refs,key);}
   refsByKey[key]??=refs;const coverage=value as {sourceRefsKey:string;affectedSourceRefs?:ExecutionContentRef[]};coverage.sourceRefsKey=key;delete coverage.affectedSourceRefs;
  }
  for(const child of Object.values(value))walk(child);
 };
 walk(result);return refsByKey;
}
