export type FutuTemplateId = "F0" | "F1" | "F2" | "F3" | "F4" | "F4a" | "unknown";

export type FutuTemplateProfile = {
  id: FutuTemplateId;
  ruleId: string;
  status: "supported" | "unsupported";
  priority: number;
  reason: string;
};

type TemplateRule = FutuTemplateProfile & {
  document?: RegExp;
  header?: readonly RegExp[];
  documentOnly?: boolean;
};

const FUTU_TEMPLATE_RULES: readonly TemplateRule[] = [
  {
    id: "F0",
    ruleId: "futu/pdf/f0-contract-date@1",
    status: "supported",
    priority: 100,
    document: /交易合約明細/,
    documentOnly: true,
    reason: "交易合約明細版式",
  },
  {
    id: "F4a",
    ruleId: "futu/pdf/f4a-order-date@1",
    status: "unsupported",
    priority: 90,
    header: [/買賣方向/, /訂單日期|订单日期/],
    reason: "订单日期综合版式尚未验证成交明细恢复",
  },
  {
    id: "F4",
    ruleId: "futu/pdf/f4-cash-detail@1",
    status: "supported",
    priority: 80,
    header: [/買賣方向/],
    reason: "买卖方向和现金变动版式",
  },
  {
    id: "F2",
    ruleId: "futu/pdf/f2-order-time@1",
    status: "supported",
    priority: 70,
    header: [/方向/, /下單時間/, /價格|成交金額/],
    reason: "下单时间版式",
  },
  {
    id: "F3",
    ruleId: "futu/pdf/f3-order-total@1",
    status: "supported",
    priority: 60,
    document: /訂單合計/,
    header: [/方向/, /價格|成交金額/],
    reason: "订单合计版式",
  },
  {
    id: "F1",
    ruleId: "futu/pdf/f1-execution@1",
    status: "supported",
    priority: 50,
    header: [/方向/, /價格|成交金額/],
    reason: "成交明细版式",
  },
];

const UNKNOWN_TEMPLATE: FutuTemplateProfile = {
  id: "unknown",
  ruleId: "futu/pdf/unknown@1",
  status: "unsupported",
  priority: 0,
  reason: "未匹配已验证的富途交易表模板",
};

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "");
}

function matches(rule: TemplateRule, documentText: string, headerText?: string) {
  if (rule.documentOnly && headerText !== undefined) return false;
  if (rule.document && !rule.document.test(documentText)) return false;
  if (!rule.header) return headerText === undefined;
  if (headerText === undefined) return false;
  return rule.header.every((pattern) => pattern.test(headerText));
}

function publicProfile(rule: TemplateRule): FutuTemplateProfile {
  return {
    id: rule.id,
    ruleId: rule.ruleId,
    status: rule.status,
    priority: rule.priority,
    reason: rule.reason,
  };
}

export function resolveFutuTemplate(input: {
  documentText: string;
  headerText?: string;
}): FutuTemplateProfile {
  const documentText = compact(input.documentText);
  const headerText = input.headerText === undefined
    ? undefined
    : compact(input.headerText);
  const profile = [...FUTU_TEMPLATE_RULES]
    .sort((left, right) => right.priority - left.priority)
    .find((rule) => matches(rule, documentText, headerText));
  if (!profile) return UNKNOWN_TEMPLATE;
  return publicProfile(profile);
}

export function futuTemplateRules(): readonly FutuTemplateProfile[] {
  return FUTU_TEMPLATE_RULES.map(publicProfile);
}

export function futuTemplateRuleId(id: FutuTemplateId): string | undefined {
  return FUTU_TEMPLATE_RULES.find((rule) => rule.id === id)?.ruleId;
}
