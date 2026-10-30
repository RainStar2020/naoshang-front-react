import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable, { type Column } from '../components/DataTable'
import StatusTag from '../components/StatusTag'
import Modal from '../components/Modal'
import ImageUpload from '../components/ImageUpload'
import { ToastHost, useToast } from '../components/Toast'
import { mockMemberPlans, mockProducts, type MemberPlan, type Product, type ProductType } from '../mock/data'
import { formatMoney, uid } from '../utils/file'

const productTypes: ProductType[] = ['课程', '套餐', '会员卡']

interface ProductForm {
  id: string
  name: string
  type: ProductType
  cover: string
  costPrice: number
  salePrice: number
  stock: number
  intro: string
}

interface PlanForm {
  id: string
  name: string
  level: number
  period: string
  price: number
  originalPrice: number
  discount: number
  benefits: string
  enabled: boolean
}

export default function Pricing() {
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [plans, setPlans] = useState<MemberPlan[]>(mockMemberPlans)

  const [productModal, setProductModal] = useState<{ open: boolean; editing: boolean; form: ProductForm }>({
    open: false, editing: false,
    form: { id: '', name: '', type: '课程', cover: '', costPrice: 0, salePrice: 0, stock: 100, intro: '' },
  })
  const [planModal, setPlanModal] = useState<{ open: boolean; editing: boolean; form: PlanForm }>({
    open: false, editing: false,
    form: { id: '', name: '', level: 2, period: '按月', price: 0, originalPrice: 0, discount: 1, benefits: '', enabled: true },
  })
  const { toasts, push } = useToast()

  const openNewProduct = () => {
    setProductModal({
      open: true, editing: false,
      form: { id: '', name: '', type: '课程', cover: '', costPrice: 0, salePrice: 0, stock: 100, intro: '' },
    })
  }

  const openEditProduct = (p: Product) => {
    setProductModal({
      open: true, editing: true,
      form: { id: p.id, name: p.name, type: p.type, cover: p.cover, costPrice: p.costPrice, salePrice: p.salePrice, stock: p.stock, intro: '' },
    })
  }

  const saveProduct = () => {
    const f = productModal.form
    if (!f.name.trim()) return push('请填写商品名称', 'error')
    if (f.salePrice < f.costPrice) return push('销售价不能低于成本价', 'error')
    const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    if (productModal.editing) {
      setProducts((prev) => prev.map((p) => p.id === f.id
        ? { ...p, name: f.name, type: f.type, cover: f.cover, costPrice: f.costPrice, salePrice: f.salePrice, stock: f.stock, updatedAt: now }
        : p))
      push('商品信息已更新')
    } else {
      setProducts((prev) => [{
        id: `P${1001 + prev.length}`, name: f.name, type: f.type, cover: f.cover,
        costPrice: f.costPrice, salePrice: f.salePrice, stock: f.stock, status: '上架中', updatedAt: now,
      }, ...prev])
      push('商品已发布上架')
    }
    setProductModal({ ...productModal, open: false })
  }

  const toggleProduct = (p: Product) => {
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, status: x.status === '上架中' ? '已下架' : '上架中' } : x))
  }

  const openNewPlan = () => {
    setPlanModal({
      open: true, editing: false,
      form: { id: '', name: '', level: plans.length + 1, period: '按月', price: 0, originalPrice: 0, discount: 1, benefits: '', enabled: true },
    })
  }

  const openEditPlan = (m: MemberPlan) => {
    setPlanModal({
      open: true, editing: true,
      form: { id: m.id, name: m.name, level: m.level, period: m.period, price: m.price, originalPrice: m.originalPrice, discount: m.discount, benefits: m.benefits.join('\n'), enabled: m.enabled },
    })
  }

  const savePlan = () => {
    const f = planModal.form
    if (!f.name.trim()) return push('请填写等级名称', 'error')
    const benefits = f.benefits.split('\n').map((s) => s.trim()).filter(Boolean)
    if (planModal.editing) {
      setPlans((prev) => prev.map((m) => m.id === f.id
        ? { ...m, name: f.name, level: f.level, period: f.period, price: f.price, originalPrice: f.originalPrice, discount: f.discount, benefits, enabled: f.enabled }
        : m))
      push('会员等级已更新')
    } else {
      setPlans((prev) => [...prev, {
        id: uid(), name: f.name, level: f.level, period: f.period, price: f.price,
        originalPrice: f.originalPrice, discount: f.discount, benefits, enabled: f.enabled,
      }])
      push('会员等级已新增')
    }
    setPlanModal({ ...planModal, open: false })
  }

  const togglePlan = (m: MemberPlan) => {
    setPlans((prev) => prev.map((x) => x.id === m.id ? { ...x, enabled: !x.enabled } : x))
  }

  const productColumns: Column<Product>[] = [
    { key: 'id', title: '商品 ID', width: 90 },
    { key: 'name', title: '商品名称', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: 12, flexShrink: 0 }}>
          {r.type.slice(0, 1)}
        </div>
        <span style={{ fontWeight: 500 }}>{r.name}</span>
      </div>
    ) },
    { key: 'type', title: '类型', width: 80, align: 'center' },
    { key: 'costPrice', title: '成本价', align: 'right', render: (r) => `¥${formatMoney(r.costPrice)}` },
    { key: 'salePrice', title: '销售价', align: 'right', render: (r) => <span style={{ color: 'var(--red)', fontWeight: 600 }}>¥{formatMoney(r.salePrice)}</span> },
    {
      key: 'margin', title: '毛利率', width: 90, align: 'center',
      render: (r) => {
        if (r.salePrice <= 0) return '—'
        const margin = ((r.salePrice - r.costPrice) / r.salePrice) * 100
        return <span style={{ color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>{margin.toFixed(1)}%</span>
      },
    },
    { key: 'stock', title: '库存', width: 70, align: 'center' },
    { key: 'status', title: '状态', width: 90, align: 'center', render: (r) => <StatusTag status={r.status} /> },
    { key: 'updatedAt', title: '更新时间', width: 150, render: (r) => <span style={{ color: 'var(--text-3)' }}>{r.updatedAt}</span> },
    {
      key: 'actions', title: '操作', width: 150,
      render: (r) => (
        <div className="row-actions">
          <button className="btn-text" onClick={() => openEditProduct(r)}>编辑</button>
          <button className={`btn-text ${r.status === '已下架' ? '' : 'danger'}`} onClick={() => toggleProduct(r)}>
            {r.status === '上架中' ? '下架' : '上架'}
          </button>
        </div>
      ),
    },
  ]

  const maxLevel = useMemo(() => Math.max(...plans.map((p) => p.level)), [plans])

  return (
    <div>
      <ToastHost toasts={toasts} />
      <PageHeader
        title="定价模块"
        description="发布课程 / 套餐 / 会员卡等商品，分别维护成本价与销售价；同时配置各会员等级收费与权益折扣。"
        actions={<button className="btn btn-primary" onClick={openNewProduct}>发布商品</button>}
      />

      {/* 商品定价 */}
      <div className="card">
        <h3 className="card-title">
          商品定价
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>成本价仅内部核算，销售价面向学员展示</span>
        </h3>
        <DataTable columns={productColumns} rows={products} emptyText="暂无商品，点击右上角发布商品" />
      </div>

      {/* 会员等级定价 */}
      <div className="card">
        <h3 className="card-title">
          会员等级收费
          <button className="btn btn-ghost btn-sm" onClick={openNewPlan}>新增等级</button>
        </h3>
        <div className="member-grid">
          {plans.map((m) => (
            <div key={m.id} className={`member-card ${m.level === maxLevel ? 'recommended' : ''} ${m.enabled ? '' : 'disabled'}`}>
              <span className="member-level">Lv.{m.level}</span>
              <div className="member-name">{m.name}</div>
              <div>
                <span className="member-price">¥{formatMoney(m.price)}<span className="period"> / {m.period}</span></span>
                <span className="member-original">¥{formatMoney(m.originalPrice)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', margin: '6px 0 0' }}>
                商品购买折扣：{m.discount === 1 ? '原价' : `${(m.discount * 10).toFixed(1)} 折`}
              </div>
              <ul className="member-benefits">
                {m.benefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
              <div className="member-footer">
                <StatusTag status={m.enabled ? '合作中' : '已解约'} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-text" onClick={() => openEditPlan(m)}>编辑</button>
                  <button className={`btn-text ${m.enabled ? 'danger' : ''}`} onClick={() => togglePlan(m)}>
                    {m.enabled ? '停用' : '启用'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 定价规则说明 */}
      <div className="card">
        <h3 className="card-title">定价规则说明</h3>
        <ul className="notice-list">
          <li>成本价用于核算毛利与批量采购结算，不会出现在学员端页面。</li>
          <li>销售价为商品挂牌价；会员下单时按对应等级折扣自动折算实付金额。</li>
          <li>商品下架后学员端不可见，已有订单与权益不受影响。</li>
          <li>会员等级费用按周期（月 / 季 / 年）收取，到期自动续费或降级，可在收益模块查看会员收入。</li>
        </ul>
      </div>

      {/* 商品弹窗 */}
      <Modal
        open={productModal.open}
        title={productModal.editing ? '编辑商品' : '发布商品'}
        width={600}
        onClose={() => setProductModal({ ...productModal, open: false })}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setProductModal({ ...productModal, open: false })}>取消</button>
            <button className="btn btn-primary" onClick={saveProduct}>保存</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-item" style={{ flex: 2 }}>
            <label className="form-label"><span className="required">*</span>商品名称</label>
            <input className="form-input" value={productModal.form.name} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, name: e.target.value } }))} />
          </div>
          <div className="form-item">
            <label className="form-label">类型</label>
            <select className="form-select" value={productModal.form.type} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, type: e.target.value as ProductType } }))}>
              {productTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">成本价（¥）</label>
            <input type="number" min={0} className="form-input" value={productModal.form.costPrice} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, costPrice: Number(e.target.value) } }))} />
          </div>
          <div className="form-item">
            <label className="form-label"><span className="required">*</span>销售价（¥）</label>
            <input type="number" min={0} className="form-input" value={productModal.form.salePrice} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, salePrice: Number(e.target.value) } }))} />
          </div>
          <div className="form-item">
            <label className="form-label">库存</label>
            <input type="number" min={0} className="form-input" value={productModal.form.stock} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, stock: Number(e.target.value) } }))} />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">商品封面</label>
          <ImageUpload value={productModal.form.cover} onChange={(v) => setProductModal((p) => ({ ...p, form: { ...p.form, cover: v } }))} ratio="16:9" hint="上传商品封面（可选）" />
        </div>
        <div className="form-item">
          <label className="form-label">商品简介</label>
          <textarea className="form-textarea" value={productModal.form.intro} onChange={(e) => setProductModal((p) => ({ ...p, form: { ...p.form, intro: e.target.value } }))} />
        </div>
      </Modal>

      {/* 会员等级弹窗 */}
      <Modal
        open={planModal.open}
        title={planModal.editing ? '编辑会员等级' : '新增会员等级'}
        width={600}
        onClose={() => setPlanModal({ ...planModal, open: false })}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPlanModal({ ...planModal, open: false })}>取消</button>
            <button className="btn btn-primary" onClick={savePlan}>保存</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-item" style={{ flex: 2 }}>
            <label className="form-label"><span className="required">*</span>等级名称</label>
            <input className="form-input" value={planModal.form.name} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, name: e.target.value } }))} />
          </div>
          <div className="form-item">
            <label className="form-label">等级序号</label>
            <input type="number" min={1} className="form-input" value={planModal.form.level} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, level: Number(e.target.value) } }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">收费周期</label>
            <select className="form-select" value={planModal.form.period} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, period: e.target.value } }))}>
              {['按月', '按季', '按年'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">现价（¥）</label>
            <input type="number" min={0} className="form-input" value={planModal.form.price} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, price: Number(e.target.value) } }))} />
          </div>
          <div className="form-item">
            <label className="form-label">原价（¥）</label>
            <input type="number" min={0} className="form-input" value={planModal.form.originalPrice} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, originalPrice: Number(e.target.value) } }))} />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">商品折扣（0.1 ~ 1，1 表示原价）</label>
          <input type="number" min={0.1} max={1} step={0.1} className="form-input" value={planModal.form.discount} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, discount: Number(e.target.value) } }))} />
        </div>
        <div className="form-item">
          <label className="form-label">权益说明（每行一条）</label>
          <textarea className="form-textarea" rows={6} value={planModal.form.benefits} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, benefits: e.target.value } }))} />
        </div>
        <div className="form-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="plan-enabled" type="checkbox" checked={planModal.form.enabled} onChange={(e) => setPlanModal((p) => ({ ...p, form: { ...p.form, enabled: e.target.checked } }))} />
          <label htmlFor="plan-enabled" style={{ color: 'var(--text-2)' }}>发布后立即启用该等级</label>
        </div>
      </Modal>
    </div>
  )
}
