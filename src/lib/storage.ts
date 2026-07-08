import { getSupabase } from "./supabase";

/* ============================================================
   类型定义
   ============================================================ */
export interface Supplier {
  id: number;
  name: string;
  category: string;
  contact: string;
  tags: string[];
  creditCode?: string;
  address?: string;
  status?: string;
}

export interface Quote {
  id: number;
  supplier: string;
  item: string;
  price: number;
  deliveryDays: number;
  service: number;
  quality: number;
}

export interface FlowItem {
  id: number;
  name: string;
  stage: number;
}

/* ============================================================
   默认演示数据
   ============================================================ */
const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 1, name: "杭州云科技有限公司", category: "云服务", contact: "张经理 138****1234", tags: ["腾讯云代理", "响应快"], creditCode: "91330100MA2ABCD123", address: "杭州市西湖区", status: "合作中" },
  { id: 2, name: "联想商用设备（浙江）", category: "硬件设备", contact: "李经理 139****5678", tags: ["笔记本", "台式机"], creditCode: "91330200MA3EFGH456", address: "宁波市高新区", status: "合作中" },
  { id: 3, name: "上海软通动力信息技术", category: "软件授权", contact: "刘经理 137****9012", tags: ["Adobe代理", "微软授权", "企业软件"], creditCode: "91310100MA5IJKL789", address: "上海市浦东新区", status: "合作中" },
];

const DEFAULT_QUOTES: Quote[] = [
  { id: 1, supplier: "杭州云科技有限公司", item: "腾讯云服务器 4核8G x 5台/年", price: 12000, deliveryDays: 2, service: 8, quality: 8 },
  { id: 2, supplier: "浙江数创科技", item: "腾讯云服务器 4核8G x 5台/年", price: 10800, deliveryDays: 5, service: 6, quality: 7 },
];

const DEFAULT_FLOW_ITEMS: FlowItem[] = [
  { id: 1, name: "腾讯云服务器扩容 5台", stage: 1 },
  { id: 2, name: "笔记本采购 10台", stage: 0 },
  { id: 3, name: "软件授权续费", stage: 3 },
];

/* ---- PR 采购申请 ---- */
export interface ApprovalLogEntry { step: number; operator: string; action: string; comment: string; time: number }
export interface PRItem {
  id: number;
  prNumber: string;
  department: string;
  applicant: string;
  type: string;
  spec: string;
  quantity: number;
  budget: number;
  reason: string;
  status: number; // 0草稿, 1待审批, 2通过, -1驳回
  approvalStep: number;
  approvalLog: ApprovalLogEntry[];
}

const DEFAULT_PR_ITEMS: PRItem[] = [
  { id: 1, prNumber: "PR-20260701-001", department: "IT部", applicant: "张工", type: "IT硬件", spec: "Dell PowerEdge R750xs 服务器×3", quantity: 3, budget: 150000, reason: "现有服务器资源不足，需扩容", status: 1, approvalStep: 1, approvalLog: [{ step: -1, operator: "张工", action: "提交", comment: "", time: Date.now() - 86400000 }, { step: 0, operator: "李经理", action: "通过", comment: "同意", time: Date.now() - 43200000 }] },
  { id: 2, prNumber: "PR-20260702-002", department: "市场部", applicant: "王芳", type: "软件授权", spec: "Adobe Creative Cloud 企业版×5", quantity: 5, budget: 25000, reason: "设计团队软件授权到期续费", status: 1, approvalStep: 0, approvalLog: [{ step: -1, operator: "王芳", action: "提交", comment: "", time: Date.now() - 3600000 }] },
  { id: 3, prNumber: "PR-20260703-003", department: "IT部", applicant: "赵工", type: "网络设备", spec: "Cisco Catalyst 9200 交换机×2", quantity: 2, budget: 36000, reason: "办公室网络升级", status: 2, approvalStep: 4, approvalLog: [{ step: -1, operator: "赵工", action: "提交", comment: "", time: Date.now() - 259200000 }, { step: 0, operator: "李经理", action: "通过", comment: "同意", time: Date.now() - 200000000 }, { step: 1, operator: "张工", action: "通过", comment: "符合网络规划", time: Date.now() - 150000000 }, { step: 2, operator: "王芳", action: "通过", comment: "预算内", time: Date.now() - 100000000 }, { step: 3, operator: "财务部", action: "通过", comment: "已确认", time: Date.now() - 50000000 }] },
  { id: 4, prNumber: "PR-20260704-004", department: "研发部", applicant: "陈工", type: "云服务", spec: "腾讯云 GPU 服务器 GN10Xp×1", quantity: 1, budget: 80000, reason: "AI 模型训练需要 GPU 算力", status: -1, approvalStep: 0, approvalLog: [{ step: -1, operator: "陈工", action: "提交", comment: "", time: Date.now() - 172800000 }, { step: 0, operator: "李经理", action: "驳回", comment: "预算超标，请提供成本对比分析", time: Date.now() - 86400000 }] },
];

