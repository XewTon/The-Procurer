import {
  getSuppliers, addSupplier, removeSupplier,
  getQuotes, addQuote, removeQuote,
  getFlowItems, addFlowItem, updateFlowItemStage, removeFlowItem,
  getPRItems, addPRItem, generatePRNumber,
  getCloudServices, addCloudService,
  type Supplier, type Quote, type FlowItem, type PRItem, type CloudService,
} from "./storage";

const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY as string;
const BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/* ============================================================
   类型
   ============================================================ */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

/* ============================================================
   工具定义
   ============================================================ */
const TOOLS = [
  // ---- 供应商 ----
  { type: "function" as const, function: { name: "list_suppliers", description: "列出所有供应商", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function" as const, function: { name: "add_supplier", description: "添加新供应商", parameters: { type: "object", properties: { name: { type: "string", description: "供应商名称" }, category: { type: "string", description: "品类" }, contact: { type: "string", description: "联系人及电话" }, tags: { type: "string", description: "标签，逗号分隔" } }, required: ["name"] } } },
  { type: "function" as const, function: { name: "remove_supplier", description: "按名称删除供应商", parameters: { type: "object", properties: { name: { type: "string", description: "要删除的供应商名称" } }, required: ["name"] } } },

  // ---- 报价 ----
  { type: "function" as const, function: { name: "list_quotes", description: "列出所有报价", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function" as const, function: { name: "add_quote", description: "录入报价", parameters: { type: "object", properties: { supplier: { type: "string" }, item: { type: "string" }, price: { type: "number" }, deliveryDays: { type: "number" }, service: { type: "number" }, quality: { type: "number" } }, required: ["supplier", "item", "price"] } } },
  { type: "function" as const, function: { name: "remove_quote", description: "删除报价。先调用 list_quotes 获取报价的 id，再用 id 删除", parameters: { type: "object", properties: { id: { type: "number", description: "报价 ID" } }, required: ["id"] } } },
  { type: "function" as const, function: { name: "get_ranking", description: "获取比价排名（权重默认：价格40/交付25/服务20/质量15，与UI一致）", parameters: { type: "object", properties: {}, required: [] } } },

  // ---- 流程看板 ----
  { type: "function" as const, function: { name: "list_flow_items", description: "列出流程看板事项", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function" as const, function: { name: "add_flow_item", description: "添加事项到看板", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function" as const, function: { name: "advance_flow_item", description: "推进事项到下一阶段", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function" as const, function: { name: "reset_flow_item", description: "重置事项到第一阶段", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function" as const, function: { name: "remove_flow_item", description: "删除事项", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },

  // ---- PR 采购申请 ----
  { type: "function" as const, function: { name: "list_prs", description: "列出所有PR采购申请，含审批状态", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function" as const, function: { name: "add_pr", description: "创建新的PR采购申请", parameters: { type: "object", properties: { department: { type: "string", description: "申请部门" }, applicant: { type: "string", description: "申请人" }, type: { type: "string", description: "采购类型" }, spec: { type: "string", description: "产品规格" }, quantity: { type: "number", description: "数量" }, budget: { type: "number", description: "预算" }, reason: { type: "string", description: "采购原因" } }, required: ["department", "spec"] } } },

  // ---- 云服务 ----
  { type: "function" as const, function: { name: "list_cloud", description: "列出所有云服务方案", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function" as const, function: { name: "add_cloud", description: "添加云服务方案", parameters: { type: "object", properties: { vendor: { type: "string", description: "供应商/产品" }, spec: { type: "string", description: "规格如2核4G" }, monthly: { type: "number", description: "月费" }, note: { type: "string", description: "备注" } }, required: ["vendor", "spec", "monthly"] } } },
];

const STAGES = ["PR 需求申请", "RFQ 询价", "比价分析", "PO 下单", "验收付款"];

/* ============================================================
   工具执行器
   ============================================================ */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      // ---- 供应商 ----
      case "list_suppliers": {
        const list = await getSuppliers();
        return JSON.stringify(list.map((s: Supplier) => ({ id: s.id, name: s.name, category: s.category, contact: s.contact, tags: s.tags.join("、") })), null, 0);
      }
      case "add_supplier": {
        const s = await addSupplier({ name: args.name as string, category: (args.category as string) || "未分类", contact: (args.contact as string) || "", tags: args.tags ? (args.tags as string).split(/[,，]/).map((t: string) => t.trim()).filter(Boolean) : [] });
        return `已添加供应商: ${s.name} (ID: ${s.id})`;
      }
      case "remove_supplier": {
        const list = await getSuppliers();
        const found = list.find((s: Supplier) => s.name === args.name);
        if (!found) return `未找到供应商: ${args.name}`;
        await removeSupplier(found.id);
        return `已删除供应商: ${found.name}`;
      }

      // ---- 报价 ----
      case "list_quotes": {
        const list = await getQuotes();
        return JSON.stringify(list.map((q: Quote) => ({ id: q.id, supplier: q.supplier, item: q.item, price: q.price, deliveryDays: q.deliveryDays, service: q.service, quality: q.quality })), null, 0);
      }
      case "add_quote": {
        const q = await addQuote({ supplier: args.supplier as string, item: args.item as string, price: Number(args.price) || 0, deliveryDays: Number(args.deliveryDays) || 0, service: Number(args.service) || 0, quality: Number(args.quality) || 0 });
        return `已录入报价: ${q.supplier} - ${q.item} - ¥${q.price.toLocaleString()}`;
      }
      case "remove_quote": {
        const id = Number(args.id);
        if (!id) return "请提供要删除的报价 ID";
        const list = await getQuotes();
        const found = list.find((q: Quote) => q.id === id);
        if (!found) return `未找到 ID 为 ${id} 的报价`;
        await removeQuote(id);
        return `已删除报价: ${found.supplier} - ${found.item}`;
      }
      case "get_ranking": {
        const quotes = await getQuotes();
        if (quotes.length === 0) return "暂无报价数据";
        const prices = quotes.map((q) => q.price);
        const deliveries = quotes.map((q) => q.deliveryDays);
        const maxP = Math.max(...prices);
        const minP = Math.min(...prices);
        const maxD = Math.max(...deliveries);
        const minD = Math.min(...deliveries);
        const ranked = quotes.map((q) => {
          const ps = maxP === minP ? 10 : ((maxP - q.price) / (maxP - minP)) * 10;
          const ds = maxD === minD ? 10 : ((maxD - q.deliveryDays) / (maxD - minD)) * 10;
          // 权重与 UI 默认一致：价格40 / 交付25 / 服务20 / 质量15
          const score = (ps * 0.4 + ds * 0.25 + q.service * 0.2 + q.quality * 0.15);
          return { supplier: q.supplier, item: q.item, price: q.price, score: +score.toFixed(1) };
        }).sort((a, b) => b.score - a.score);
        return JSON.stringify(ranked.map((r, i) => ({ rank: i + 1, ...r })), null, 0);
      }

      // ---- 流程看板 ----
      case "list_flow_items": {
        const list = await getFlowItems();
        return JSON.stringify(list.map((f: FlowItem) => ({ id: f.id, name: f.name, stage: STAGES[f.stage] ?? `阶段${f.stage}` })), null, 0);
      }
      case "add_flow_item": {
        const f = await addFlowItem({ name: args.name as string, stage: 0 });
        return `已添加事项: ${f.name} (当前阶段: ${STAGES[0]})`;
      }
      case "advance_flow_item": {
        const list = await getFlowItems();
        const found = list.find((f: FlowItem) => f.name === args.name);
        if (!found) return `未找到事项: ${args.name}`;
        if (found.stage >= STAGES.length - 1) return `${found.name} 已处于最终阶段`;
        await updateFlowItemStage(found.id, found.stage + 1);
        return `${found.name} 已推进至"${STAGES[found.stage + 1]}"`;
      }
      case "reset_flow_item": {
        const list = await getFlowItems();
        const found = list.find((f: FlowItem) => f.name === args.name);
        if (!found) return `未找到事项: ${args.name}`;
        await updateFlowItemStage(found.id, 0);
        return `${found.name} 已重置回"${STAGES[0]}"`;
      }
      case "remove_flow_item": {
        const list = await getFlowItems();
        const found = list.find((f: FlowItem) => f.name === args.name);
        if (!found) return `未找到事项: ${args.name}`;
        await removeFlowItem(found.id);
        return `已删除事项: ${found.name}`;
      }

      // ---- PR 采购申请 ----
      case "list_prs": {
        const list = await getPRItems();
        return JSON.stringify(list.map((p: PRItem) => ({ id: p.id, prNumber: p.prNumber, department: p.department, type: p.type, spec: p.spec, budget: p.budget, status: p.status === 0 ? "草稿" : p.status === 1 ? "待审批" : p.status === 2 ? "已通过" : "已驳回", approvalStep: p.approvalStep })), null, 0);
      }
      case "add_pr": {
        const p = await addPRItem({ prNumber: generatePRNumber(), department: args.department as string, applicant: (args.applicant as string) || "", type: (args.type as string) || "其他", spec: args.spec as string, quantity: Number(args.quantity) || 1, budget: Number(args.budget) || 0, reason: (args.reason as string) || "", status: 0, approvalStep: 0, approvalLog: [] });
        return `已创建 PR: ${p.prNumber} - ${p.spec} (¥${p.budget.toLocaleString()})`;
      }

      // ---- 云服务 ----
      case "list_cloud": {
        const list = await getCloudServices();
        return JSON.stringify(list.map((c: CloudService) => ({ id: c.id, vendor: c.vendor, spec: c.spec, monthly: c.monthly, note: c.note })), null, 0);
      }
      case "add_cloud": {
        const c = await addCloudService({ vendor: args.vendor as string, spec: args.spec as string, monthly: Number(args.monthly) || 0, note: (args.note as string) || "" });
        return `已添加云方案: ${c.vendor} ${c.spec} ¥${c.monthly}/月`;
      }

      default:
        return `未知工具: ${name}`;
    }
  } catch (err) {
    return `执行失败: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/* ============================================================
   Agent 单步调用
   ============================================================ */
export async function runAgentStep(
  messages: ChatMessage[],
): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
  if (!API_KEY) return { content: "未配置智谱 API Key", toolCalls: [] };

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: "glm-4-flash", messages, tools: TOOLS, tool_choice: "auto", temperature: 0.3 }),
    });

    if (!res.ok) return { content: `API 请求失败 (${res.status})，请稍后重试。`, toolCalls: [] };

    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return { content: "AI 未返回有效结果，请重试。", toolCalls: [] };

    const content: string | null = msg.content || null;
    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }
      return { id: tc.id, name: tc.function.name, args };
    });

    return { content, toolCalls };
  } catch {
    return { content: "网络请求失败，请检查网络连接。", toolCalls: [] };
  }
}

/* ============================================================
   Agent System Prompt
   ============================================================ */
export const AGENT_SYSTEM_PROMPT = `你是"智采罗盘"系统的 AI 采购 Agent。你可以调用工具函数来实际操作系统。

## 核心原则
1. 所有操作基于本地数据，数据不会外泄
2. 写操作（添加/删除/修改）前先向用户说明计划
3. 删除操作前务必确认
4. 先调用 list_* 获取当前数据，再决定下一步
5. 回复简洁，先汇报结果再解释原因

## 工作流程
用户："帮我添加一个云服务供应商" → 调用 add_supplier
用户："哪个供应商评分最高？" → 调用 get_ranking
用户："帮我创建一个PR申请" → 调用 add_pr
用户："现在有哪些PR？" → 调用 list_prs`;
