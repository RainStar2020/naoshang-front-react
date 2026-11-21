import { describe, expect, it } from "vitest";
import {
  adminNavGroups,
  adminModules,
  dedicatedPagePaths,
  isDedicatedPagePath,
} from "./access";

describe("adminNavGroups §4.3 信息架构", () => {
  it("一级菜单文案顺序正确（发码/商品组已注释隐藏）", () => {
    expect(adminNavGroups.map((g) => g.label)).toEqual([
      "账号与会员",
      "内容",
      "推广素材",
      "合伙体系",
      "合店与代理",
      "门店运营",
      "收益",
      "资金结算",
      "系统支撑",
    ]);
  });

  it("课程不在账号组；素材独立一级；名额在合伙体系；代理在合店与代理", () => {
    const account = adminNavGroups.find((g) => g.key === "account")!;
    expect(account.children.map((c) => c.path)).toEqual(["/users", "/members"]);
    expect(account.children.some((c) => c.path === "/course")).toBe(false);
    const materials = adminNavGroups.find((g) => g.key === "materials")!;
    expect(materials.label).toBe("推广素材");
    expect(materials.children.map((c) => c.path)).toEqual([
      "/materials/image",
      "/materials/article",
      "/materials/video",
    ]);
    expect(materials.children.map((c) => c.label)).toEqual([
      "图片素材（开发中）",
      "图文素材（开发中）",
      "视频素材（开发中）",
    ]);
    const partner = adminNavGroups.find((g) => g.key === "partner")!;
    expect(partner.children.map((c) => c.path)).toEqual([
      "/partners",
      "/quotas",
      "/invitations",
    ]);
    const costore = adminNavGroups.find((g) => g.key === "costore")!;
    expect(costore.children.map((c) => c.path)).toEqual([
      "/costore",
      "/agents",
    ]);
    expect(costore.children.find((c) => c.path === "/agents")?.label).toBe(
      "区域代理监管",
    );
    const system = adminNavGroups.find((g) => g.key === "system")!;
    expect(system.children.map((c) => c.path)).toEqual(["/support", "/trace"]);
    expect(system.children.some((c) => c.path === "/agents")).toBe(false);
  });

  it("收益入口统一展示收益；资金结算含总部分红与提现", () => {
    const revenue = adminNavGroups.find((g) => g.key === "revenue")!;
    expect(revenue.label).toBe("收益");
    expect(
      revenue.children.map((c) => [c.path, c.label, c.permission]),
    ).toEqual([
      ["/revenue", "收益", "revenue:access"],
      ["/revenue/global", "全球奖", "revenue:access"],
      ["/revenue/founding", "创始奖", "revenue:access"],
      ["/revenue/settlement", "全员月度分红监管", "revenue:access"],
    ]);
    const finance = adminNavGroups.find((g) => g.key === "finance")!;
    expect(finance.label).toBe("资金结算");
    expect(finance.children.map((c) => [c.path, c.label, c.permission])).toEqual([
      ["/hq-ledger", "总部分红", "hq.hq-ledger.read"],
      ["/withdrawals", "提现审核与打款", "withdrawals:access"],
    ]);
  });

  it("adminModules 由分组扁平生成且包含统一收益入口", () => {
    expect(adminModules).toEqual(adminNavGroups.flatMap((g) => g.children));
    expect(adminModules.some((m) => m.path === "/revenue")).toBe(true);
    expect(
      adminModules
        .filter((m) => m.path.startsWith("/revenue/"))
        .map((m) => m.path),
    ).toEqual([
      
      "/revenue/global",
      "/revenue/founding",
      "/revenue/settlement",
    ]);
  });

  it("P0～P2 全量 HQ 专用页均标记为强制专用页", () => {
    for (const path of [
      "/products",
      "/course",
      "/materials/image",
      "/materials/article",
      "/materials/video",
      "/partners",
      "/users",
      "/columns",
      "/announcements",
      "/activation-codes",
      "/software-cards",
      "/orders",
      "/coupons",
      "/payments",
      "/quotas",
      "/invitations",
      "/costore",
      "/agents",
      "/members",
      "/delivery",
      "/stores",
      "/staff-roles",
      "/training",
      "/transfers",
      "/hq-ledger",
      "/withdrawals",
      "/support",
      "/trace",
    ]) {
      expect(isDedicatedPagePath(path)).toBe(true);
    }
    for (const path of dedicatedPagePaths.filter((p) =>
      p.startsWith("/revenue/"),
    )) {
      expect(isDedicatedPagePath(path)).toBe(true);
    }
    expect(dedicatedPagePaths).toContain("/hq-ledger");
    expect(dedicatedPagePaths).toContain("/support");
    expect(dedicatedPagePaths).toContain("/trace");
  });

  it("HQ-18 区域代理与员工门店角色路径分离", () => {
    const costore = adminNavGroups.find((g) => g.key === "costore")!;
    expect(costore.children.map((c) => [c.path, c.label])).toEqual([
      ["/costore", "合店申请监管"],
      ["/agents", "区域代理监管"],
    ]);
    const store = adminNavGroups.find((g) => g.key === "store")!;
    expect(
      store.children.some(
        (c) => c.path === "/staff-roles" && c.label === "门店员工",
      ),
    ).toBe(true);
    expect(store.children.some((c) => c.path === "/agents")).toBe(false);
  });
});