/* ============================================================
   localStorage 适配器
   ============================================================ */
const LS_KEYS = {
  suppliers: "procure_suppliers",
  quotes: "procure_quotes",
  flows: "procure_flow_items",
  prs: "procure_pr_items",
  cloud: "procure_cloud_services",
};

function lsGet<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ============================================================
   统一数据接口
   ============================================================ */
let _isDemo = true;

export function getIsDemo() {
  return _isDemo;
}

// ---------- 供应商 ----------
export async function getSuppliers(): Promise<Supplier[]> {
  const sb = await getSupabase();
  if (sb) { _isDemo = false; const { data } = await sb.from("suppliers").select("*").order("id"); return (data as Supplier[]) ?? []; }
  _isDemo = true;
  const data = lsGet<Supplier>(LS_KEYS.suppliers, []);
  return data.length > 0 ? data : DEFAULT_SUPPLIERS;
}

export async function addSupplier(s: Omit<Supplier, "id">): Promise<Supplier> {
  const sb = await getSupabase();
  if (sb) {
    const id = Date.now();
    await sb.from("suppliers").insert({ ...s, id });
    return { ...s, id };
  }
  const list = await getSuppliers();
  const item: Supplier = { ...s, id: Date.now() };
  lsSet(LS_KEYS.suppliers, [...list, item]);
  return item;
}

export async function removeSupplier(id: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("suppliers").delete().eq("id", id);
    return;
  }
  const list = await getSuppliers();
  lsSet(LS_KEYS.suppliers, list.filter((x) => x.id !== id));
}

// ---------- 报价 ----------
export async function getQuotes(): Promise<Quote[]> {
  const sb = await getSupabase();
  if (sb) { const { data } = await sb.from("quotes").select("*").order("id"); return (data as Quote[]) ?? []; }
  const data = lsGet<Quote>(LS_KEYS.quotes, []);
  return data.length > 0 ? data : DEFAULT_QUOTES;
}

export async function addQuote(q: Omit<Quote, "id">): Promise<Quote> {
  const sb = await getSupabase();
  if (sb) {
    const id = Date.now();
    await sb.from("quotes").insert({ ...q, id });
    return { ...q, id };
  }
  const list = await getQuotes();
  const item: Quote = { ...q, id: Date.now() };
  lsSet(LS_KEYS.quotes, [...list, item]);
  return item;
}

export async function removeQuote(id: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("quotes").delete().eq("id", id);
    return;
  }
  const list = await getQuotes();
  lsSet(LS_KEYS.quotes, list.filter((x) => x.id !== id));
}

// ---------- 流程 ----------
export async function getFlowItems(): Promise<FlowItem[]> {
  const sb = await getSupabase();
  if (sb) { const { data } = await sb.from("flow_items").select("*").order("id"); return (data as FlowItem[]) ?? []; }
  const data = lsGet<FlowItem>(LS_KEYS.flows, []);
  return data.length > 0 ? data : DEFAULT_FLOW_ITEMS;
}

export async function addFlowItem(f: Omit<FlowItem, "id">): Promise<FlowItem> {
  const sb = await getSupabase();
  if (sb) {
    const id = Date.now();
    await sb.from("flow_items").insert({ ...f, id });
    return { ...f, id };
  }
  const list = await getFlowItems();
  const item: FlowItem = { ...f, id: Date.now() };
  lsSet(LS_KEYS.flows, [...list, item]);
  return item;
}

