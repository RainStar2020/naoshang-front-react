import { useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Input, InputNumber, Modal, Select, Space, Table, Typography } from 'antd'
import {
  fulfillmentTypes,
  type FulfillmentType,
  type ManagedProduct,
  type ProductCatalog,
  type ProductDraft,
  type ProductMutation,
  type ProductPriceTier,
} from '../types/products'
import { productsService } from '../services/products'
import { emptyContent } from '../utils/richContent'
import { generateProductSkus } from '../utils/productSkus'
import { assertProductContentAllowsSave } from '../utils/productContent'
import { formatProfitYuan, isSaleBelowCost } from '../utils/productPricing'
import CmsContentEditor, { CmsAssetInput } from './CmsContentEditor'

export function MoneyInput({
  value,
  onChange,
  label,
  nullable = false,
}: {
  value: number | null
  onChange: (value: number | null) => void
  label: string
  nullable?: boolean
}) {
  return (
    <Space size={4}>
      <InputNumber
        aria-label={label}
        min={0}
        max={10000000}
        precision={2}
        value={value === null ? null : value / 100}
        onChange={(next) => onChange(next === null ? (nullable ? null : 0) : Math.round(Number(next) * 100))}
      />
      <span>元</span>
    </Space>
  )
}

function PriceTiers({
  value,
  change,
  label,
}: {
  value: ProductPriceTier[]
  change: (value: ProductPriceTier[]) => void
  label: string
}) {
  return (
    <Card size="small" title={label}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {value.map((tier, index) => (
          <Space key={tier.id} wrap>
            <Input
              aria-label={`${label}${index + 1}名称`}
              placeholder="档位名称"
              style={{ width: 140 }}
              maxLength={40}
              value={tier.label}
              onChange={(event) =>
                change(value.map((item) => (item.id === tier.id ? { ...item, label: event.target.value } : item)))
              }
            />
            <Input
              aria-label={`${label}${index + 1}折扣标签`}
              placeholder="仅展示，如9折"
              style={{ width: 140 }}
              maxLength={40}
              value={tier.discountLabel}
              onChange={(event) =>
                change(value.map((item) => (item.id === tier.id ? { ...item, discountLabel: event.target.value } : item)))
              }
            />
            <MoneyInput
              label={`${label}${index + 1}金额`}
              value={tier.amount}
              onChange={(amount) =>
                change(value.map((item) => (item.id === tier.id ? { ...item, amount: amount ?? 0 } : item)))
              }
            />
            <Button danger onClick={() => change(value.filter((item) => item.id !== tier.id))}>
              移除档位
            </Button>
          </Space>
        ))}
        <Button
          disabled={value.length >= 20}
          onClick={() => change([...value, { id: crypto.randomUUID(), label: '', discountLabel: '', amount: 0 }])}
        >
          添加{label}
        </Button>
      </Space>
    </Card>
  )
}

function emptyDraft(): ProductDraft {
  return {
    productId: '',
    categoryId: '',
    title: '',
    summary: '',
    coverUrl: '',
    content: emptyContent(),
    // 新建必须显式选择；空串在保存/Mock 层会被拒
    fulfillmentType: '' as FulfillmentType,
    costAmount: 0,
    requiresMember: false,
    pricePresentation: 'tiered',
    originalAmount: null,
    standardAmount: 0,
    activityAmount: null,
    memberPrices: [],
    rolePrices: [],
    specGroups: [],
    skus: [{ id: `sku-${crypto.randomUUID()}`, label: '默认', specs: {}, amount: 0, stock: 0 }],
  }
}

