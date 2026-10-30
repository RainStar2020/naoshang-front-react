const fs = require('fs');
const path = require('path');

const IMPORT = "import HqDataSourceAlert from '../components/HqDataSourceAlert'";
const AUTH_IMPORT = "import { isMockAuth } from '../services/auth'";

function ensureImport(text, importLine) {
  if (text.includes(importLine)) return text;
  const lines = text.split(/\r?\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
  }
  if (lastImport < 0) throw new Error('no import found');
  lines.splice(lastImport + 1, 0, importLine);
  return lines.join('\n');
}

const replacements = [
  ['ActivationCodes.tsx', '<Alert type="warning" showIcon message="内存Mock：DEMO码不能用于真实小程序，整页刷新会重置。本页仅会员/专栏激活码，不可录入或分发软件卡；没有替用户激活的操作。绑定/转赠与批量上限待正式API确认。" />', '<HqDataSourceAlert mockMessage="内存Mock：DEMO码不能用于真实小程序，整页刷新会重置。本页仅会员/专栏激活码，不可录入或分发软件卡；没有替用户激活的操作。绑定/转赠与批量上限待正式API确认。" />'],
  ['Agents.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复演示数据。本页仅总部监管/配置，不替代小程序代理申请与签约流程。" description="累计佣金为演示快照，禁止前端推导结算或付款终态。写操作须原因、版本、幂等键与确认；结果未知请保留原请求号查询。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示数据。本页仅总部监管/配置，不替代小程序代理申请与签约流程。" mockDescription="累计佣金为演示快照，禁止前端推导结算或付款终态。写操作须原因、版本、幂等键与确认；结果未知请保留原请求号查询。" />'],
  ['Announcements.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复数据，尚未接通小程序公告API或消息推送；定时可见性按服务查询时间校验，列表每30秒刷新。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据，尚未接通小程序公告API或消息推送；定时可见性按服务查询时间校验，列表每30秒刷新。" />'],
  ['Columns.tsx', '<Alert showIcon type="warning" message="内存Mock：整页刷新恢复数据；上传仅本页预览，发布不会同步小程序。章节ID稳定、进度按账号隔离；可复购不重置授权/进度。商品和订单为演示关联。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据；上传仅本页预览，发布不会同步小程序。章节ID稳定、进度按账号隔离；可复购不重置授权/进度。商品和订单为演示关联。" />'],
  ['Costore.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复演示数据，未连接真实订单、支付、门店审批或退款API。拒审退款等以服务回执为准，禁止前端伪造终态。" description="先付款再由门店店长审核；总部不替代日常门店审批。拒审退款、合同签署及权益开通均等待服务端回执。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示数据，未连接真实订单、支付、门店审批或退款API。拒审退款等以服务回执为准，禁止前端伪造终态。" mockDescription="先付款再由门店店长审核；总部不替代日常门店审批。拒审退款、合同签署及权益开通均等待服务端回执。" />'],
  ['Coupons.tsx', '<Alert type="warning" showIcon message="内存Mock：刷新整页恢复数据。未接通真实发券、支付或小程序API；券生命周期验收订单独立于HQ-11历史订单。" />', '<HqDataSourceAlert mockMessage="内存Mock：刷新整页恢复数据。未接通真实发券、支付或小程序API；券生命周期验收订单独立于HQ-11历史订单。" />'],
  ['CourseCms.tsx', '<Alert type="warning" showIcon message="内存Mock环境：整页刷新会恢复数据。上传仅生成本页预览和 mock-assets.invalid 虚拟地址，不会传输至真实服务器；发布不会同步到小程序。" />', '<HqDataSourceAlert mockMessage="内存Mock环境：整页刷新会恢复数据。上传仅生成本页预览和 mock-assets.invalid 虚拟地址，不会传输至真实服务器；发布不会同步到小程序。" />'],
  ['Delivery.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复数据。交付订单为本模块独立演示快照；填写物流不会通知快递或小程序。写操作须原因/版本/幂等；禁止前端伪造交付终态。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据。交付订单为本模块独立演示快照；填写物流不会通知快递或小程序。写操作须原因/版本/幂等；禁止前端伪造交付终态。" />'],
  ['Invitations.tsx', '<Alert type="warning" showIcon message="内存Mock，整页刷新恢复演示数据，尚未同步小程序。总部变更只调整生效后的账号关系，保留首次注册绑定及历史记录。写操作须双版本+原因+幂等；不回算历史收益。" description="不回算历史收益、任务进度或名额；新业务归属由真实API决定。小程序无用户自助换绑入口，总部不使用个人名额给下级升级。" />', '<HqDataSourceAlert mockMessage="内存Mock，整页刷新恢复演示数据，尚未同步小程序。总部变更只调整生效后的账号关系，保留首次注册绑定及历史记录。写操作须双版本+原因+幂等；不回算历史收益。" mockDescription="不回算历史收益、任务进度或名额；新业务归属由真实API决定。小程序无用户自助换绑入口，总部不使用个人名额给下级升级。" />'],
  ['Members.tsx', '<Alert type="warning" showIcon message="内存 Mock 演示：本模块操作不影响小程序；整页刷新会恢复学员及权益数据。权益写操作须原因/版本/幂等/确认，进度按孩子隔离。" />', '<HqDataSourceAlert mockMessage="内存 Mock 演示：本模块操作不影响小程序；整页刷新会恢复学员及权益数据。权益写操作须原因/版本/幂等/确认，进度按孩子隔离。" />'],
  ['Orders.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复演示订单。履约仅允许服务端返回的动作（发货/改物流/确认交付），须原因+版本+幂等+确认；交付≠权益激活。真实支付/券/小程序API尚未接通。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示订单。履约仅允许服务端返回的动作（发货/改物流/确认交付），须原因+版本+幂等+确认；交付≠权益激活。真实支付/券/小程序API尚未接通。" />'],
  ['Partners.tsx', '<Alert type="warning" showIcon message="内存Mock：整页刷新恢复演示数据，尚未同步小程序。年度经营权益200元/年，与永久学习权益分离；升级不续期、不扣名额、不改历史收益。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复演示数据，尚未同步小程序。年度经营权益200元/年，与永久学习权益分离；升级不续期、不扣名额、不改历史收益。" />'],
  ['Payments.tsx', '<Alert showIcon type="warning" message="内存Mock：未连接真实支付渠道。查单不改本地付款状态；补单仅演示回执一次，不入账、不改HQ-11、不发权益。禁止客户端上报渠道终态；结果未知请保留原请求号重试。刷新整页恢复演示数据。" />', '<HqDataSourceAlert mockMessage="内存Mock：未连接真实支付渠道。查单不改本地付款状态；补单仅演示回执一次，不入账、不改HQ-11、不发权益。禁止客户端上报渠道终态；结果未知请保留原请求号重试。刷新整页恢复演示数据。" />'],
  ['Products.tsx', '<Alert showIcon type="warning" message="内存Mock：整页刷新恢复数据，尚未同步小程序。价格为演示配置；实际成交价、优惠券、库存预占由报价及订单API负责。" />', '<HqDataSourceAlert mockMessage="内存Mock：整页刷新恢复数据，尚未同步小程序。价格为演示配置；实际成交价、优惠券、库存预占由报价及订单API负责。" />'],
  ['Quotas.tsx', '<Alert type="warning" showIcon message="内存Mock，整页刷新恢复演示数据，尚未同步小程序。标准/活动名额均永久有效；活动名额不可转让、不可退款。充值须原因/版本/幂等/确认，禁止前端推导入账终态。" description="活动升级服务费按每个¥2,000.00的服务报价展示；付款前仅占用，成功后才消耗。总部不提供个人购买、划转、代付或退款操作。" />', '<HqDataSourceAlert mockMessage="内存Mock，整页刷新恢复演示数据，尚未同步小程序。标准/活动名额均永久有效；活动名额不可转让、不可退款。充值须原因/版本/幂等/确认，禁止前端推导入账终态。" mockDescription="活动升级服务费按每个¥2,000.00的服务报价展示；付款前仅占用，成功后才消耗。总部不提供个人购买、划转、代付或退款操作。" />'],
  ['SoftwareCards.tsx', '<Alert type="warning" showIcon message="内存Mock：仅接受DEMO-SW演示码，整页刷新恢复数据。交付≠外部激活、停发≠供应商作废；不可当作会员/专栏激活码使用。外部激活、月卡计时和真实订单均未接通。" />', '<HqDataSourceAlert mockMessage="内存Mock：仅接受DEMO-SW演示码，整页刷新恢复数据。交付≠外部激活、停发≠供应商作废；不可当作会员/专栏激活码使用。外部激活、月卡计时和真实订单均未接通。" />'],
  ['StaffRoles.tsx', '<Alert type="warning" showIcon message="内存 Mock：整页刷新恢复演示数据。密码永不回显，仅 credentialSet。正式改密/发码在服务端或门店侧完成。写操作须原因/版本/幂等/确认。" description="总部可配置门店经营能力，不可配置收益公式、提点或结算权限。离职/冻结保留记录；跨店须角色字典与任职同时开放。" />', '<HqDataSourceAlert mockMessage="内存 Mock：整页刷新恢复演示数据。密码永不回显，仅 credentialSet。正式改密/发码在服务端或门店侧完成。写操作须原因/版本/幂等/确认。" mockDescription="总部可配置门店经营能力，不可配置收益公式、提点或结算权限。离职/冻结保留记录；跨店须角色字典与任职同时开放。" />'],
  ['Users.tsx', '<Alert type="warning" showIcon message="本模块使用内存 Mock：操作不会同步到小程序，刷新整个页面将恢复演示数据。" />', '<HqDataSourceAlert mockMessage="本模块使用内存 Mock：操作不会同步到小程序，刷新整个页面将恢复演示数据。" />'],
  ['Training.tsx', '<Alert type="info" showIcon message="Mock 演示边界" description="成功仅表示内存 Mock 状态机通过：不代表真实课时扣减、家长可见反馈或附件已上传。附件仅保留审计字段。写操作须原因/版本/幂等；不伪造核销终态。" />', '<HqDataSourceAlert mockMessage="Mock 演示边界" mockDescription="成功仅表示内存 Mock 状态机通过：不代表真实课时扣减、家长可见反馈或附件已上传。附件仅保留审计字段。写操作须原因/版本/幂等；不伪造核销终态。" />'],
];

