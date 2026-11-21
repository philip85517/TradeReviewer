import type {ExecutionContentRef} from './execution-content-ref';
import {fullCanonical} from './full-projection';
const TOKEN='$fullEvidence';
export function isExecutionRef(value:unknown):value is ExecutionContentRef{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const ref=value as Record<string,unknown>;
 return Object.keys(ref).length===4&&ref.schemaVersion===1&&typeof ref.executionId==='string'&&typeof ref.rawVersion==='string'&&typeof ref.effectiveVersion==='string';
}
// Keep generic canonical identity for anything beyond these four own fields.
export function isStrictExecutionRef(value:unknown):value is ExecutionContentRef{
 return isExecutionRef(value)&&Object.keys(value).every(key=>key==='schemaVersion'||key==='executionId'||key==='rawVersion'||key==='effectiveVersion');
}
/** JSON-only storage normalization. Order, duplicates and complete ref content
 * are restored before the existing business/reference validation executes. */
export function encodeSourceEvidence(modules:Record<string,unknown[]>){
 const refs:ExecutionContentRef[]=[],indices=new Map<string,number>();
 const encode=(value:unknown):unknown=>{
  if(isExecutionRef(value)){const identity=fullCanonical(value);let index=indices.get(identity);if(index===undefined){index=refs.length;indices.set(identity,index);refs.push(value);}return {[TOKEN]:index};}
  if(Array.isArray(value))return value.map(encode);
  if(value&&typeof value==='object'){if(TOKEN in value)throw new Error('reserved source evidence token');return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,encode(child)]));}
  return value;
 };
 return {refs,modules:Object.fromEntries(Object.entries(modules).map(([key,rows])=>[key,encode(rows) as unknown[]]))};
}
export function sourceEvidenceDecoder(refs:ExecutionContentRef[]){
 if(refs.some(ref=>!isExecutionRef(ref))||new Set(refs.map(ref=>isStrictExecutionRef(ref)?JSON.stringify([ref.schemaVersion,ref.executionId,ref.rawVersion,ref.effectiveVersion]):fullCanonical(ref))).size!==refs.length)throw new Error('invalid full source evidence identities');
 const used=new Set<number>();
 const decode=(value:unknown):unknown=>{
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=decode(value[i]);return value;}
  if(value&&typeof value==='object'){
   if(TOKEN in value){const index=(value as Record<string,unknown>)[TOKEN];if(Object.keys(value).length!==1||typeof index!=='number'||!Number.isSafeInteger(index)||index<0||index>=refs.length)throw new Error('dangling full source evidence reference');used.add(index);return refs[index];}
   const object=value as Record<string,unknown>;for(const key of Object.keys(object))object[key]=decode(object[key]);return object;
  }
  return value;
 };
 return {decode,assertComplete(){if(used.size!==refs.length)throw new Error('unused full source evidence identity');}};
}
