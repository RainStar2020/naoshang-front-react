import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/access";
import { incomeService } from "../services/income";
import {
  IncomeError,
  type AllocationStatus,
  type IncomeCatalog,
  type IncomeChannel,
  type IncomeDetail,
  type IncomeEntry,
  type IncomeModule,
  type IncomeMutation,
  type SettlementStatus,
} from "../types/income";
import { downloadCsv } from "../utils/csv";

function fen(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}${(Math.abs(n) / 100).toFixed(2)} 元`;
}

const settleLabel: Record<SettlementStatus, string> = {
  PENDING_ALLOCATION: "待分配",
  PENDING_SETTLEMENT: "待结算",
  SETTLED: "已结算",
  RECALC_PENDING: "重算待审",
  REVERSED: "已冲正",
};
const settleColor: Record<SettlementStatus, string> = {
  PENDING_ALLOCATION: "warning",
  PENDING_SETTLEMENT: "processing",
  SETTLED: "success",
  RECALC_PENDING: "orange",
  REVERSED: "error",
};
const allocLabel: Record<AllocationStatus, string> = {
  PENDING: "待分配",
  ALLOCATED: "已分配",
};
const kindLabel = {
  ORIGINAL: "原流水",
  RECALC: "重算申请",
  REVERSAL: "冲正流水",
} as const;
const moduleLabel: Record<IncomeModule, string> = {
  wholesale: "合伙人",
  costore: "合店",
  agency: "代理",
};
const channelLabel: Record<IncomeChannel, string> = {
  B: "B端",
  C: "C端",
  SUPPLY: "供应链",
  GLOBAL_AWARD: "全球奖励",
  FOUNDER_AWARD: "创始人奖励",
};

type RevenueDimension = "partners" | "stores" | "agents" | "settlement";

function revenueDimensionFromPath(pathname: string): RevenueDimension {
  if (pathname.endsWith("/partners")) return "partners";
  if (pathname.endsWith("/stores")) return "stores";
  if (pathname.endsWith("/agents")) return "agents";
  return "settlement";
}

const revenuePageMeta: Record<
  RevenueDimension,
  { title: string; module?: IncomeModule; blurb: string }
> = {
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
  settlement: {
    title: "结算重算与冲正",
    blurb:
      "HQ-22：结算重算与冲正（改分配/重算/冲正）须原因+版本+幂等+审计，关联原流水不覆盖历史；前端不推导结算结果，不在此出金。",
  },
};

export default function Revenue() {
  const { session } = useAuth();
  const location = useLocation();
  const dimension = revenueDimensionFromPath(location.pathname);
  const pageMeta = revenuePageMeta[dimension];
  const token = session!.token;
  const canManage = hasPermission(session!.account, "revenue:manage");

  const [catalog, setCatalog] = useState<IncomeCatalog | null>(null);
  const [keyword, setKeyword] = useState("");
  const [module, setModule] = useState<IncomeModule | undefined>(
    pageMeta.module,
  );
  const [channel, setChannel] = useState<IncomeChannel>();
  const [allocationStatus, setAllocationStatus] = useState<AllocationStatus>();
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus>();
  const [storeId, setStoreId] = useState<string>();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<IncomeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    entries: 0,
    pendingAllocation: 0,
    pendingSettlement: 0,
    settled: 0,
    recalcPending: 0,
    reversed: 0,
    settledAmount: 0,
    pendingAmount: 0,
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncomeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [pending, setPending] = useState<IncomeMutation | null>(null);
  const [reason, setReason] = useState("");
  const [targetId, setTargetId] = useState("self");
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setModule(pageMeta.module);
    setPage(1);
  }, [dimension, pageMeta.module]);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await incomeService.catalog(token));
    } catch (error) {
      message.error(
        error instanceof IncomeError ? error.message : "加载目录失败",
      );
    }
  }, [token]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await incomeService.list(token, {
        page,
        pageSize: 10,
        keyword: keyword || undefined,
        module,
        channel,
        allocationStatus,
        settlementStatus,
        storeId,
      });
      setRows(list.items);
      setTotal(list.total);
      setSummary(list.summary);
    } catch (error) {
      message.error(
        error instanceof IncomeError ? error.message : "加载列表失败",
      );
    } finally {
      setLoading(false);
    }
  }, [
    token,
    page,
    keyword,
    module,
    channel,
    allocationStatus,
    settlementStatus,
    storeId,
  ]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await incomeService.detail(token, id));
      } catch (error) {
        message.error(
          error instanceof IncomeError ? error.message : "加载详情失败",
        );
      }
    },
    [token],
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (detailId) void loadDetail(detailId);
    else setDetail(null);
  }, [detailId, loadDetail]);

  const openMutate = (entry: IncomeEntry, action: IncomeMutation["action"]) => {
    setSubmitError("");
    setReason("");
    setAgentId("");
    setTargetId("self");
    const base = {
      entryId: entry.entryId,
      version: entry.version,
      reason: "",
      idempotencyKey: crypto.randomUUID(),
    };
    if (action === "reassign-allocation") {
      setPending({ ...base, action, targetId: "self" });
    } else {
      setPending({ ...base, action });
    }
  };

  const exportIncomeRows = (fileName: string, entries: IncomeEntry[]) =>
    downloadCsv(fileName, [
      [
        "流水号",
        "类型",
        "关联原流水",
        "来源单号",
        "标题",
        "类目",
        "业务线",
        "渠道",
        "账户 ID",
        "账户名称",
        "手机号",
        "身份",
        "门店",
        "区域",
        "金额（元）",
        "分配状态",
        "分配类型",
        "受益人",
        "结算状态",
        "待处理备注",
        "创建时间",
        "结算时间",
      ],
      ...entries.map((entry) => [
        entry.entryId,
        kindLabel[entry.kind],
        entry.relatedEntryId || "",
        entry.sourceOrder,
        entry.title,
        entry.category,
        moduleLabel[entry.module],
        channelLabel[entry.channel],
        entry.accountId,
        entry.accountName,
        entry.phone,
        entry.identityLabel,
        entry.storeName || "",
        entry.regionLabel || "",
        (entry.amount / 100).toFixed(2),
        allocLabel[entry.allocationStatus],
        entry.allocationKind === "inspection" ? "巡查" : "销售",
        entry.beneficiaryName,
        settleLabel[entry.settlementStatus],
        entry.pendingNote || "",
        entry.createdAt,
        entry.settledAt || "",
      ]),
    ]);

  const submit = async () => {
    if (!pending) return;
    setBusy(true);
    setSubmitError("");
    try {
      let input: IncomeMutation;
      if (pending.action === "reassign-allocation") {
        input = {
          ...pending,
          targetId,
          agentId: targetId === "other" ? agentId : undefined,
          reason: reason.trim() || "（无备注）",
        };
      } else {
        input = { ...pending, reason: reason.trim() || "（无备注）" };
      }
      const result = await incomeService.mutate(token, input);
      message.success(
        result.action === "reassign-allocation"
          ? "已改分配（仍待后台结算，不增加可提现）"
          : result.action === "request-recalc"
            ? "已登记重算申请并关联原流水"
            : "已登记冲正流水并关联原单",
      );
      setPending(null);
      await loadList();
      if (detailId) await loadDetail(detailId);
      await loadCatalog();
    } catch (error) {
      const msg = error instanceof IncomeError ? error.message : "提交失败";
      setSubmitError(msg);
      message.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "流水号",
        dataIndex: "entryId",
        width: 150,
        render: (_: string, row: IncomeEntry) => (
          <Typography.Link onClick={() => setDetailId(row.entryId)}>
            {row.entryId}
          </Typography.Link>
        ),
      },
      {
        title: "类型",
        dataIndex: "kind",
        width: 90,
        render: (k: IncomeEntry["kind"]) => kindLabel[k],
      },
      {
        title: "来源订单",
        dataIndex: "sourceOrder",
        width: 150,
        render: (v: string) => v || "—",
      },
      {
        title: "标题",
        dataIndex: "title",
        width: 160,
        ellipsis: true,
      },
      {
        title: "类目",
        dataIndex: "category",
        width: 120,
        ellipsis: true,
      },
      {
        title: "渠道",
        dataIndex: "channel",
        width: 100,
        render: (c: IncomeEntry["channel"]) => channelLabel[c],
      },
      {
        title: "模块",
        dataIndex: "module",
        width: 100,
        render: (m: IncomeEntry["module"]) => moduleLabel[m],
      },
      {
        title: "账户",
        width: 150,
        render: (_: unknown, row: IncomeEntry) => (
          <span>
            {row.accountName} / {row.phone}
          </span>
        ),
      },
      {
        title: "门店",
        width: 160,
        ellipsis: true,
        render: (_: unknown, row: IncomeEntry) => row.storeName || "无门店",
      },
      {
        title: "地区",
        width: 120,
        ellipsis: true,
        render: (_: unknown, row: IncomeEntry) => row.regionLabel || "—",
      },
      {
        title: "金额",
        dataIndex: "amount",
        width: 110,
        render: (v: number) => (
          <Typography.Text type={v < 0 ? "danger" : undefined}>
            {fen(v)}
          </Typography.Text>
        ),
      },
      {
        title: "分配状态",
        width: 100,
        render: (_: unknown, row: IncomeEntry) => (
          <Tag>{allocLabel[row.allocationStatus]}</Tag>
        ),
      },
      {
        title: "分配类型",
        width: 90,
        render: (_: unknown, row: IncomeEntry) =>
          row.allocationKind === "inspection" ? "巡查" : "销售",
      },
      {
        title: "受益人",
        width: 110,
        ellipsis: true,
        dataIndex: "beneficiaryName",
      },
      {
        title: "结算",
        dataIndex: "settlementStatus",
        width: 100,
        render: (s: SettlementStatus) => (
          <Tag color={settleColor[s]}>{settleLabel[s]}</Tag>
        ),
      },
      {
        title: "操作",
        width: 220,
        render: (_: unknown, row: IncomeEntry) => (
          <Space wrap>
            <Button size="small" onClick={() => setDetailId(row.entryId)}>
              详情
            </Button>
            {canManage &&
              (row.allowedActions ?? []).includes("reassign-allocation") && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => openMutate(row, "reassign-allocation")}
                >
                  改分配
                </Button>
              )}
            {canManage &&
              (row.allowedActions ?? []).includes("request-recalc") && (
                <Button
                  size="small"
                  onClick={() => openMutate(row, "request-recalc")}
                >
                  重算
                </Button>
              )}
            {canManage &&
              (row.allowedActions ?? []).includes("request-reverse") && (
                <Button
                  size="small"
                  danger
                  onClick={() => openMutate(row, "request-reverse")}
                >
                  冲正
                </Button>
              )}
          </Space>
        ),
      },
    ],
    [canManage],
  );

  const mutateTitle =
    pending?.action === "reassign-allocation"
      ? "改分配（不直接计入可提现）"
      : pending?.action === "request-recalc"
        ? "申请重算（关联原流水，不覆盖历史金额）"
        : pending?.action === "request-reverse"
          ? "冲正（新增反向流水，原单只读保留）"
          : "";

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {pageMeta.title}
      </Typography.Title>
      <Alert type="info" showIcon message={pageMeta.blurb} />
      {catalog && (
        <Alert type="warning" showIcon message={catalog.engineGapNote} />
      )}

      <Card>
        <Space wrap size="large">
          <Statistic title="原流水数" value={summary.entries} />
          <Statistic title="待分配" value={summary.pendingAllocation} />
          <Statistic title="待结算" value={summary.pendingSettlement} />
          <Statistic title="已结算" value={summary.settled} />
          <Statistic title="重算待审" value={summary.recalcPending} />
          <Statistic title="已冲正" value={summary.reversed} />
          <Statistic title="已结算金额" value={fen(summary.settledAmount)} />
          <Statistic title="待处理金额" value={fen(summary.pendingAmount)} />
        </Space>
      </Card>

      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="流水号 / 单号 / 标题 / 账户 / 手机 / 门店"
            style={{ width: 320 }}
            onSearch={(v) => {
              setPage(1);
              setKeyword(v);
            }}
          />
          <Select
            allowClear
            placeholder="业务线"
            style={{ width: 120 }}
            options={(catalog?.modules || []).map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            value={module}
            onChange={(v) => {
              setPage(1);
              setModule(v);
            }}
          />
          <Select
            allowClear
            placeholder="渠道"
            style={{ width: 130 }}
            options={(catalog?.channels || []).map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            value={channel}
            onChange={(v) => {
              setPage(1);
              setChannel(v);
            }}
          />
          <Select
            allowClear
            placeholder="分配状态"
            style={{ width: 120 }}
            options={[
              { value: "PENDING", label: "待分配" },
              { value: "ALLOCATED", label: "已分配" },
            ]}
            value={allocationStatus}
            onChange={(v) => {
              setPage(1);
              setAllocationStatus(v);
            }}
          />
          <Select
            allowClear
            placeholder="结算状态"
            style={{ width: 130 }}
            options={(catalog?.settlementStatuses || []).map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            value={settlementStatus}
            onChange={(v) => {
              setPage(1);
              setSettlementStatus(v);
            }}
          />
          <Select
            allowClear
            placeholder="门店"
            style={{ width: 200 }}
            options={(catalog?.stores || []).map((s) => ({
              value: s.storeId,
              label: s.name,
            }))}
            value={storeId}
            onChange={(v) => {
              setPage(1);
              setStoreId(v);
            }}
          />
          <Button onClick={() => void loadList()}>刷新</Button>
          <Button
            onClick={() => exportIncomeRows(`${pageMeta.title}列表`, rows)}
            disabled={!rows.length}
          >
            导出当前表格
          </Button>
        </Space>
        <Table
          rowKey="entryId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1800 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {catalog && (catalog.audit ?? []).length > 0 && (
        <Card
          title="最近操作审计（Mock）"
          size="small"
          extra={
            <Button
              size="small"
              onClick={() =>
                downloadCsv("收益最近操作审计", [
                  ["时间", "操作", "目标", "关联流水", "操作人", "原因"],
                  ...(catalog.audit ?? [])
                    .slice(0, 8)
                    .map((item) => [
                      item.occurredAt,
                      item.action,
                      item.targetId,
                      item.relatedEntryId || "",
                      item.operatorName,
                      item.reason,
                    ]),
                ])
              }
            >
              导出当前表格
            </Button>
          }
        >
          <Table
            size="small"
            rowKey="operationId"
            pagination={false}
            dataSource={(catalog.audit ?? []).slice(0, 8)}
            columns={[
              { title: "时间", dataIndex: "occurredAt", width: 190 },
              { title: "操作", dataIndex: "action", width: 140 },
              { title: "目标", dataIndex: "targetId", width: 140 },
              {
                title: "关联",
                dataIndex: "relatedEntryId",
                width: 160,
                render: (v: string | null) => v || "-",
              },
              { title: "操作人", dataIndex: "operatorName", width: 120 },
              { title: "原因", dataIndex: "reason" },
            ]}
          />
        </Card>
      )}

      <Drawer
        width={720}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail ? `收益详情 ${detail.entry.entryId}` : "收益详情"}
        extra={
          detail && canManage ? (
            <Space>
              {(detail.entry.allowedActions ?? []).includes(
                "reassign-allocation",
              ) && (
                <Button
                  type="primary"
                  onClick={() =>
                    openMutate(detail.entry, "reassign-allocation")
                  }
                >
                  改分配
                </Button>
              )}
              {(detail.entry.allowedActions ?? []).includes(
                "request-recalc",
              ) && (
                <Button
                  onClick={() => openMutate(detail.entry, "request-recalc")}
                >
                  重算
                </Button>
              )}
              {(detail.entry.allowedActions ?? []).includes(
                "request-reverse",
              ) && (
                <Button
                  danger
                  onClick={() => openMutate(detail.entry, "request-reverse")}
                >
                  冲正
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert type="warning" showIcon message={detail.engineGapNote} />
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="流水号">
                {detail.entry.entryId}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                {kindLabel[detail.entry.kind]}
              </Descriptions.Item>
              <Descriptions.Item label="来源单号">
                {detail.entry.sourceOrder}
              </Descriptions.Item>
              <Descriptions.Item label="标题">
                {detail.entry.title}
              </Descriptions.Item>
              <Descriptions.Item label="业务线">
                {moduleLabel[detail.entry.module]}
              </Descriptions.Item>
              <Descriptions.Item label="渠道">
                {channelLabel[detail.entry.channel]}
              </Descriptions.Item>
              <Descriptions.Item label="账户">
                {detail.entry.accountName} / {detail.entry.phone}
              </Descriptions.Item>
              <Descriptions.Item label="身份">
                {detail.entry.identityLabel}
              </Descriptions.Item>
              <Descriptions.Item label="门店">
                {detail.entry.storeName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="区域">
                {detail.entry.regionLabel || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                {fen(detail.entry.amount)}
              </Descriptions.Item>
              <Descriptions.Item label="基数 / 基点">
                {fen(detail.entry.baseAmount)} / {detail.entry.rateBps}{" "}
                bps（只读展示）
              </Descriptions.Item>
              <Descriptions.Item label="分配">
                {allocLabel[detail.entry.allocationStatus]} ·{" "}
                {detail.entry.allocationKind === "inspection" ? "巡查" : "销售"}{" "}
                · {detail.entry.beneficiaryName}
              </Descriptions.Item>
              <Descriptions.Item label="结算">
                <Tag color={settleColor[detail.entry.settlementStatus]}>
                  {settleLabel[detail.entry.settlementStatus]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联原流水" span={2}>
                {detail.entry.relatedEntryId ? (
                  <Typography.Link
                    onClick={() => setDetailId(detail.entry.relatedEntryId!)}
                  >
                    {detail.entry.relatedEntryId}
                  </Typography.Link>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detail.entry.pendingNote || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="版本">
                {detail.entry.version}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail.entry.createdAt}
              </Descriptions.Item>
            </Descriptions>

            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Title level={5}>关联流水</Typography.Title>
              <Button
                size="small"
                disabled={!(detail.related ?? []).length}
                onClick={() =>
                  exportIncomeRows("收益关联流水", detail.related ?? [])
                }
              >
                导出当前表格
              </Button>
            </Space>
            {(detail.related ?? []).length === 0 ? (
              <Typography.Text type="secondary">
                无关联冲正/重算流水
              </Typography.Text>
            ) : (
              <Table
                size="small"
                rowKey="entryId"
                pagination={false}
                dataSource={detail.related ?? []}
                columns={[
                  {
                    title: "流水",
                    dataIndex: "entryId",
                    render: (id: string) => (
                      <Typography.Link onClick={() => setDetailId(id)}>
                        {id}
                      </Typography.Link>
                    ),
                  },
                  {
                    title: "类型",
                    dataIndex: "kind",
                    render: (k: IncomeEntry["kind"]) => kindLabel[k],
                  },
                  {
                    title: "金额",
                    dataIndex: "amount",
                    render: (v: number) => fen(v),
                  },
                  {
                    title: "结算",
                    dataIndex: "settlementStatus",
                    render: (s: SettlementStatus) => settleLabel[s],
                  },
                ]}
              />
            )}

            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Title level={5}>本流水审计</Typography.Title>
              <Button
                size="small"
                disabled={!(detail.audit ?? []).length}
                onClick={() =>
                  downloadCsv("收益流水审计", [
                    ["时间", "动作", "变更前", "变更后", "操作人", "原因"],
                    ...(detail.audit ?? []).map((item) => [
                      item.occurredAt,
                      item.action,
                      item.before,
                      item.after,
                      item.operatorName,
                      item.reason,
                    ]),
                  ])
                }
              >
                导出当前表格
              </Button>
            </Space>
            {(detail.audit ?? []).length === 0 ? (
              <Typography.Text type="secondary">暂无操作记录</Typography.Text>
            ) : (
              <Table
                size="small"
                rowKey="operationId"
                pagination={false}
                dataSource={detail.audit ?? []}
                columns={[
                  { title: "时间", dataIndex: "occurredAt" },
                  { title: "动作", dataIndex: "action" },
                  { title: "变更前", dataIndex: "before", ellipsis: true },
                  { title: "变更后", dataIndex: "after", ellipsis: true },
                  { title: "操作人", dataIndex: "operatorName" },
                  { title: "原因", dataIndex: "reason" },
                ]}
              />
            )}
          </Space>
        )}
      </Drawer>

      <Modal
        title={mutateTitle}
        open={!!pending}
        onCancel={() => !busy && setPending(null)}
        onOk={() => void submit()}
        confirmLoading={busy}
        okText="确认提交"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Alert
            type="info"
            showIcon
            message="写操作铁律：原因必填、带版本号与幂等键；冲正/重算只新增关联流水，不改写原单金额；不前端计算提点，不增加可提现。"
          />
          {pending?.action === "reassign-allocation" && (
            <>
              <Select
                style={{ width: "100%" }}
                value={targetId}
                onChange={setTargetId}
                options={(catalog?.allocationTargets || [])
                  .filter(
                    (t) =>
                      t.kind === "both" ||
                      t.kind === "sales" ||
                      t.kind === "inspection",
                  )
                  .map((t) => ({ value: t.value, label: t.label }))}
              />
              {targetId === "other" && (
                <Input
                  placeholder="外部销售方/巡查方 ID（2-32 位字母数字_-）"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                />
              )}
            </>
          )}
          <Input.TextArea
            rows={3}
            placeholder="选填，可留空"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {submitError && <Alert type="error" message={submitError} />}
        </Space>
      </Modal>

      <Typography.Paragraph type="secondary">
        返回 <Link to="/">首页</Link> · 出金见{" "}
        <Link to="/withdrawals">提现审核与打款</Link>
        。金额界面按元展示（存分）；写操作须原因/版本/幂等/确认。
      </Typography.Paragraph>
    </Space>
  );
}