export async function updateFlowItemStage(id: number, stage: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("flow_items").update({ stage }).eq("id", id);
    return;
  }
  const list = await getFlowItems();
  lsSet(LS_KEYS.flows, list.map((x) => (x.id === id ? { ...x, stage } : x)));
}

export async function removeFlowItem(id: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("flow_items").delete().eq("id", id);
    return;
  }
  const list = await getFlowItems();
  lsSet(LS_KEYS.flows, list.filter((x) => x.id !== id));
}

/* ---- PR 采购申请 ---- */
export async function getPRItems(): Promise<PRItem[]> {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.from("pr_items").select("*").order("id");
    return (data as PRItem[]) ?? [];
  }
  const data = lsGet<PRItem>(LS_KEYS.prs, []);
  return data.length > 0 ? data : DEFAULT_PR_ITEMS;
}

export async function addPRItem(pr: Omit<PRItem, "id">): Promise<PRItem> {
  const sb = await getSupabase();
  if (sb) {
    const id = Date.now();
    await sb.from("pr_items").insert({ ...pr, id });
    return { ...pr, id };
  }
  const list = await getPRItems();
  const item: PRItem = { ...pr, id: Date.now() };
  lsSet(LS_KEYS.prs, [...list, item]);
  return item;
}

export async function updatePRItem(id: number, updates: Partial<PRItem>): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("pr_items").update(updates).eq("id", id);
    return;
  }
  const list = await getPRItems();
  lsSet(LS_KEYS.prs, list.map((x) => (x.id === id ? { ...x, ...updates } : x)));
}

export async function removePRItem(id: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("pr_items").delete().eq("id", id);
    return;
  }
  const list = await getPRItems();
  lsSet(LS_KEYS.prs, list.filter((x) => x.id !== id));
}

/* ---- 云服务方案 ---- */
export interface CloudService { id: number; vendor: string; spec: string; monthly: number; note: string; }

const DEFAULT_CLOUD: CloudService[] = [
  { id: 1, vendor: "腾讯云 CVM", spec: "2核4G", monthly: 165, note: "国内节点，延迟较低，新用户常有折扣" },
  { id: 2, vendor: "阿里云 ECS", spec: "2核4G", monthly: 180, note: "包年包月，适合轻量业务" },
  { id: 3, vendor: "AWS EC2", spec: "2核4G", monthly: 420, note: "按需计费，价格随汇率波动" },
  { id: 4, vendor: "腾讯云 CVM", spec: "4核8G", monthly: 330, note: "适合中小型应用/数据库" },
  { id: 5, vendor: "阿里云 ECS", spec: "4核8G", monthly: 360, note: "适合中小型应用/数据库" },
  { id: 6, vendor: "AWS EC2", spec: "4核8G", monthly: 610, note: "海外业务或跨境场景优先" },
];

export async function getCloudServices(): Promise<CloudService[]> {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.from("cloud_services").select("*").order("id");
    return (data as CloudService[]) ?? [];
  }
  const data = lsGet<CloudService>(LS_KEYS.cloud, []);
  return data.length > 0 ? data : DEFAULT_CLOUD;
}

export async function addCloudService(c: Omit<CloudService, "id">): Promise<CloudService> {
  const sb = await getSupabase();
  if (sb) {
    const id = Date.now();
    await sb.from("cloud_services").insert({ ...c, id });
    return { ...c, id };
  }
  const list = await getCloudServices();
  const item: CloudService = { ...c, id: Date.now() };
  lsSet(LS_KEYS.cloud, [...list, item]);
  return item;
}

export async function removeCloudService(id: number): Promise<void> {
  const sb = await getSupabase();
  if (sb) {
    await sb.from("cloud_services").delete().eq("id", id);
    return;
  }
  const list = await getCloudServices();
  lsSet(LS_KEYS.cloud, list.filter((x) => x.id !== id));
}

export function generatePRNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `PR-${y}${m}${d}-${seq}`;
}
