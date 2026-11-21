import SummaryTable from "../components/SummaryTable";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/access";
import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Tag, Card, DatePicker, Input, Space, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { getRevenueLedgers, postRevenueMutate } from '../api/revenue';
import { arr, record, str, mutationBody } from '../services/real/bridge';

const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date());
const money = (value: unknown) => value == null ? '—' : `${Number(value).toFixed(2)} 元`;

export default function AwardRevenue({ kind }: { kind: 'global' | 'founding' }) {
  const [period, setPeriod] = useState(currentMonth);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const { session } = useAuth();
  const canManage = hasPermission(session!.account, 'revenue:manage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isCurrent = period === currentMonth();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);

    void (async () => {
      try {
        const all: Record<string, unknown>[] = [];
        let page = 1;
        while (true) {
          const response = await getRevenueLedgers({ page, pageSize: 20, bizType: kind, period } as never, { signal: controller.signal });
          if (response.code !== 0) throw new Error(response.message);
          const data = record(response.data);
          const items = arr(data.items ?? data.list ?? data.records).map(record);
          all.push(...items);
          if (items.length === 0 || (data.total != null ? all.length >= Number(data.total) : items.length < 20)) break;
          page += 1;
        }
        if (!controller.signal.aborted) setRows(all);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [kind, period, refresh]);
  const settled = (row: Record<string, unknown>) => row.settlementStatus === 'SETTLED';
  const amount = (row: Record<string, unknown>) => Math.round(Number(row.totalAmount ?? row.amount ?? 0) * 100);
  const total = rows.reduce((sum, row) => sum + amount(row), 0);
  const paid = rows.filter(settled).reduce((sum, row) => sum + amount(row), 0);
  const eligible = rows.filter(row => !settled(row) && ['PENDING_ALLOCATION', 'PENDING_SETTLEMENT'].includes(str(row.settlementStatus)));
  const settleRows = (targets: Record<string, unknown>[]) => {
    Modal.confirm({ title: `确认将${targets.length}条分红记录改为已分红？`, onOk: async () => {
      setBusy(true);
      setError('');
      let completed = 0;
      try {
        for (const row of targets) {
          const response = await postRevenueMutate(mutationBody({ action: 'settle', entryId: str(row.entryId ?? row.ledgerId), version: Number(row.version), reason: `${period}分红确认`, idempotencyKey: crypto.randomUUID() }) as Parameters<typeof postRevenueMutate>[0]);
          if (response.code !== 0) throw new Error(response.message);
          completed++;
        }
      } catch (err) {
        setError(`已完成${completed}条；${err instanceof Error ? err.message : '操作失败'}。请核对刷新后的状态。`);
      } finally { setBusy(false); setRefresh(value => value + 1); }
    } });
  };
  const componentAmount = (row: Record<string, unknown>, type: 'fixed' | 'performance') => {
    const explicit = type === 'fixed' ? row.fixedAmount ?? row.weightedAmount : row.performanceAmount;
    return money(explicit);
  };
  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Typography.Title level={3}>{kind === 'global' ? '全球奖' : '创始奖'}</Typography.Title>
    <Space wrap>
      <DatePicker picker="month" allowClear={false} value={dayjs(`${period}-01`)} disabledDate={date => date.format('YYYY-MM') > currentMonth()} onChange={date => { if (date) setPeriod(date.format('YYYY-MM')); }} />
      <Input allowClear placeholder="按姓名筛选" value={name} onChange={event => setName(event.target.value)} />
    </Space>
    {error && <Alert type="error" message={error} />}
    <Card title={`${period} 分红汇总`} extra={<Button type="primary" loading={busy} disabled={isCurrent || loading || busy || !canManage || !eligible.length} onClick={() => settleRows(eligible)}>全部改为已分红</Button>}>
      <SummaryTable items={[
        { key: 'total', label: '总分红金额', value: money(total / 100) },
        { key: 'paid', label: '已分红金额', value: money(paid / 100) },
        { key: 'pending', label: '待分红金额', value: money((total - paid) / 100) },
      ]} />
      {isCurrent && <Typography.Text type="secondary">本月待分红，暂不可操作</Typography.Text>}
    </Card>
    <Table loading={loading} pagination={false} rowKey={(row) => str(row.id ?? row.entryId ?? row.ledgerId ?? row.accountId)} dataSource={rows.filter(row => str(row.name ?? row.beneficiaryName ?? row.accountName).includes(name.trim()))} columns={[
      { title: '姓名', render: (_, row) => str(row.name ?? row.beneficiaryName ?? row.accountName) || '—' },
      ...(kind === 'global' ? [
        { title: '固定分红', render: (_: unknown, row: Record<string, unknown>) => componentAmount(row, 'fixed') },
        { title: '业绩分红', render: (_: unknown, row: Record<string, unknown>) => componentAmount(row, 'performance') },
      ] : [{ title: '身份', render: (_: unknown, row: Record<string, unknown>) => str(record(row.wholesaleIdentity).tierLabel ?? record(row.ownerUser).tierLabel ?? row.identityLabel ?? row.tierLabel ?? row.tier) || '—' }]),
      { title: '分红金额', render: (_, row) => money(row.totalAmount ?? row.amount) },
      { title: '分红状态', render: (_, row) => <Tag color={settled(row) ? 'success' : 'warning'}>{settled(row) ? '已分红' : '待分红'}</Tag> },
      { title: '操作', render: (_, row) => <Button disabled={isCurrent || loading || busy || !canManage || !eligible.includes(row)} onClick={() => settleRows([row])}>改为已分红</Button> },
    ]} />
  </Space>;
}