export default function ProductEditor({
  row,
  catalog,
  token,
  close,
  save,
}: {
  row: ManagedProduct | null
  catalog: ProductCatalog
  token: string
  close: () => void
  save: (input: ProductMutation) => void
}) {
  const isNew = !row
  const [draft, setDraft] = useState<ProductDraft>(() => structuredClone(row?.draft ?? emptyDraft()))
  const [error, setError] = useState('')
  const [regenerate, setRegenerate] = useState(false)

  const change = (value: Partial<ProductDraft>) => setDraft((current) => ({ ...current, ...value }))
  const upload = (file: File) => productsService.upload(token, file)

  const typeOptions = useMemo(
    () =>
      catalog.types
        .filter((type) => (fulfillmentTypes as readonly string[]).includes(type.code))
        .map((type) => ({ value: type.code, label: `${type.title} · ${type.code}` })),
    [catalog.types],
  )

  const categoryOptions = useMemo(() => {
    return catalog.categories
      .filter((category) => category.enabled || category.categoryId === draft.categoryId)
      .map((category) => ({
        value: category.categoryId,
        label: `${category.categoryLabel}${category.enabled ? '' : '（已停用）'}`,
        disabled: !category.enabled && category.categoryId !== draft.categoryId,
      }))
  }, [catalog.categories, draft.categoryId])

  const saleBelowCost = isSaleBelowCost(draft.standardAmount, draft.costAmount)
  const profitLabel = formatProfitYuan(draft.standardAmount, draft.costAmount)

  const generate = () => {
    try {
      change({ skus: generateProductSkus(draft) })
      setRegenerate(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '组合生成失败')
      setRegenerate(false)
    }
  }

  const submit = () => {
    if (!(fulfillmentTypes as readonly string[]).includes(draft.fulfillmentType)) {
      setError('请先选择履约类型（PHYSICAL / ACTIVATION_CODE / OFFLINE_SERVICE / COLUMN_ACCESS）')
      return
    }
    if (!draft.title.trim() || !draft.categoryId) {
      setError('请填写标题并选择启用中的一级分类')
      return
    }
    const category = catalog.categories.find((item) => item.categoryId === draft.categoryId)
    if (!category?.enabled && isNew) {
      setError('新建商品只能选择启用中的一级分类')
      return
    }
    try {
      assertProductContentAllowsSave(draft.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : '商品详情含禁止媒体')
      return
    }
    setError('')
    save({ action: 'save-product', value: draft, version: row?.version ?? 0, reason: '', idempotencyKey: '' })
  }

  return (
    <Modal
      open
      width={1100}
      title={row ? '编辑商品草稿' : '新建商品'}
      onCancel={close}
      onOk={submit}
      okText="核对并保存商品"
      cancelText="取消"
      maskClosable={false}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          message="保存草稿后需上架发布才更新选品页。金额界面按元录入（内部仍按分存储）。履约类型创建后不可更改。价格档折扣文字不计算报价。"
        />
        {error && <Alert type="error" message={error} />}

        <div className="cms-form-grid">
          <label>
            履约类型（必选，保存后锁定）
            <Select
              aria-label="商品履约类型"
              disabled={!isNew}
              style={{ width: '100%' }}
              placeholder="请先选择履约类型"
              value={(fulfillmentTypes as readonly string[]).includes(draft.fulfillmentType) ? draft.fulfillmentType : undefined}
              options={typeOptions}
              onChange={(fulfillmentType) => change({ fulfillmentType })}
            />
          </label>
          <label>
            一级分类
            <Select
              aria-label="商品一级分类"
              style={{ width: '100%' }}
              placeholder="选择启用中的分类"
              value={draft.categoryId || undefined}
              options={categoryOptions}
              onChange={(categoryId) => change({ categoryId })}
            />
          </label>
          <label>
            商品标题
            <Input aria-label="商品标题" maxLength={80} value={draft.title} onChange={(event) => change({ title: event.target.value })} />
          </label>
        </div>

        <Input.TextArea
          aria-label="商品简介"
          placeholder="商品简介"
          rows={2}
          maxLength={500}
          value={draft.summary}
          onChange={(event) => change({ summary: event.target.value })}
        />
        <Checkbox checked={draft.requiresMember} onChange={(event) => change({ requiresMember: event.target.checked })}>
          下单需要选择孩子会员
        </Checkbox>

        <CmsAssetInput token={token} upload={upload} label="商品封面" value={draft.coverUrl} onChange={(coverUrl) => change({ coverUrl })} />
        <CmsContentEditor
          token={token}
          upload={upload}
          label="商品介绍"
          value={draft.content}
          onChange={(content) => change({ content })}
          mediaPolicy="image-text"
        />

        <Typography.Title level={5}>成本价 / 售价 / 盈利（单位：元）</Typography.Title>
        <Space wrap align="start">
          <label>
            成本价
            <MoneyInput label="商品成本价" value={draft.costAmount} onChange={(costAmount) => change({ costAmount: costAmount ?? 0 })} />
          </label>
          <label>
            售价（标准价）
            <MoneyInput
              label="商品售价"
              value={draft.standardAmount}
              onChange={(standardAmount) => change({ standardAmount: standardAmount ?? 0 })}
            />
          </label>
          <Alert
            style={{ minWidth: 260 }}
            type={saleBelowCost ? 'warning' : 'success'}
            showIcon
            message={`盈利提示：${profitLabel} 元`}
            description={
              saleBelowCost
                ? '售价低于成本价，仍默认可保存；请确认后在核对弹窗填写原因。'
                : '盈利 = 售价 − 成本价，随输入实时刷新。'
            }
          />
        </Space>

        <Typography.Title level={5}>其它价格展示（可选）</Typography.Title>
        <Space wrap>
          <label>
            原价（可空）
            <MoneyInput nullable label="商品原价" value={draft.originalAmount} onChange={(originalAmount) => change({ originalAmount })} />
          </label>
          <label>
            活动价（可空）
            <MoneyInput nullable label="商品活动价" value={draft.activityAmount} onChange={(activityAmount) => change({ activityAmount })} />
          </label>
          <Select
            aria-label="商品价格展示"
            value={draft.pricePresentation}
            options={[
              { value: 'tiered', label: '多档价格展示' },
              { value: 'standard-only', label: '仅标准价展示' },
            ]}
            onChange={(pricePresentation) => change({ pricePresentation })}
          />
        </Space>
        <PriceTiers label="会员价" value={draft.memberPrices} change={(memberPrices) => change({ memberPrices })} />
        <PriceTiers label="身份价" value={draft.rolePrices} change={(rolePrices) => change({ rolePrices })} />

        <Typography.Title level={5}>规格组与 SKU</Typography.Title>
        <Alert type="info" message="规格ID保持稳定。增删选项后请显式生成组合；相同组合保留原SKU ID、售价和库存，新组合默认售价及库存为0，请核对。" />
        {draft.specGroups.map((group, i) => (
          <Card
            key={group.id}
            size="small"
            title={`规格组 ${i + 1}`}
            extra={
              <Button danger onClick={() => change({ specGroups: draft.specGroups.filter((item) => item.id !== group.id) })}>
                移除规格组
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                aria-label={`规格组${i + 1}名称`}
                placeholder="规格名称"
                maxLength={40}
                value={group.label}
                onChange={(event) =>
                  change({
                    specGroups: draft.specGroups.map((item) =>
                      item.id === group.id ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
              />
              {group.options.map((option, j) => (
                <Space key={option.id}>
                  <Input
                    aria-label={`规格组${i + 1}选项${j + 1}`}
                    maxLength={40}
                    value={option.label}
                    onChange={(event) =>
                      change({
                        specGroups: draft.specGroups.map((item) =>
                          item.id === group.id
                            ? {
                                ...item,
                                options: item.options.map((value) =>
                                  value.id === option.id ? { ...value, label: event.target.value } : value,
                                ),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <Button
                    danger
                    onClick={() =>
                      change({
                        specGroups: draft.specGroups.map((item) =>
                          item.id === group.id
                            ? { ...item, options: item.options.filter((value) => value.id !== option.id) }
                            : item,
                        ),
                      })
                    }
                  >
                    移除选项
                  </Button>
                </Space>
              ))}
              <Button
                disabled={group.options.length >= 30}
                onClick={() =>
                  change({
                    specGroups: draft.specGroups.map((item) =>
                      item.id === group.id
                        ? { ...item, options: [...item.options, { id: crypto.randomUUID(), label: '' }] }
                        : item,
                    ),
                  })
                }
              >
                添加规格选项
              </Button>
            </Space>
          </Card>
        ))}
        <Space>
          <Button
            disabled={draft.specGroups.length >= 5}
            onClick={() =>
              change({
                specGroups: [...draft.specGroups, { id: crypto.randomUUID(), label: '', options: [{ id: crypto.randomUUID(), label: '' }] }],
              })
            }
          >
            添加规格组
          </Button>
          <Button onClick={() => setRegenerate(true)}>生成并核对SKU组合</Button>
        </Space>
        <Table
          rowKey="id"
          size="small"
          dataSource={draft.skus}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 750 }}
          columns={[
            {
              title: 'SKU / 规格',
              key: 'sku',
              render: (_, sku) => (
                <>
                  {sku.label}
                  <br />
                  <Typography.Text type="secondary">{sku.id}</Typography.Text>
                </>
              ),
            },
            {
              title: '售价（元）',
              key: 'amount',
              render: (_, sku) => (
                <MoneyInput
                  label={`SKU ${sku.label} 售价`}
                  value={sku.amount}
                  onChange={(amount) =>
                    change({ skus: draft.skus.map((item) => (item.id === sku.id ? { ...item, amount: amount ?? 0 } : item)) })
                  }
                />
              ),
            },
            {
              title: '库存',
              key: 'stock',
              render: (_, sku) => (
                <InputNumber
                  aria-label={`SKU ${sku.label} 库存`}
                  precision={0}
                  min={0}
                  max={1000000000}
                  value={sku.stock}
                  onChange={(stock) =>
                    change({ skus: draft.skus.map((item) => (item.id === sku.id ? { ...item, stock: stock ?? 0 } : item)) })
                  }
                />
              ),
            },
          ]}
        />
      </Space>
      {regenerate && (
        <Modal open title="重新生成SKU组合" onCancel={() => setRegenerate(false)} onOk={generate} okText="确认生成" cancelText="返回">
          <p>相同规格组合保留原SKU；不再存在的组合从当前草稿移除，新组合库存和售价为0。历史发布快照和订单不受此步骤影响。</p>
        </Modal>
      )}
    </Modal>
  )
}