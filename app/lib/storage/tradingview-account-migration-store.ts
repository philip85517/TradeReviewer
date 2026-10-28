import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { _createTradingViewTradeChanges } from "./sqlite-store";
import { committedTradingViewAliases } from "./tradingview-account-migration.internal";
import { TradeChangeError, type ReviewPlan } from "./sqlite-contracts";
import {
  TradingViewMigrationTransactionError,
  type TradingViewAccountMigrationTransactionOptions,
  type TradingViewMigrationAlias, type TradingViewMigrationCommitRequest, type TradingViewMigrationCommitResult,
  type TradingViewMigrationPreview, type TradingViewMigrationPreviewRequest,
  type TradingViewMigrationRollbackPreview, type TradingViewMigrationRollbackPreviewRequest,
  type TradingViewMigrationRollbackRequest, type TradingViewMigrationRollbackResult,
} from "./tradingview-account-migration-contracts";

/** Compatibility facade. The shared engine owns every formal write transaction. */
export class TradingViewAccountMigrationStore {
  constructor(private readonly database: DatabaseSync, private readonly options: TradingViewAccountMigrationTransactionOptions = {}) {}
  private savedPlan(operationId: string, rollbackOperationId?: string): ReviewPlan | null {
    const kind=rollbackOperationId ? "tradingview-account-migration-rollback" : "tradingview-account-migration";
    const row=this.database.prepare(`select body_json,body_digest from trade_change_plans where body_json is not null
      and json_extract(body_json,'$.review.kind')=? and json_extract(body_json,'$.prepared.tradingView.intent.operationId')=?
      and (? is null or json_extract(body_json,'$.prepared.tradingView.intent.rollbackOperationId')=?) order by rowid limit 1`)
      .get(kind,operationId,rollbackOperationId??null,rollbackOperationId??null);
    if(!row) return null;
    if(createHash("sha256").update(String(row.body_json)).digest("hex")!==row.body_digest) throw new TradingViewMigrationTransactionError(rollbackOperationId?"migration-rollback-stale":"migration-stale","Stored migration plan integrity failed");
    return (JSON.parse(String(row.body_json)) as {review:ReviewPlan}).review;
  }
  private compatibility<T>(rollback:boolean,work:()=>T):T {
    try{return work();}catch(error){
      if(error instanceof TradeChangeError && ["BOOK_VERSION_CHANGED","PLAN_EXPIRED","PLAN_CORRUPT","POLICY_CHANGED","REQUEST_CONFLICT","PLAN_CONSUMED"].includes(error.code)) {
        const conflict=error.code==="REQUEST_CONFLICT"||error.code==="PLAN_CONSUMED";
        throw new TradingViewMigrationTransactionError(conflict ? rollback?"migration-rollback-conflict":"migration-idempotency-conflict" : rollback?"migration-rollback-stale":"migration-stale",error.message,{engineCode:error.code});
      }
      throw error;
    }
  }
  preview(request:TradingViewMigrationPreviewRequest={}):TradingViewMigrationPreview {
    return this.compatibility(false,()=>{
      const operationId=request.operationId??crypto.randomUUID();
      const review=this.savedPlan(operationId)??_createTradingViewTradeChanges(this.database,this.options).prepare({kind:"tradingview-account-migration",operationId});
      return review.tradingView as TradingViewMigrationPreview;
    });
  }
  commit(request:TradingViewMigrationCommitRequest):TradingViewMigrationCommitResult {
    return this.compatibility(false,()=>{
      const changes=_createTradingViewTradeChanges(this.database,this.options);
      const review=this.savedPlan(request.operationId)??changes.prepare({kind:"tradingview-account-migration",operationId:request.operationId});
      const prior=this.database.prepare("select operation_id from tradingview_account_migration_operations where operation_id=?").get(request.operationId);
      const receipt=changes.commit({requestId:`tv-commit:${request.operationId}`,planId:review.planId,choices:{},maintenanceRequest:request});
      const result=receipt.result.tradingView as TradingViewMigrationCommitResult;
      return {...result,idempotent:Boolean(prior)||result.idempotent};
    });
  }
  rollbackPreview(request:TradingViewMigrationRollbackPreviewRequest):TradingViewMigrationRollbackPreview {
    return this.compatibility(true,()=>{
      const review=_createTradingViewTradeChanges(this.database,this.options).prepare({kind:"tradingview-account-migration-rollback",operationId:request.operationId,rollbackOperationId:crypto.randomUUID(),...(request.expectedAfterSnapshotDigest===undefined?{}:{expectedAfterSnapshotDigest:request.expectedAfterSnapshotDigest})});
      return review.tradingView as TradingViewMigrationRollbackPreview;
    });
  }
  rollback(request:TradingViewMigrationRollbackRequest):TradingViewMigrationRollbackResult {
    return this.compatibility(true,()=>{
      const changes=_createTradingViewTradeChanges(this.database,this.options);
      const review=this.savedPlan(request.operationId,request.rollbackOperationId)??changes.prepare({kind:"tradingview-account-migration-rollback",operationId:request.operationId,rollbackOperationId:request.rollbackOperationId,expectedAfterSnapshotDigest:request.expectedAfterSnapshotDigest});
      const prior=this.database.prepare("select operation_id from tradingview_account_migration_operations where operation_id=?").get(request.rollbackOperationId);
      const receipt=changes.commit({requestId:`tv-rollback:${request.rollbackOperationId}`,planId:review.planId,choices:{},maintenanceRequest:request});
      const result=receipt.result.tradingView as TradingViewMigrationRollbackResult;
      return {...result,idempotent:Boolean(prior)||result.idempotent};
    });
  }
  getCommittedAliases(operationId?:string):TradingViewMigrationAlias[]{return committedTradingViewAliases(this.database,operationId);}
}

export class TradingViewAccountMigrationTransactionStore extends TradingViewAccountMigrationStore {}

export function previewTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationPreviewRequest = {}, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationPreview {
  return new TradingViewAccountMigrationStore(database, options).preview(request);
}

export function commitTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationCommitRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationCommitResult {
  return new TradingViewAccountMigrationStore(database, options).commit(request);
}

export function rollbackTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationRollbackRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationRollbackResult {
  return new TradingViewAccountMigrationStore(database, options).rollback(request);
}

export function rollbackPreviewTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationRollbackPreviewRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationRollbackPreview {
  return new TradingViewAccountMigrationStore(database, options).rollbackPreview(request);
}

export const previewRollbackTradingViewAccountMigration = rollbackPreviewTradingViewAccountMigration;
