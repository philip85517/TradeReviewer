import Decimal from 'decimal.js';
import type {StatementEvent} from '../import/monthly-statement';
import {canonicalInstrumentId} from '../instruments/display-name';

export type GiftAcquisitionEvidence = {
  kind: 'user-confirmed-zero-cost-gift';
  source: 'user';
  note: string;
  confirmedAt: string;
  currency: string;
};
export function isGiftAcquisitionMetadata(value: unknown): value is GiftAcquisitionEvidence {
  if (!value || typeof value !== 'object') return false;
  const v=value as Record<string,unknown>;
  return v.kind==='user-confirmed-zero-cost-gift' && v.source==='user' && typeof v.note==='string' && !!v.note.trim() && typeof v.confirmedAt==='string' && /^\d{4}-\d{2}-\d{2}T/.test(v.confirmedAt) && Number.isFinite(Date.parse(v.confirmedAt)) && typeof v.currency==='string' && /^[A-Z]{3}$/.test(v.currency);
}
/** Confirmation is independent of a broker's displayed cost/reference price. */
export function isGiftAcquisitionEvidence(event: StatementEvent): boolean {
  if(event.kind!=='transfer-in'||!event.documentId||!event.market||!event.symbol||!isGiftAcquisitionMetadata(event.giftAcquisition)||event.currency?.trim().toUpperCase()!==event.giftAcquisition.currency)return false;
  try{return new Decimal(event.quantity??'0').isFinite() && new Decimal(event.quantity??'0').gt(0);}catch{return false;}
}
/** Every original field, including the source row, binds a user confirmation. */
function giftSourceRowIdentity(event:StatementEvent):string {
 return JSON.stringify([event.documentId,event.accountId,event.market&&event.symbol?canonicalInstrumentId(event.symbol,event.market):null,event.kind,event.date,event.quantity,event.amount,event.currency,event.reportedUnitCost,event.description,event.source.map(fragment=>[fragment.page,fragment.row,fragment.role]),event.ipoAction,event.reversesEventId,event.displayTimePolicy]);
}
export function giftEventIdentity(event:StatementEvent):string {
 return JSON.stringify([event.id,giftSourceRowIdentity(event)]);
}
export function carryGiftAcquisitionEvidence(events:readonly StatementEvent[],prior:readonly StatementEvent[]):StatementEvent[]{
 const metadata=new Map<string,GiftAcquisitionEvidence>();const conflicts=new Set<string>(),descriptions=new Map<string,string>();
 for(const event of prior){
  if(event.giftAcquisition===undefined)continue;
  const key=giftEventIdentity(event),description=JSON.stringify(event.giftAcquisition),previous=descriptions.get(key);
  if(previous!==undefined&&previous!==description)conflicts.add(key);
  descriptions.set(key,description);
  if(isGiftAcquisitionEvidence(event))metadata.set(key,event.giftAcquisition!);
 }
 return events.map(event=>{const key=giftEventIdentity(event);return event.giftAcquisition||conflicts.has(key)||!metadata.has(key)?event:{...event,giftAcquisition:metadata.get(key)!};});
}
/** Check every raw occurrence before deduplication, including unconfirmed or
 * malformed occurrences. A confirmed reference must never hide a raw conflict. */
export function collectGiftAcquisitionEvidence(events:readonly StatementEvent[]):{events:StatementEvent[];duplicateKeys:string[]}{
 const references=new Map<string,{identities:Set<string>;metadata:Set<string>}>();
 const reference=(event:StatementEvent)=>JSON.stringify([event.accountId,event.id]);
 for(const event of events){
  const ref=reference(event),facts=references.get(ref)??{identities:new Set<string>(),metadata:new Set<string>()};
  facts.identities.add(giftEventIdentity(event));
  if(event.giftAcquisition!==undefined) facts.metadata.add(JSON.stringify(event.giftAcquisition));
  references.set(ref,facts);
 }
 const canonical=new Map<string,StatementEvent>(),duplicates=new Set<string>();
 for(const event of events){
  if(!isGiftAcquisitionEvidence(event))continue;
  const key=giftEventIdentity(event),facts=references.get(reference(event))!;
  if(facts.identities.size>1||facts.metadata.size>1)duplicates.add(key);
  const row=giftSourceRowIdentity(event),match=canonical.get(row);
  if(match&&match.id!==event.id){duplicates.add(key);duplicates.add(giftEventIdentity(match));}
  if(!match)canonical.set(row,event);
 }
 return {events:[...canonical.values()],duplicateKeys:[...duplicates]};
}
