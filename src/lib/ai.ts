const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY as string;
const BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

export interface AIContext {
  suppliers: { name: string; category: string; tags: string }[];
  quotes: { rank: number; supplier: string; item: string; price: string; score: string }[];
  flowItems: { name: string; stage: string }[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(ctx: AIContext): string {
  const supplierList = ctx.suppliers.length > 0
    ? ctx.suppliers.map((s, i) => `${i + 1}. ${s.name} | 品类：${s.category} | 标签：${s.tags}`).join("\n")
    : "（暂无供应商数据）";

  const quoteList = ctx.quotes.length > 0
    ? ctx.quotes.map((q) => `第${q.rank}名 · ${q.supplier} | 项目：${q.item} | 报价：¥${q.price} | 综合评分：${q.score}/10`).join("\n")
    : "（暂无报价数据）";

  const flowList = ctx.flowItems.length > 0
    ? ctx.flowItems.map((f) => `- ${f.name} [当前阶段：${f.stage}]`).join("\n")
    : "（暂无流程事项）";

  return `你是"智采罗盘"系统的 AI 采购顾问。你的知识库就是以下本地数据库中的真实数据。

=== 供应商库（共 ${ctx.suppliers.length} 家）===
${supplierList}

=== 比价评分排名（共 ${ctx.quotes.length} 条）===
${quoteList}

=== 采购流程中的事项（共 ${ctx.flowItems.length} 项）===
${flowList}

=== 回答规则（必须遵守）===
1. 推荐供应商时必须从上述供应商库中选取，明确写出供应商名称和理由
2. 引用比价数据时必须使用实际的评分和报价，不能编造
3. 如果用户需求在供应商库中没有匹配的，如实告知并给出最接近的选项
4. 用中文回答，结构清晰，先结论后分析
5. 所有建议基于本地数据，提醒用户数据安全`;
}

export async function askProcurement(
  prompt: string,
  context: AIContext,
  history: ChatMessage[] = [],
): Promise<string> {
  if (!API_KEY) return "未配置智谱 API Key，请在 .env 中设置 VITE_ZHIPU_API_KEY。";

  const systemPrompt = buildSystemPrompt(context);

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "glm-4.7-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "AI 未返回有效结果，请重试。";
}
