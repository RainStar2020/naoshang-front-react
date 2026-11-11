import type {
  AllocationStatus,
  IncomeChannel,
  IncomeModule,
  IncomeQuery,
  SettlementStatus,
} from "../types/income";

export type RevenueDimension =
  | "partners"
  | "stores"
  | "agents"
  | "settlement"
  | "global"
  | "founding";

export interface RevenuePageMeta {
  title: string;
  module?: IncomeModule;
  channel?: IncomeChannel;
  /** 锁定渠道，且请求不带 module，避免 module=agency 滤掉合伙人身分奖励。 */
  lockChannel?: boolean;
  hint?: string;
  blurb: string;
}

export const REVENUE_PAGE_SIZE = 10;

export function normalizeRevenuePath(pathname: string): string {
  let path = pathname.trim();
  const hash = path.indexOf("#");
  if (hash >= 0) path = path.slice(hash + 1);
  if (!path.startsWith("/")) path = `/${path}`;
  return path.replace(/\/+$/, "");
}

export function revenueDimensionFromPath(pathname: string): RevenueDimension {
  const path = normalizeRevenuePath(pathname);
  if (path.endsWith("/revenue/global") || path.endsWith("/global")) return "global";
  if (path.endsWith("/revenue/founding") || path.endsWith("/founding")) return "founding";
  if (path.endsWith("/revenue/partners") || path.endsWith("/partners")) return "partners";
  if (path.endsWith("/revenue/stores") || path.endsWith("/stores")) return "stores";
  if (path.endsWith("/revenue/agents") || path.endsWith("/agents")) return "agents";
  return "settlement";
}

export const revenuePageMeta: Record<RevenueDimension, RevenuePageMeta> = {
  partners: {
    title: "合伙人收益",
    module: "wholesale",
    blurb:
      "HQ-22：总部联查合伙人侧收益；字段与公式以后端为准，前端不推导结算结果。不替代小程序个人收益页；不在此出金（提现见「资金结算」）。",
  },
  stores: {
    title: "合店收益",
    // 收益台账将合店和代理门店统一收敛到 agency，按 identityLabel 区分行归属。
    module: "agency",
    blurb:
      "HQ-22：总部联查门店/合店相关收益；前端不推导结算结果。不在此出金（提现见「资金结算」）。",
  },
  agents: {
    title: "代理收益",
    module: "agency",
    blurb:
      "HQ-22：总部联查区域代理相关收益；前端不推导结算结果。不在此出金（提现见「资金结算」）。",
  },
  global: {
    title: "全球奖",
    channel: "GLOBAL_AWARD",
    lockChannel: true,
    hint: "全球奖仅在月结后生成。未开通 200 元权益收益费的获奖人不会入账，只计标准消耗名额。全球奖只发给联创，合格者拿均分的一半。",
    blurb: "",
  },
  founding: {
    title: "创始奖",
    channel: "FOUNDER_AWARD",
    lockChannel: true,
    hint: "创始奖仅在月结后生成。未开通 200 元权益收益费的获奖人不会入账，只计标准消耗名额。创始奖只发给永久排名前 10 的联创和前 50 的私董。",
    blurb: "",
  },
  settlement: {
    title: "结算重算与冲正",
    blurb:
      "HQ-22：结算重算与冲正（改分配/重算/冲正）须原因+版本+幂等+审计，关联原流水不覆盖历史；前端不推导结算结果，不在此出金。",
  },
};

export function buildRevenueListQuery(input: {
  dimension: RevenueDimension;
  page: number;
  pageSize?: number;
  keyword?: string;
  module?: IncomeModule;
  channel?: IncomeChannel;
  allocationStatus?: AllocationStatus;
  settlementStatus?: SettlementStatus;
  storeId?: string;
  period?: string;
}): IncomeQuery {
  const meta = revenuePageMeta[input.dimension];
  const query: IncomeQuery = {
    page: input.page,
    pageSize: input.pageSize ?? REVENUE_PAGE_SIZE,
  };
  if (input.keyword) query.keyword = input.keyword;
  if (input.allocationStatus) query.allocationStatus = input.allocationStatus;
  if (input.settlementStatus) query.settlementStatus = input.settlementStatus;
  if (input.storeId) query.storeId = input.storeId;
  if (input.period) query.period = input.period;

  if (meta.lockChannel) {
    query.channel = meta.channel;
    return query;
  }
  if (input.channel) query.channel = input.channel;
  const module = input.module ?? meta.module;
  if (module) query.module = module;
  return query;
}
