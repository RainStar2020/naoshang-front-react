import { describe, expect, it } from "vitest";
import {
  buildRevenueListQuery,
  revenueDimensionFromPath,
  revenuePageMeta,
} from "./revenueQuery";

describe("revenueDimensionFromPath", () => {
  it("识别收益列表路径，兼容 HashRouter", () => {
    expect(revenueDimensionFromPath("/revenue/global")).toBe("global");
    expect(revenueDimensionFromPath("#/revenue/global")).toBe("global");
    expect(revenueDimensionFromPath("/#/revenue/founding/")).toBe("founding");
    expect(revenueDimensionFromPath("/revenue/partners")).toBe("partners");
    expect(revenueDimensionFromPath("/revenue/stores")).toBe("stores");
    expect(revenueDimensionFromPath("/revenue/agents")).toBe("agents");
    expect(revenueDimensionFromPath("/revenue/settlement")).toBe("settlement");
  });
});

describe("buildRevenueListQuery", () => {
  it("全球奖只传 channel=GLOBAL_AWARD，不传 module", () => {
    const query = buildRevenueListQuery({
      dimension: "global",
      page: 1,
      module: "agency",
      channel: "B",
      period: "2026-11",
    });
    expect(query).toEqual({
      page: 1,
      pageSize: 10,
      period: "2026-11",
      channel: "GLOBAL_AWARD",
    });
    expect(query).not.toHaveProperty("module");
    expect(revenuePageMeta.global.channel).toBe("GLOBAL_AWARD");
  });

  it("创始奖只传 channel=FOUNDER_AWARD，不传 module", () => {
    const query = buildRevenueListQuery({
      dimension: "founding",
      page: 2,
      pageSize: 20,
      module: "agency",
      keyword: "王",
    });
    expect(query).toEqual({
      page: 2,
      pageSize: 20,
      keyword: "王",
      channel: "FOUNDER_AWARD",
    });
    expect(query).not.toHaveProperty("module");
    expect("bizType" in query).toBe(false);
  });

  it("既有收益页仍按业务线默认 module，且可不带 period", () => {
    expect(
      buildRevenueListQuery({ dimension: "partners", page: 1 }),
    ).toEqual({ page: 1, pageSize: 10, module: "wholesale" });
    expect(
      buildRevenueListQuery({ dimension: "agents", page: 1 }),
    ).toEqual({ page: 1, pageSize: 10, module: "agency" });
    expect(
      buildRevenueListQuery({ dimension: "settlement", page: 1 }),
    ).toEqual({ page: 1, pageSize: 10 });
  });
});