const dir = 'src/pages';
let fail = 0;
const changed = [];
for (const [file, from, to] of replacements) {
  const p = path.join(dir, file);
  let text = fs.readFileSync(p, 'utf8');
  if (!text.includes(from)) {
    console.error('MISS:', file);
    const idx = text.search(/内存|Mock 演示边界/);
    console.error('  near:', JSON.stringify(text.slice(Math.max(0, idx - 30), idx + 100)));
    fail++;
    continue;
  }
  text = text.replace(from, to);
  text = ensureImport(text, IMPORT);
  fs.writeFileSync(p, text);
  changed.push(file);
  console.log('OK', file);
}

// Stores multiline
{
  const p = path.join(dir, 'Stores.tsx');
  let text = fs.readFileSync(p, 'utf8');
  const from = '    <Alert type="warning" showIcon\n      message="内存 Mock，整页刷新恢复种子。金额界面按元展示（存分）；密码永不回显。监管写须原因/版本/幂等/确认；不替代小程序/门店日常开店流。"\n      description={<span>完整员工角色与任职 CRUD 见 <Link to="/staff-roles">员工与门店角色</Link>。本页任职列表只读。健脑官创建/改密由门店小程序完成，总部仅监管。</span>}\n    />';
  const to = '    <HqDataSourceAlert\n      mockMessage="内存 Mock，整页刷新恢复种子。金额界面按元展示（存分）；密码永不回显。监管写须原因/版本/幂等/确认；不替代小程序/门店日常开店流。"\n      mockDescription={<span>完整员工角色与任职 CRUD 见 <Link to="/staff-roles">员工与门店角色</Link>。本页任职列表只读。健脑官创建/改密由门店小程序完成，总部仅监管。</span>}\n    />';
  // normalize line endings for match
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.includes(from)) {
    console.error('MISS Stores');
    const i = normalized.indexOf('内存 Mock，整页刷新');
    console.error(JSON.stringify(normalized.slice(i - 50, i + 220)));
    fail++;
  } else {
    let out = normalized.replace(from, to);
    out = ensureImport(out, IMPORT);
    fs.writeFileSync(p, out.includes('\r\n') || text.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out);
    // keep LF which is fine for Vite
    fs.writeFileSync(p, out);
    changed.push('Stores.tsx');
    console.log('OK Stores.tsx');
  }
}

// Quotas modal
{
  const p = path.join(dir, 'Quotas.tsx');
  let text = fs.readFileSync(p, 'utf8');
  const fromAlert = '<Alert type="warning" message="仅执行内存Mock充值，不产生真实支付或到账。" />';
  const toAlert = "<Alert type={isMockAuth ? 'warning' : 'info'} message={isMockAuth ? '仅执行内存Mock充值，不产生真实支付或到账。' : '将向总部正式 API 提交名额充值；是否到账以服务回执为准。'} />";
  if (!text.includes(fromAlert)) {
    console.error('MISS Quotas modal');
    fail++;
  } else {
    text = text.replace(fromAlert, toAlert);
    text = text.replace("okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : '确认Mock充值'}", "okText={blocked ? '请关闭并刷新' : submitError ? '沿用原请求重试' : (isMockAuth ? '确认Mock充值' : '确认充值')}");
    text = ensureImport(text, AUTH_IMPORT);
    fs.writeFileSync(p, text);
    console.log('OK Quotas.tsx modal');
  }
}

console.log('changed:', changed.length, changed.join(', '));
if (fail) process.exit(1);