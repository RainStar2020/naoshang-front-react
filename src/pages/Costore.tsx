import { useEffect, useState } from 'react'
import { Alert, Button, Card, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { hasPermission } from '../auth/access'
import { costoreService as service } from '../services/costore'
import { CostoreError, type CostoreApplication, type CostoreCatalog, type CostoreDetail, type CostoreMutation, type CostorePlan, type CostoreQuery } from '../types/costore'
import CmsContentEditor from '../components/CmsContentEditor'
import { ContentPreview } from '../utils/richContent'
import HqDataSourceAlert from '../components/HqDataSourceAlert'
import { DebouncedSearchInput } from '../components/DebouncedSearchInput'
import SummaryTable from '../components/SummaryTable'
const formatUserDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Shanghai', hour12: false }).format(new Date(value))
  : '—'
const money=(n:number)=>`¥${Number(n||0).toFixed(2)}`
const appLabels={PENDING_PAYMENT:'待付款',PENDING_REVIEW:'门店待审核',APPROVED:'门店已通过',REJECTED:'门店已拒绝',CANCELLED:'已取消'}
const paymentLabels={PENDING_PAYMENT:'待支付',REFUNDING:'退款中',REFUNDED:'已退款',NOT_STARTED:'未付款',PENDING:'待付款',PAID:'已付款',CANCELLED:'已取消'}
const refundLabels={PENDING:'退款处理中',SUCCEEDED:'退款成功',FAILED:'退款失败'}
export default function Costore(){
 const { session } = useAuth()
 const { token, account } = session!
 const manage = hasPermission(account, 'costore:manage')
 const [catalog, setCatalog] = useState<CostoreCatalog | null>(null)
 const [q, setQ] = useState<CostoreQuery>({ page: 1, pageSize: 10 })
 const [list, setList] = useState<Awaited<ReturnType<typeof service.list>> | null>(null)
 const [error, setError] = useState('')
 const [refresh, setRefresh] = useState(0)
 const [detailId, setDetailId] = useState<string | null>(null)
 const [detail, setDetail] = useState<CostoreDetail | null>(null)
 const [plan, setPlan] = useState<CostorePlan | null>(null)
 const [title, setTitle] = useState('')
 const [benefits, setBenefits] = useState<CostorePlan['benefits'] | null>(null)
 const [agreement, setAgreement] = useState<CostorePlan['agreement'] | null>(null)
 const [pending, setPending] = useState<CostoreMutation | null>(null)
 const [reason, setReason] = useState('')
 const [submitError, setSubmitError] = useState('')
 const [busy, setBusy] = useState(false)
 const [blocked, setBlocked] = useState(false)
 const [paymentChoice, setPaymentChoice] = useState<'PAID'|'NOT_STARTED'>('NOT_STARTED')
 const [api, holder] = message.useMessage()
 useEffect(()=>{let live=true;service.catalog(token).then(v=>live&&setCatalog(v)).catch(e=>live&&setError(e.message));return()=>{live=false}},[token,refresh])
 useEffect(()=>{let live=true;service.list(token,q).then(v=>live&&setList(v)).catch(e=>live&&setError(e.message));return()=>{live=false}},[token,q,refresh])
 useEffect(()=>{let live=true;setDetail(null);if(detailId)service.detail(token,detailId).then(v=>live&&setDetail(v)).catch(e=>live&&setError(e.message));return()=>{live=false}},[token,detailId,refresh])
 const request=(v:CostoreMutation)=>{setPending(v);setReason('');setSubmitError('');setBlocked(false)}
 const requestPayment=(row:CostoreApplication)=>{setPaymentChoice(row.paymentStatus==='PAID'?'PAID':'NOT_STARTED');request({action:'update-payment',applicationId:row.applicationId,paymentStatus:row.paymentStatus==='PAID'?'NOT_STARTED':'PAID',version:row.version,reason:'',idempotencyKey:crypto.randomUUID()})}
 const emptyRich=()=>({version:1 as const,format:'nodes' as const,nodes:[] as CostorePlan['benefits']['nodes']});const cloneRich=(v:CostorePlan['benefits']|null|undefined)=>{try{return v?structuredClone(v):emptyRich()}catch{return emptyRich()}};const edit=(p:CostorePlan)=>{setPlan(p);setTitle(p.title??'');setBenefits(cloneRich(p.benefits));setAgreement(cloneRich(p.agreement));setSubmitError('')}
 const prepare=()=>{if(!plan||!benefits||!agreement||!title.trim()){setSubmitError('请填写标题、权益说明和协议说明');return}request({action:'save-plan',planId:plan.planId,title:title.trim(),benefits,agreement,version:plan.version,reason:'',idempotencyKey:crypto.randomUUID()})}
 const confirm=async()=>{if(!pending){setSubmitError('无可提交操作');return};setBusy(true);try{await service.mutate(token,{...pending,reason: reason.trim() || '总部确认操作'});setPending(null);setPlan(null);setRefresh(v=>v+1);api.success('合店操作已完成，记录已保存')}catch(e){setSubmitError(e instanceof Error?e.message:'结果未知，请保留请求号重试');setBlocked(e instanceof CostoreError&&['VERSION_CONFLICT','IDEMPOTENCY_CONFLICT'].includes(e.code))}finally{setBusy(false)}}
 return <Space direction="vertical" size={20} style={{width:'100%'}}>{holder}<Space style={{width:'100%',justifyContent:'space-between'}}><div><Typography.Title level={3} style={{margin:0}}>合店方案、申请监管与拒审退款</Typography.Title><Typography.Text type="secondary">合店申请监管与方案配置；不替代小程序申请与门店日常审批。</Typography.Text></div><Button onClick={()=>setRefresh(v=>v+1)}>刷新</Button></Space><HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示数据，未连接真实订单、支付、门店审批或退款API。拒审退款等以服务回执为准，禁止前端伪造终态。" mockDescription="先付款再由门店店长审核；总部不替代日常门店审批。拒审退款、合同签署及权益开通均等待服务端回执。" />{error&&<Alert type="error" message={error}/>}<Tabs defaultActiveKey="apps" items={[
 {key:'apps',label:'合店申请',children:<><Card><Space wrap><DebouncedSearchInput aria-label="合店申请搜索" placeholder="申请号 / 订单号 / 申请人 / 门店" value={q.keyword} onChange={keyword=>setQ(v=>({...v,keyword,page:1}))}/><Select aria-label="筛选合店申请状态" allowClear placeholder="全部申请状态" value={q.applicationStatus} onChange={applicationStatus=>setQ(v=>({...v,applicationStatus,page:1}))} options={Object.entries(appLabels).map(([value,label])=>({value,label}))}/><Select aria-label="筛选合店支付状态" allowClear placeholder="全部支付状态" value={q.paymentStatus} onChange={paymentStatus=>setQ(v=>({...v,paymentStatus,page:1}))} options={Object.entries(paymentLabels).map(([value,label])=>({value,label}))}/><Select aria-label="筛选退款状态" allowClear placeholder="全部退款状态" value={q.refundStatus??undefined} onChange={refundStatus=>setQ(v=>({...v,refundStatus,page:1}))} options={Object.entries(refundLabels).map(([value,label])=>({value,label}))}/><Button onClick={()=>setQ({page:1,pageSize:10})}>重置</Button></Space></Card>{list&&<SummaryTable items={[
  { key:'applications', label:'申请总数', value:list.summary?.applications ?? 0},
  { key:'paid', label:'已付款', value:list.summary?.paid ?? 0},
  { key:'pendingReview', label:'待审批', value:list.summary?.pendingReview ?? 0},
  { key:'rejected', label:'已拒绝', value:list.summary?.rejected ?? 0},
  { key:'refundPending', label:'退款处理中', value:list.summary?.refundPending ?? 0},
  { key:'refundFailed', label:'退款失败', value:list.summary?.refundFailed ?? 0},
]}/>}<Card title="合店申请"><Table<CostoreApplication> rowKey="applicationId" dataSource={list?.items ?? []} scroll={{x:1800}} pagination={{current:q.page,pageSize:q.pageSize,total:list?.total,showSizeChanger:true,pageSizeOptions:[5,10,20],onChange:(page,pageSize)=>setQ(v=>({...v,page,pageSize}))}} columns={[
  {title:'订单号',key:'order',width:160,render:(_,r:CostoreApplication)=>r.orderId ?? '尚未生成付款订单'},
  {title:'申请人',key:'applicant',width:170,render:(_,r:CostoreApplication)=><>{r.applicantName || '—'}{r.applicantPhone && <div style={{color:'#888',fontSize:12}}>{r.applicantPhone}</div>}</>},
  {title:'申请时间',key:'createdAt',width:170,render:(_,r:CostoreApplication)=>formatUserDate(r.createdAt)},
  {title:'申请门店',dataIndex:'storeName',width:170,ellipsis:true},
  {title:'门店联系电话',key:'contact',width:170,render:(_,r:CostoreApplication)=>r.storeContact || '—'},
  {title:'月费',key:'fee',width:90,render:(_,r:CostoreApplication)=>money(r.monthlyFee)},
  {title:'总费用',key:'payable',width:100,render:(_,r:CostoreApplication)=>money(r.payableAmount)},
  {title:'支付状态',key:'pay',width:100,render:(_,r:CostoreApplication)=>paymentLabels[r.paymentStatus]},
  {title:'操作',key:'o',width:520,render:(_,r:CostoreApplication)=><Space wrap={false} style={{whiteSpace:'nowrap'}}><Button size="small" onClick={()=>setDetailId(r.applicationId)}>监管详情</Button>{manage&&(r.allowedActions ?? []).includes('update-payment')&&<Button size="small" onClick={()=>requestPayment(r)}>修改付款状态</Button>}{manage&&(r.allowedActions ?? []).includes('approve')&&<Button type="primary" size="small" onClick={()=>request({action:'approve',applicationId:r.applicationId,version:r.version,reason:'',idempotencyKey:crypto.randomUUID()})}>通过</Button>}{manage&&(r.allowedActions ?? []).includes('reject')&&<Button danger size="small" onClick={()=>request({action:'reject',applicationId:r.applicationId,version:r.version,reason:'',idempotencyKey:crypto.randomUUID()})}>拒绝</Button>}{manage&&(r.allowedActions ?? []).includes('retry-refund')&&<Button danger size="small" onClick={()=>request({action:'retry-refund',applicationId:r.applicationId,version:r.version,reason:'',idempotencyKey:crypto.randomUUID()})}>按服务允许重试退款</Button>}</Space>}
]}/></Card></>},
 {key:'plans',label:'方案与协议',children:<Card title="合店方案"><Table rowKey="planId" dataSource={catalog?.plans ?? []} pagination={false} columns={[{title:'方案',dataIndex:'title'},{title:'时长（月）',dataIndex:'months',width:90},{title:'参考月费（只读）',key:'price',render:(_,r:CostorePlan)=>`${money(r.priceBoundary?.referenceMonthlyFee ?? 0)}/月起`},{title:'价格说明',key:'priceNote',ellipsis:true,render:(_,r:CostorePlan)=>r.priceBoundary?.note ?? '—'},{title:'协议版本',key:'a',render:(_,r:CostorePlan)=>r.agreementVersion?`V${r.agreementVersion}`:'待确认'},{title:'操作',key:'o',render:(_,r:CostorePlan)=><Button size="small" onClick={()=>edit(r)}>预览/编辑</Button>} ]}/></Card>} ]}/>
 <Drawer title="合店申请监管详情" open={!!detailId} onClose={()=>setDetailId(null)} width={1050}>{detail?.application&&<Space direction="vertical" size={16} style={{width:'100%'}}><Descriptions bordered column={2} items={[{key:'id',label:'申请 / 订单',children:`${detail.application.applicationId} / ${detail.application.orderId??'—'}`},{key:'app',label:'申请人',children:`${detail.application.applicantName} / ${detail.application.applicantPhone}`},{key:'store',label:'门店 / 方案',children:`${detail.application.storeName} / ${detail.application.durationLabel}`},{key:'amount',label:'报价快照',children:`${money(detail.application.monthlyFee)}/月，合计${money(detail.application.payableAmount)}`},{key:'status',label:'申请 / 支付',children:`${appLabels[detail.application.applicationStatus]} / ${paymentLabels[detail.application.paymentStatus]}`},{key:'refund',label:'退款',children:detail.application.refundStatus?refundLabels[detail.application.refundStatus]:'无退款'},{key:'contract',label:'合同 / 权益',span:2,children:`${detail.application.contractStatus} / ${detail.application.entitlementStatus}；只有API确认后更新`} ]}/>{detail.application.rejectionReason&&<Alert type="error" message={detail.application.rejectionReason}/>}<Table rowKey="refundId" title={()=>'退款回执'} dataSource={detail.refunds ?? []} pagination={false} columns={[{title:'退款ID',dataIndex:'refundId'},{title:'支付回执',dataIndex:'paymentReceiptId'},{title:'金额',key:'amt',render:(_,r)=>money(r.amount)},{title:'状态',key:'s',render:(_,r)=>refundLabels[r.status]},{title:'结果',key:'r',render:(_,r)=>r.failureReason??r.reason},{title:'创建时间',key:'c',render:(_,r)=>formatUserDate(r.createdAt)},{title:'完成时间',key:'t',render:(_,r)=>r.completedAt?formatUserDate(r.completedAt):'等待回执'} ]}/><Table rowKey="operationId" title={()=>'总部操作记录'} dataSource={detail.audit ?? []} pagination={false} columns={[{title:'操作',dataIndex:'action'},{title:'变更前',dataIndex:'before'},{title:'变更后',dataIndex:'after'},{title:'原因',dataIndex:'reason'},{title:'操作人',dataIndex:'operatorName'},{title:'时间',key:'t',render:(_,r)=>formatUserDate(r.occurredAt)} ]}/></Space>}</Drawer>
 <Modal title="合店方案与协议" open={!!plan&&!pending} onCancel={()=>setPlan(null)} footer={<Space><Button onClick={()=>setPlan(null)}>取消</Button>{manage&&<Button type="primary" onClick={prepare}>核对方案说明</Button>}</Space>}>{plan&&<Space direction="vertical" style={{width:'100%'}}><Typography.Text>价格边界只读：{money(plan.priceBoundary?.referenceMonthlyFee ?? 0)}/月起；{plan.priceBoundary?.note ?? ""}</Typography.Text><Input aria-label="合店方案标题" value={title} maxLength={60} onChange={e=>setTitle(e.target.value)}/><Typography.Text>权益说明</Typography.Text>{benefits&&<CmsContentEditor value={benefits} onChange={setBenefits} token={token} label="合店权益说明"/>}<Typography.Text>协议说明</Typography.Text>{agreement&&<CmsContentEditor value={agreement} onChange={setAgreement} token={token} label="合店协议说明"/>}{!manage&&<><ContentPreview value={plan.benefits ?? {version:1,format:'nodes',nodes:[]}}/><ContentPreview value={plan.agreement ?? {version:1,format:'nodes',nodes:[]}}/></>}</Space>}</Modal>
 <Modal title={pending?.action==='update-payment'?'修改付款状态':'确认总部合店操作'} open={!!pending} okText={blocked?'请关闭并刷新':submitError?'沿用原请求重试':'确认操作'} okButtonProps={{disabled:blocked}} confirmLoading={busy} onCancel={()=>{if(!busy){setPending(null);if(blocked)setRefresh(v=>v+1)}}} onOk={confirm}>{pending?.action==='update-payment'&&<Select style={{width:'100%'}} value={paymentChoice} options={[{value:'PAID',label:'已支付'},{value:'NOT_STARTED',label:'未支付'}]} onChange={value=>{setPaymentChoice(value);setPending(v=>v?.action==='update-payment'?{...v,paymentStatus:value}:v)}} />}{submitError&&<Alert type="error" message={submitError}/>}</Modal>
 </Space>
}
