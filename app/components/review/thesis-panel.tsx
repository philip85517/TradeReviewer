"use client";

import { Brain, CheckCircle2, ShieldCheck } from "lucide-react";

type Props = {
  thesis: string;
  onThesisChange: (value: string) => void;
};

export function ThesisPanel({ thesis, onThesisChange }: Props) {
  return (
    <aside className="thesis-panel">
      <div className="thesis-header">
        <div>
          <span className="eyebrow">当时的我</span>
          <h2>交易预期</h2>
        </div>
        <span className="autosave">
          <CheckCircle2 size={13} />
          自动保存
        </span>
      </div>
      <label className="thesis-field">
        <span>
          <Brain size={14} />
          买入理由
        </span>
        <textarea
          value={thesis}
          onChange={(event) => onThesisChange(event.target.value)}
          placeholder="只写当时能知道的内容…"
        />
      </label>
      <div className="expectation-card">
        <span>预期路径</span>
        <p>宽幅震荡后突破 22.80，回踩不破再加仓。</p>
      </div>
      <div className="risk-plan">
        <div>
          <span>失效条件</span>
          <strong>跌破 16.22</strong>
        </div>
        <div>
          <span>目标区间</span>
          <strong>22.80–26.00</strong>
        </div>
        <div>
          <span>最大风险</span>
          <strong>1.0R</strong>
        </div>
      </div>
      <div className="future-guard">
        <ShieldCheck size={16} />
        <p>
          <strong>未来信息已锁定</strong>
          后续 K 线、成交与事后标注不会提前出现。
        </p>
      </div>
    </aside>
  );
}
