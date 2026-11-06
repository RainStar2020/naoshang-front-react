import { useEffect, useState } from 'react'
import { Alert, Button, Input, Modal, Select, Space, Spin, Typography, message } from 'antd'
import { usersService } from '../services/users'
import { UserServiceError, type UserStoreBindingView } from '../types/users'

export type StoreBindingMode = 'bind' | 'unbind'

interface Props {
  accountId: string
  accountLabel?: string
  mode: StoreBindingMode
  token: string
  onClose: () => void
  onDone: () => void
}

export default function StoreBindingModal({ accountId, accountLabel, mode, token, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<UserStoreBindingView | null>(null)
  const [storeId, setStoreId] = useState<string | undefined>()
  const [reason, setReason] = useState('')
  const [localMode, setLocalMode] = useState<StoreBindingMode>(mode)
  const [api, holder] = message.useMessage()

  useEffect(() => { setLocalMode(mode) }, [mode])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setView(null)
    usersService.getStoreBinding(token, accountId)
      .then((data) => {
        if (!alive) return
        setView(data)
        setStoreId(data.binding.storeId ?? undefined)
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : '门店绑定信息加载失败'
        const code = err instanceof UserServiceError ? err.code : undefined
        setError(code ? `${msg}（${code}）` : msg)
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [accountId, token])

  const activeMode = localMode
  const title = activeMode === 'unbind'
    ? '解绑门店'
    : '修改门店'

  async function submit() {
    if (submitting) return
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('请填写操作原因')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (activeMode === 'unbind') {
        await usersService.unbindStore(token, { accountId, reason: trimmedReason })
        api.success('已解绑门店')
      } else {
        if (!storeId) {
          setError('请选择门店')
          setSubmitting(false)
          return
        }
        await usersService.bindStore(token, { accountId, storeId, reason: trimmedReason })
        api.success('门店已更新')
      }
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败'
      const code = err instanceof UserServiceError ? err.code : undefined
      setError(code ? `${msg}（${code}）` : msg)
      api.error(code ? `${msg}（${code}）` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={title}
      onCancel={() => { if (!submitting) onClose() }}
      onOk={submit}
      okText={activeMode === 'unbind' ? '确认解绑' : '确认提交'}
      confirmLoading={submitting}
      okButtonProps={{ danger: activeMode === 'unbind', disabled: loading || !!error && !view }}
      destroyOnClose
      maskClosable={!submitting}
    >
      {holder}
      {loading && <Spin tip="加载绑定信息"><div style={{ minHeight: 120 }} /></Spin>}
      {!loading && error && !view && <Alert type="error" showIcon message={error} />}
      {!loading && view && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            账号：{view.profileName || accountLabel || accountId}（{accountId}）
          </Typography.Text>
          <Alert
            type="info"
            showIcon
            message={`当前绑定：${view.binding.bound ? (view.binding.storeName || view.binding.storeId || '已绑定') : '未绑定门店'}`}
          />
          {activeMode === 'bind' && view.binding.bound && (
            <Button type="link" danger style={{ padding: 0 }} onClick={() => setLocalMode('unbind')}>改为解绑当前门店</Button>
          )}
          {activeMode === 'bind' && (
            <Select
              aria-label="选择门店"
              showSearch
              optionFilterProp="label"
              placeholder="选择门店（含总部服务）"
              style={{ width: '100%' }}
              value={storeId}
              onChange={setStoreId}
              options={view.stores.map((s) => ({
                value: s.storeId,
                label: s.isHeadquarters ? `${s.name}（HQ）` : `${s.name}${s.storeNo ? ` · ${s.storeNo}` : ''}`,
              }))}
            />
          )}
          {activeMode === 'unbind' && mode === 'bind' && (
            <Button type="link" style={{ padding: 0 }} onClick={() => setLocalMode('bind')}>返回修改门店</Button>
          )}
          {activeMode === 'unbind' && (
            <Typography.Paragraph>
              将解除账号「{view.profileName || accountId}」与门店「{view.binding.storeName || view.binding.storeId}」的绑定。
            </Typography.Paragraph>
          )}
          <Input.TextArea
            aria-label="操作原因"
            value={reason}
            maxLength={200}
            showCount
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：总部指派 / 账号调整"
          />
          {error && <Alert type="error" showIcon message={error} />}
        </Space>
      )}
    </Modal>
  )
}