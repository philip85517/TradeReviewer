import type { CommitReceipt, TradeChangeCommit } from "./sqlite-contracts";
import { StorageHttpError, type SqliteHttpClient } from "./sqlite-http-client";
import { parseTradeCommitReceipt } from "./trade-change-response";

export type TradeSubmissionPhase = "prepare-required" | "outcome-unknown" | "saved-awaiting-read" | "retry";
export class TradeSubmissionError extends Error {
  constructor(readonly phase: TradeSubmissionPhase, message: string, readonly receipt?: CommitReceipt) { super(message); }
}
export type ReviewedTradeSubmission = { envelope: TradeChangeCommit; receipt?: CommitReceipt; attempted?: boolean };

/** A retry first resolves the same request ID; a saved receipt survives failed reads. */
export async function submitReviewedTrade(client: SqliteHttpClient, state: ReviewedTradeSubmission) {
  if (!client.getTradeCommit || !client.commitTradeChanges || !client.readTradeBook) throw new TradeSubmissionError("retry", "成交保存接口暂不可用，请保留输入后重试。");
  if (!state.receipt && state.attempted) {
    try { const receipt = await client.getTradeCommit(state.envelope.requestId); if (receipt) state.receipt = parseTradeCommitReceipt(receipt, state.envelope.planId); }
    catch { throw new TradeSubmissionError("outcome-unknown", "保存结果尚未查明，请使用同一请求查证后重试。"); }
  }
  if (!state.receipt) {
    state.attempted = true;
    try { state.receipt = parseTradeCommitReceipt(await client.commitTradeChanges(state.envelope), state.envelope.planId); }
    catch (error) {
      if (error instanceof StorageHttpError && ["BOOK_VERSION_CHANGED", "PLAN_EXPIRED", "PLAN_NOT_FOUND"].includes(error.code)) throw new TradeSubmissionError("prepare-required", "已存成交或审核计划已变化，请重新准备并核对；本地输入保留。");
      if (error instanceof StorageHttpError && error.category) throw new TradeSubmissionError("retry", `${error.message} 本地输入保留，可重试。`);
      throw new TradeSubmissionError("outcome-unknown", "连接中断，保存结果尚未查明；请查证本次保存，勿重复创建请求。");
    }
  }
  try { return await client.readTradeBook({ version: { atLeast: state.receipt.bookVersion } }); }
  catch { throw new TradeSubmissionError("saved-awaiting-read", "修订已保存，当前成交刷新失败；请重试读取，勿重复修订。", state.receipt); }
}
