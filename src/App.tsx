import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Star, Server, ClipboardList, ArrowRight, Cloud,
  Sun, CloudRain, CloudLightning, Snowflake, CloudFog, RefreshCw,
  Clock3, Building2, FileText, Send, BarChart3, ShoppingCart,
  CheckCircle2, ScrollText, Landmark, Gauge, Download, Database, Bot, Sparkles, Loader2,
  LayoutDashboard, TrendingUp, Users, Banknote, Package, ArrowUpRight, Clock, Pencil,
  UserCheck, ChevronDown, Check, X as XIcon
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie
} from "recharts";
import {
  getSuppliers, addSupplier, removeSupplier,
  getQuotes, addQuote, removeQuote,
  getFlowItems, addFlowItem, updateFlowItemStage, removeFlowItem,
  getPRItems, addPRItem, updatePRItem, removePRItem, generatePRNumber,
  getCloudServices, addCloudService,
  getIsDemo,
  type Supplier, type Quote, type FlowItem, type PRItem, type ApprovalLogEntry, type CloudService,
} from "@/lib/storage";
import { exportToExcel } from "@/lib/export";
import { runAgentStep, executeTool, AGENT_SYSTEM_PROMPT, type ToolCall } from "@/lib/agent";
import { fetchWeatherByCoords, fetchWeatherByCity, getLocationError, type WeatherData } from "@/lib/weather";
import WeatherWidget from "@/components/WeatherWidget";

/* ============================================================
   天气场景配置（对应实时天气 API 六种状态）
   ============================================================ */
const WEATHER_MODES = {
  sunny: {
    label: "晴天",
    icon: Sun,
    sky: "linear-gradient(180deg, #F5E6C8 0%, #E8D3A0 45%, #C9A45C 100%)",
    ink: "#5B4636",
    accent: "#D4AF37",
    vignette: "rgba(139,111,71,0.35)",
    particle: "sun",
  },
  cloudy: {
    label: "多云",
    icon: Cloud,
    sky: "linear-gradient(180deg, #DCE2E6 0%, #B7C1C8 45%, #8E9AA3 100%)",
    ink: "#3E4A52",
    accent: "#7C8B95",
    vignette: "rgba(60,70,78,0.35)",
    particle: "cloudy",
  },
  rain: {
    label: "雨天",
    icon: CloudRain,
    sky: "linear-gradient(180deg, #263238 0%, #37474F 45%, #546E7A 100%)",
    ink: "#B0BEC5",
    accent: "#90A4AE",
    vignette: "rgba(10,16,20,0.55)",
    particle: "rain",
  },
  storm: {
    label: "雷暴",
    icon: CloudLightning,
    sky: "linear-gradient(180deg, #101820 0%, #141E33 45%, #1A237E 100%)",
    ink: "#C5CAE9",
    accent: "#5C6BC0",
    vignette: "rgba(0,0,0,0.6)",
    particle: "storm",
  },
  snow: {
    label: "大雪",
    icon: Snowflake,
    sky: "linear-gradient(180deg, #ECEFF1 0%, #DCE3E6 45%, #CFD8DC 100%)",
    ink: "#546E7A",
    accent: "#90A4AE",
    vignette: "rgba(84,110,119,0.3)",
    particle: "snow",
  },
  fog: {
    label: "大雾",
    icon: CloudFog,
    sky: "linear-gradient(180deg, #E7E9EA 0%, #D3D6D8 45%, #BFC3C6 100%)",
    ink: "#616568",
    accent: "#9AA0A3",
    vignette: "rgba(90,92,94,0.4)",
    particle: "fog",
  },
};

const RANK_GLYPH = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛"];

/* ============================================================
   天气粒子背景层
   ============================================================ */
function WeatherBackground({ mode }: { mode: string }) {
  const cfg = WEATHER_MODES[mode as keyof typeof WEATHER_MODES];

  const particles = useMemo(() => {
    const counts: Record<string, number> = { sun: 26, cloudy: 8, rain: 90, storm: 70, snow: 60, fog: 6 };
    const n = counts[cfg.particle] ?? 30;
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 3 + Math.random() * 6,
      size: 2 + Math.random() * 4,
      drift: Math.random() * 40 - 20,
    }));
  }, [cfg.particle]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: cfg.sky }}>
      <style>{`
        @keyframes sp-fall { 0% { transform: translateY(-10vh) translateX(0); opacity:0.9;} 100% { transform: translateY(110vh) translateX(var(--drift, 0px)); opacity:0.6;} }
        @keyframes sp-drift { 0% { transform: translateY(0) translateX(-5px); opacity:0.15;} 50% { opacity:0.55;} 100% { transform: translateY(-20px) translateX(5px); opacity:0.15;} }
        @keyframes sp-cloud { 0% { transform: translateX(-10vw); } 100% { transform: translateX(110vw); } }
        @keyframes sp-flash {
          0%, 91%, 93.5%, 96%, 100% { opacity: 0; }
          92% { opacity: 0.75; }
          94.5% { opacity: 0.35; }
          97% { opacity: 0.55; }
        }
        @keyframes sp-foglayer { 0% { transform: translateX(-8%);} 50% { transform: translateX(8%);} 100% { transform: translateX(-8%);} }
      `}</style>

      {cfg.particle === "storm" && (
        <div className="absolute inset-0 bg-white" style={{ animation: "sp-flash 7.5s infinite" }} />
      )}

      {cfg.particle === "sun" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size,
              background: "radial-gradient(circle, rgba(255,244,214,0.95), rgba(212,175,55,0))",
              animation: `sp-drift ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}

      {cfg.particle === "cloudy" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full blur-xl"
            style={{
              left: 0, top: `${p.top * 0.6}%`, width: 140 + p.size * 10, height: 40 + p.size * 4,
              background: "rgba(255,255,255,0.35)",
              animation: `sp-cloud ${20 + p.duration * 3}s linear ${p.delay}s infinite`,
            }}
          />
        ))}

      {cfg.particle === "rain" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`, top: 0, width: 1.5, height: 14 + p.size * 4,
              background: "linear-gradient(180deg, rgba(176,190,197,0) 0%, rgba(176,190,197,0.8) 100%)",
              "--drift": `${p.drift * 0.2}px`,
              animation: `sp-fall ${0.6 + p.duration * 0.12}s linear ${p.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}

      {cfg.particle === "storm" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`, top: 0, width: 1.5, height: 16 + p.size * 5,
              background: "linear-gradient(180deg, rgba(197,202,233,0) 0%, rgba(197,202,233,0.7) 100%)",
              "--drift": `${p.drift * 0.3}px`,
              animation: `sp-fall ${0.5 + p.duration * 0.1}s linear ${p.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}

      {cfg.particle === "snow" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`, top: 0, width: p.size, height: p.size, opacity: 0.85,
              "--drift": `${p.drift}px`,
              animation: `sp-fall ${6 + p.duration}s linear ${p.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}

      {cfg.particle === "fog" &&
        particles.map((p) => (
          <div
            key={p.id}
            className="absolute bg-white blur-2xl"
            style={{
              left: 0, top: `${p.top}%`, width: "60%", height: 90, opacity: 0.4,
              animation: `sp-foglayer ${18 + p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, ${cfg.vignette} 100%)`,
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-2 opacity-60"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${cfg.accent} 0, ${cfg.accent} 2px, transparent 2px, transparent 10px)`,
        }}
      />
    </div>
  );
}

/* ============================================================
   顶部导航栏
   ============================================================ */
function Header({ mode, setMode, demo, weatherData, weatherCity, onSync, syncing, setWeatherCity }: {
  mode: string; setMode: (m: string) => void; demo: boolean;
  weatherData: WeatherData | null; weatherCity: string; onSync: () => void; syncing: boolean; setWeatherCity: (c: string) => void;
}) {
  const [now, setNow] = useState(new Date());
  const [cityInput, setCityInput] = useState(weatherCity);
  const cfg = WEATHER_MODES[mode as keyof typeof WEATHER_MODES];
  const WeatherIcon = cfg.icon;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setCityInput(weatherCity); }, [weatherCity]);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-amber-900/20 bg-stone-900/85 backdrop-blur-md px-6 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-700/30">
          <Landmark className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-amber-100">
              智采罗盘
            </h1>
            <span className="text-[11px] tracking-widest text-amber-300/50">SmartProcureRadar</span>
            {demo && (
              <span className="rounded border border-amber-500/40 bg-amber-900/60 px-2 py-0.5 text-[10px] text-amber-300">
                <Database className="mr-1 inline h-3 w-3" />
                演示模式 · 数据存于本地浏览器
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400">企业IT采购比价与流程管理系统 · 决策辅助终端</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-stone-700 bg-stone-800/60 px-3 py-1.5 text-stone-300 md:flex">
          <Clock3 className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-mono text-xs">{now.toLocaleDateString("zh-CN")} {now.toLocaleTimeString("zh-CN")}</span>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-stone-700 bg-stone-800/60 px-2 py-1.5">
          <WeatherIcon className="h-4 w-4 text-amber-300" />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-transparent text-xs text-stone-200 outline-none"
            title="选择天气场景"
          >
            {Object.entries(WEATHER_MODES).map(([k, v]) => (
              <option key={k} value={k} className="text-black">{v.label}</option>
            ))}
          </select>
          {weatherData && (
            <span className="ml-1 font-mono text-[11px] text-stone-300">{weatherData.temp}°C</span>
          )}
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <input
            className="w-16 rounded border border-stone-700 bg-stone-800/60 px-1.5 py-1 text-center text-[11px] text-stone-300 outline-none"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setWeatherCity(cityInput); onSync(); } }}
            title="输入城市名，回车获取天气"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onSync}
            className="gap-1 border-amber-700/50 bg-stone-800/60 text-amber-200 hover:bg-stone-700 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {weatherData && (
          <div className="hidden items-center gap-2 text-[11px] text-stone-400 lg:flex">
            <span title="湿度">💧{weatherData.humidity}%</span>
            <span title="城市">{weatherData.city}</span>
            <span className="text-stone-600">·</span>
            <span title="更新时间">{new Date(weatherData.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}更新</span>
          </div>
        )}

      </div>
    </header>
  );
}

/* ============================================================
   侧边导航
   ============================================================ */
interface TabItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function SideNav({ tabs, tab, setTab }: { tabs: TabItem[]; tab: string; setTab: (t: string) => void }) {
  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-amber-900/20 bg-stone-900/80 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2 px-2 text-[11px] uppercase tracking-widest text-amber-400/70">
        <Landmark className="h-3.5 w-3.5" />
        采购作业台
      </div>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all ${
              active
                ? "bg-gradient-to-r from-amber-800/50 to-transparent text-amber-100 shadow-inner"
                : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
            }`}
            style={active ? { borderLeft: "3px solid #D4AF37" } : { borderLeft: "3px solid transparent" }}
          >
            <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-stone-500 group-hover:text-stone-300"}`} />
            {t.label}
          </button>
        );
      })}

      <div className="mt-auto space-y-2 border-t border-stone-800 pt-4">
        <div className="rounded-md border border-stone-800 bg-stone-800/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <Gauge className="h-3.5 w-3.5 text-amber-400" />
            系统状态
          </div>
          <div className="mt-1 text-[11px] text-emerald-400">● 数据链路正常</div>
        </div>
      </div>
    </nav>
  );
}

/* 统一的"档案卷轴"卡片外壳 */
function PanelCard({ title, icon: Icon, children, extra }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <Card className="border-amber-900/15 bg-stone-50/95 shadow-xl backdrop-blur-sm">
      <CardHeader className="border-b border-amber-900/10 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-serif text-base text-stone-800">
            {Icon && <Icon className="h-4 w-4 text-amber-700" />}
            {title}
          </CardTitle>
          {extra}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

/* ============================================================
   主组件
   ============================================================ */
export default function ProcurementToolkit() {
  const [tab, setTab] = useState("dashboard");
  const [weather, setWeather] = useState("sunny");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherCity, setWeatherCity] = useState(() => localStorage.getItem("procure_weather_city") || "北京");
  const [weatherSyncing, setWeatherSyncing] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(true);

  const syncRealWeather = useCallback(async (city?: string) => {
    setWeatherSyncing(true);
    setWeatherError("");
    const targetCity = city || weatherCity;
    let result: { data: WeatherData | null; error?: string } = { data: null };
    if (!city && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false })
        );
        const r = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        if (r.data) { result = r; } else { result = await fetchWeatherByCity(targetCity); }
      } catch (err) {
        setWeatherError(getLocationError(err as GeolocationPositionError));
        result = await fetchWeatherByCity(targetCity);
      }
    } else {
      result = await fetchWeatherByCity(targetCity);
    }
    if (result.data) {
      setWeatherData(result.data);
      setWeather(result.data.mode);
      setWeatherError("");
      localStorage.setItem("procure_weather_city", result.data.city);
      if (result.data.city !== weatherCity) setWeatherCity(result.data.city);
    } else {
      setWeatherError(result.error || "获取天气失败");
    }
    setWeatherSyncing(false);
  }, [weatherCity]);

  // 启动时自动获取一次真实天气
  useEffect(() => {
    syncRealWeather();
  }, []);

  // ---------- 供应商库 ----------
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState({ name: "", category: "", contact: "", tags: "" });

  // ---------- 比价评分模型 ----------
  const [weights, setWeights] = useState({ price: 40, delivery: 25, service: 20, quality: 15 });
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [newQuote, setNewQuote] = useState({ supplier: "", item: "", price: "", deliveryDays: "", service: "", quality: "" });

  // ---------- 云服务比价计算器 ----------
  const [cloudServices, setCloudServices] = useState<CloudService[]>([]);
  const [newCloud, setNewCloud] = useState({ vendor: "", spec: "2核4G", monthly: 0, note: "" });
  const [showCloudForm, setShowCloudForm] = useState(false);

  const handleAddCloud = async () => {
    if (!newCloud.vendor.trim()) return;
    await addCloudService({ vendor: newCloud.vendor.trim(), spec: newCloud.spec, monthly: newCloud.monthly, note: newCloud.note });
    setCloudServices(await getCloudServices());
    setNewCloud({ vendor: "", spec: "2核4G", monthly: 0, note: "" });
    setShowCloudForm(false);
  };

  const [selectedSpec, setSelectedSpec] = useState("2核4G");
  const [qty, setQty] = useState(1);

  // ---------- 采购流程看板 ----------
  const stages = [
    { name: "PR 需求申请", icon: FileText },
    { name: "RFQ 询价", icon: Send },
    { name: "比价分析", icon: BarChart3 },
    { name: "PO 下单", icon: ShoppingCart },
    { name: "验收付款", icon: CheckCircle2 },
  ];
  const [flowItems, setFlowItems] = useState<FlowItem[]>([]);
  const [newFlowItem, setNewFlowItem] = useState("");

  // ---------- PR 采购申请 ----------
  const APPROVAL_ROLES = ["申请人", "部门负责人", "IT负责人", "采购经理", "财务"];
  const [prItems, setPRItems] = useState<PRItem[]>([]);
  const [approvalRole, setApprovalRole] = useState(() => localStorage.getItem("procure_approval_role") || "部门负责人");
  const [showPRForm, setShowPRForm] = useState(false);
  const [newPR, setNewPR] = useState({ department: "", applicant: "", type: "IT硬件", spec: "", quantity: 1, budget: 0, reason: "" });
  const [expandedPR, setExpandedPR] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const saveApprovalRole = (role: string) => {
    setApprovalRole(role);
    localStorage.setItem("procure_approval_role", role);
  };

  const handleAddPR = async () => {
    if (!newPR.department.trim() || !newPR.spec.trim()) return;
    await addPRItem({
      prNumber: generatePRNumber(),
      department: newPR.department,
      applicant: newPR.applicant,
      type: newPR.type,
      spec: newPR.spec,
      quantity: newPR.quantity,
      budget: newPR.budget,
      reason: newPR.reason,
      status: 0,
      approvalStep: 0,
      approvalLog: [],
    });
    setPRItems(await getPRItems());
    setShowPRForm(false);
    setNewPR({ department: "", applicant: "", type: "IT硬件", spec: "", quantity: 1, budget: 0, reason: "" });
  };

  const submitPR = async (id: number) => {
    const item = prItems.find((p) => p.id === id);
    if (!item || item.status !== 0) return;
    const log: ApprovalLogEntry = { step: -1, operator: item.applicant || "申请人", action: "提交", comment: "", time: Date.now() };
    await updatePRItem(id, { status: 1, approvalStep: 0, approvalLog: [...item.approvalLog, log] });
    setPRItems(await getPRItems());
  };

  const approvePR = async (id: number) => {
    const item = prItems.find((p) => p.id === id);
    if (!item || item.status !== 1) return;
    const nextStep = item.approvalStep + 1;
    const log: ApprovalLogEntry = { step: item.approvalStep, operator: approvalRole, action: "通过", comment: "", time: Date.now() };
    if (nextStep >= APPROVAL_ROLES.length - 1) {
      await updatePRItem(id, { status: 2, approvalStep: nextStep, approvalLog: [...item.approvalLog, log] });
      await addFlowItem({ name: `${item.prNumber} ${item.spec}`, stage: 0 });
    } else {
      await updatePRItem(id, { approvalStep: nextStep, approvalLog: [...item.approvalLog, log] });
    }
    setPRItems(await getPRItems());
  };

  const rejectPR = async (id: number) => {
    if (!rejectComment.trim()) return;
    const item = prItems.find((p) => p.id === id);
    if (!item || item.status !== 1) return;
    const log: ApprovalLogEntry = { step: item.approvalStep, operator: approvalRole, action: "驳回", comment: rejectComment, time: Date.now() };
    await updatePRItem(id, { status: -1, approvalStep: 0, approvalLog: [...item.approvalLog, log] });
    setPRItems(await getPRItems());
    setRejectId(null);
    setRejectComment("");
  };

  const resubmitPR = async (id: number) => {
    const item = prItems.find((p) => p.id === id);
    if (!item || item.status !== -1) return;
    const log: ApprovalLogEntry = { step: 0, operator: item.applicant || "申请人", action: "重新提交", comment: "修改后重新提交", time: Date.now() };
    await updatePRItem(id, { status: 1, approvalStep: 0, approvalLog: [...item.approvalLog, log] });
    setPRItems(await getPRItems());
  };

  const removePR = async (id: number) => {
    await removePRItem(id);
    setPRItems(await getPRItems());
  };

  // 需要当前角色审批的 PR 数量
  const pendingApprovalCount = prItems.filter((p) => p.status === 1 && p.approvalStep === APPROVAL_ROLES.indexOf(approvalRole) - 1).length;

  // ---------- AI 采购助手 (Agent) ----------
  interface AIMessage { role: "user" | "assistant" | "system"; content: string; time: number; actions?: ToolCall[]; actionResults?: { id: string; status: "done" | "skipped" | "failed"; result?: string }[] }
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem("procure_ai_chat") ?? "[]"); } catch { return []; }
  });
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<ToolCall[]>([]);
  const [executedActions, setExecutedActions] = useState<{ id: string; status: "done" | "skipped" | "failed"; result?: string }[]>([]);
  const [agentMsgBuffer, setAgentMsgBuffer] = useState<{ role: "system" | "user" | "assistant" | "tool"; content?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string }[]>([]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editText, setEditText] = useState("");

  const persistAI = (msgs: AIMessage[]) => {
    const stripped = msgs.map(({ actions, actionResults, ...rest }) => rest) as AIMessage[];
    setAiMessages(msgs);
    localStorage.setItem("procure_ai_chat", JSON.stringify(stripped));
  };

  const reloadAllData = useCallback(async () => {
    const [s, q, f, p, c] = await Promise.all([getSuppliers(), getQuotes(), getFlowItems(), getPRItems(), getCloudServices()]);
    setSuppliers(s);
    setQuotes(q);
    setFlowItems(f);
    setPRItems(p);
    setCloudServices(c);
  }, []);

  // ---------- 初始化加载数据 ----------
  const loadAllData = useCallback(async () => {
    try {
      const [s, q, f, p, c] = await Promise.all([
        getSuppliers(),
        getQuotes(),
        getFlowItems(),
        getPRItems(),
        getCloudServices(),
      ]);
      setSuppliers(s);
      setQuotes(q);
      setFlowItems(f);
      setPRItems(p);
      setCloudServices(c);
      setDemo(getIsDemo());
    } catch (err) {
      console.error("数据加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ---------- 供应商操作 ----------
  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    await addSupplier({
      name: newSupplier.name,
      category: newSupplier.category || "未分类",
      contact: newSupplier.contact,
      tags: newSupplier.tags ? newSupplier.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
    });
    setSuppliers(await getSuppliers());
    setNewSupplier({ name: "", category: "", contact: "", tags: "" });
  };

  const handleRemoveSupplier = async (id: number) => {
    await removeSupplier(id);
    setSuppliers(await getSuppliers());
  };

  // ---------- 报价操作 ----------
  const handleAddQuote = async () => {
    if (!newQuote.supplier.trim() || !newQuote.item.trim() || !newQuote.price) return;
    await addQuote({
      supplier: newQuote.supplier,
      item: newQuote.item,
      price: Number(newQuote.price) || 0,
      deliveryDays: Number(newQuote.deliveryDays) || 0,
      service: Number(newQuote.service) || 0,
      quality: Number(newQuote.quality) || 0,
    });
    setQuotes(await getQuotes());
    setNewQuote({ supplier: "", item: "", price: "", deliveryDays: "", service: "", quality: "" });
  };

  const handleRemoveQuote = async (id: number) => {
    await removeQuote(id);
    setQuotes(await getQuotes());
  };

  // ---------- 流程操作 ----------
  const handleAddFlowItem = async () => {
    if (!newFlowItem.trim()) return;
    await addFlowItem({ name: newFlowItem, stage: 0 });
    setFlowItems(await getFlowItems());
    setNewFlowItem("");
  };

  const handleAdvanceStage = async (id: number, currentStage: number) => {
    if (currentStage >= stages.length - 1) return;
    await updateFlowItemStage(id, currentStage + 1);
    setFlowItems(await getFlowItems());
  };

  const handleResetStage = async (id: number) => {
    await updateFlowItemStage(id, 0);
    setFlowItems(await getFlowItems());
  };

  const handleRemoveFlowItem = async (id: number) => {
    await removeFlowItem(id);
    setFlowItems(await getFlowItems());
  };

  // ---------- AI Agent 核心逻辑 ----------
  const startAgent = async (userText: string) => {
    if (!userText.trim() || aiLoading) return;
    const userMsg: AIMessage = { role: "user", content: userText, time: Date.now() };
    const updated = [...aiMessages, userMsg];
    persistAI(updated);
    setAiInput("");
    setAiLoading(true);

    const historyMessages = aiMessages
      .filter((m) => m.role !== "system")
      .slice(-20)
      .flatMap((m) => {
        const msg: { role: "user" | "assistant"; content: string } = { role: m.role as "user" | "assistant", content: m.content || "" };
        return [msg];
      });

    const msgs: { role: "system" | "user" | "assistant" | "tool"; content?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string }[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: userText },
    ];

    setAgentMsgBuffer(msgs);

    try {
      const resp = await runAgentStep(msgs);
      if (resp.toolCalls.length > 0) {
        // 有待确认操作 → 暂停，展示操作卡片
        setPendingActions(resp.toolCalls);
        setExecutedActions([]);
        const planMsg: AIMessage = {
          role: "assistant",
          content: resp.content || `AI 计划执行 ${resp.toolCalls.length} 项操作：`,
          time: Date.now(),
          actions: resp.toolCalls,
        };
        persistAI([...updated, planMsg]);
        setAgentMsgBuffer([...msgs, { role: "assistant", content: resp.content || "", tool_calls: resp.toolCalls.map((tc) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: JSON.stringify(tc.args) } })) }]);
      } else {
        // 纯文本回复
        const aiMsg: AIMessage = { role: "assistant", content: resp.content || "(空)", time: Date.now() };
        persistAI([...updated, aiMsg]);
      }
    } catch {
      const errMsg: AIMessage = { role: "assistant", content: "请求失败，请检查网络或 API Key 配置。", time: Date.now() };
      persistAI([...updated, errMsg]);
      setAiLoading(false);
    }
  };

  const handleAskAI = () => startAgent(aiInput);

  const confirmAction = async (tc: ToolCall) => {
    const result = await executeTool(tc.name, tc.args);
    setExecutedActions((prev) => [...prev, { id: tc.id, status: result.startsWith("执行失败") ? "failed" : "done", result }]);
    return result;
  };

  const confirmAllActions = async () => {
    setAiLoading(true);
    const results: { id: string; status: "done" | "skipped" | "failed"; result?: string }[] = [];
    for (const tc of pendingActions) {
      const result = await executeTool(tc.name, tc.args);
      results.push({ id: tc.id, status: result.startsWith("执行失败") ? "failed" : "done", result });
      setExecutedActions([...results]);
    }

    // 回传结果给 AI
    const toolResults = pendingActions.map((tc, i) => ({
      role: "tool" as const,
      tool_call_id: tc.id,
      content: results[i]?.result ?? "已跳过",
    }));

    const msgs = [...agentMsgBuffer, ...toolResults];
    setAgentMsgBuffer(msgs);

    try {
      const resp = await runAgentStep(msgs);
      // 更新对话历史中的操作卡片状态
      const finalMsg: AIMessage = {
        role: "assistant",
        content: resp.content || "操作已完成。",
        time: Date.now(),
        actionResults: results,
      };
      setAiMessages((prev) => [...prev, finalMsg]);
      persistAI([...aiMessages, finalMsg]);
      setPendingActions([]);
      setExecutedActions([]);
    } catch {
      const errMsg: AIMessage = { role: "assistant", content: "操作执行完毕，但 AI 后续响应失败。", time: Date.now() };
      persistAI([...aiMessages, errMsg]);
      setPendingActions([]);
      setExecutedActions([]);
    } finally {
      setAiLoading(false);
      await reloadAllData();
    }
  };

  const skipAction = (id: string) => {
    setExecutedActions((prev) => [...prev, { id, status: "skipped" }]);
  };

  // ---------- 消息级别操作 ----------
  const deleteMessage = (index: number) => {
    const updated = aiMessages.filter((_, i) => i !== index);
    persistAI(updated);
  };

  const regenerateResponse = (index: number) => {
    // 找到该 AI 回复之前的用户消息
    let userIndex = index - 1;
    while (userIndex >= 0 && aiMessages[userIndex].role !== "user") userIndex--;
    if (userIndex < 0) return;
    const truncated = aiMessages.slice(0, index);
    persistAI(truncated);
    setAiInput(aiMessages[userIndex].content);
    setTimeout(() => startAgent(aiMessages[userIndex].content), 50);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(aiMessages[index].content);
  };

  const saveEdit = (index: number) => {
    if (!editText.trim()) return;
    const updated = [...aiMessages];
    updated[index] = { ...updated[index], content: editText };
    // 删除这条用户消息之后的所有回复
    const truncated = updated.slice(0, index + 1);
    persistAI(truncated);
    setEditingIndex(-1);
    setEditText("");
    setTimeout(() => startAgent(editText), 50);
  };

  const cancelEdit = () => {
    setEditingIndex(-1);
    setEditText("");
  };
  useEffect(() => {
    if (pendingActions.length > 0 && executedActions.length >= pendingActions.length) {
      const results = executedActions.filter((e) => e.status !== undefined);
      const finalMsg: AIMessage = {
        role: "assistant",
        content: results.length > 0 ? `${results.filter((r) => r.status === "done").length}/${results.length} 项已完成。` : "操作已跳过。",
        time: Date.now(),
        actionResults: results,
      };
      setAiMessages((prev) => [...prev, finalMsg]);
      persistAI([...aiMessages, finalMsg]);
      setPendingActions([]);
      setExecutedActions([]);
      setAiLoading(false);
      reloadAllData();
    }
  }, [executedActions, pendingActions]);

  // 自动恢复被 pending actions 阻塞的 loading 状态
  useEffect(() => {
    if (pendingActions.length > 0 && aiLoading) setAiLoading(false);
  }, [pendingActions]);

  // ---------- 评分计算 ----------
  const getScored = () => {
    if (quotes.length === 0) return [];
    const prices = quotes.map((q) => q.price);
    const deliveries = quotes.map((q) => q.deliveryDays);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const maxDelivery = Math.max(...deliveries);
    const minDelivery = Math.min(...deliveries);
    const weightSum = weights.price + weights.delivery + weights.service + weights.quality || 1;

    return quotes
      .map((q) => {
        const priceScore = maxPrice === minPrice ? 10 : ((maxPrice - q.price) / (maxPrice - minPrice)) * 10;
        const deliveryScore = maxDelivery === minDelivery ? 10 : ((maxDelivery - q.deliveryDays) / (maxDelivery - minDelivery)) * 10;
        const total =
          (priceScore * weights.price + deliveryScore * weights.delivery + q.service * weights.service + q.quality * weights.quality) /
          weightSum;
        return { ...q, priceScore, deliveryScore, total };
      })
      .sort((a, b) => b.total - a.total);
  };
  const scored = getScored();
  const chartData = scored.map((q, i) => ({ name: q.supplier.length > 6 ? q.supplier.slice(0, 6) + "…" : q.supplier, 综合评分: Number(q.total.toFixed(1)), rank: i }));

  // ---------- 云服务计算 ----------
  const cloudFiltered = cloudServices.filter((p) => p.spec === selectedSpec);
  const cloudChartData = cloudFiltered.map((p) => ({ name: p.vendor, 月度总价: p.monthly * qty }));

  // ---------- Excel 导出 ----------
  const handleExportSuppliers = () => {
    exportToExcel(
      suppliers.map((s) => ({ 名称: s.name, 品类: s.category, 联系人: s.contact, 标签: s.tags.join("、") })),
      "供应商档案"
    );
  };

  const handleExportQuotes = () => {
    exportToExcel(
      scored.map((q, i) => ({
        名次: (RANK_GLYPH[i] ?? i + 1),
        供应商: q.supplier,
        项目: q.item,
        报价: q.price,
        交付天数: q.deliveryDays,
        服务评分: q.service,
        质量评分: q.quality,
        综合评分: Number(q.total.toFixed(1)),
      })),
      "比价分析报告"
    );
  };

  const handleExportCloud = () => {
    exportToExcel(
      cloudFiltered.map((p) => ({ 供应商: p.vendor, 规格: p.spec, 单台月费: p.monthly, 数量: qty, 月度总价: p.monthly * qty, 备注: p.note })),
      "云服务对比"
    );
  };

  const handleExportPR = () => {
    exportToExcel(
      prItems.map((p) => ({
        PR编号: p.prNumber, 部门: p.department, 申请人: p.applicant, 类型: p.type, 规格: p.spec, 数量: p.quantity, 预算: p.budget,
        状态: p.status === 0 ? "草稿" : p.status === 1 ? "待审批" : p.status === 2 ? "已通过" : "已驳回",
      })),
      "PR采购申请"
    );
  };

  const handleExportFlow = () => {
    exportToExcel(
      flowItems.map((f) => ({ 事项: f.name, 当前阶段: stages[f.stage]?.name ?? f.stage.toString() })),
      "采购流程看板"
    );
  };

  const tabs = [
    { key: "dashboard", label: "采购驾驶舱", icon: LayoutDashboard },
    { key: "pr", label: "PR 采购申请", icon: FileText },
    { key: "suppliers", label: "供应商库", icon: Star },
    { key: "quotes", label: "询价比价", icon: ClipboardList },
    { key: "cloud", label: "云服务比价", icon: Cloud },
    { key: "flow", label: "流程看板", icon: Server },
    { key: "ai", label: "AI采购助手", icon: Bot },
  ];

  const cfg = WEATHER_MODES[weather as keyof typeof WEATHER_MODES];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-900">
        <div className="text-center">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
          <p className="text-sm text-stone-400">正在加载系统数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full font-serif" style={{ fontFamily: "'Noto Serif SC', ui-serif, 'Songti SC', serif" }}>
      <WeatherBackground mode={weather} />

      <WeatherWidget wd={weatherData} error={weatherError} syncing={weatherSyncing} onSync={() => syncRealWeather()} onSetMode={setWeather} />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header mode={weather} setMode={setWeather} demo={demo} weatherData={weatherData} weatherCity={weatherCity} onSync={() => syncRealWeather()} syncing={weatherSyncing} setWeatherCity={setWeatherCity} />

        <div className="flex flex-1">
          <SideNav tabs={tabs} tab={tab} setTab={setTab} />

          <main className="flex-1 space-y-4 overflow-y-auto p-6">
            <div
              className="flex items-center justify-between rounded-md border px-4 py-2 text-xs backdrop-blur-sm"
              style={{ borderColor: `${cfg.accent}55`, background: "rgba(28,25,20,0.35)", color: cfg.ink }}
            >
              <div className="flex items-center gap-2">
                <cfg.icon className="h-3.5 w-3.5" />
                <span>当前环境场景：{cfg.label}{weatherData ? ` · ${weatherData.city} ${weatherData.temp}°C` : ""}　·　{demo ? "演示模式 · 数据存于本地浏览器" : "已连接数据库"}</span>
              </div>
              <ScrollText className="h-3.5 w-3.5 opacity-70" />
            </div>

            {/* ---------------- 采购驾驶舱 ---------------- */}
            {tab === "dashboard" && (
              <div className="space-y-4">
                {/* KPI 指标卡片 */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: "采购需求", value: prItems.length, unit: "项", icon: FileText, color: "from-blue-600 to-blue-800", bg: "bg-blue-50", text: "text-blue-700", subtitle: prItems.filter(p => p.status === 1).length > 0 ? `${prItems.filter(p => p.status === 1).length} 项待审批` : "" },
                    { label: "询价任务", value: quotes.length, unit: "条", icon: Send, color: "from-amber-600 to-amber-800", bg: "bg-amber-50", text: "text-amber-700" },
                    { label: "供应商", value: suppliers.length, unit: "家", icon: Users, color: "from-emerald-600 to-emerald-800", bg: "bg-emerald-50", text: "text-emerald-700" },
                    { label: "年度采购额", value: quotes.reduce((sum, q) => sum + q.price, 0), unit: "元", icon: Banknote, color: "from-violet-600 to-violet-800", bg: "bg-violet-50", text: "text-violet-700", isMoney: true },
                  ].map((kpi) => (
                    <Card key={kpi.label} className="border-0 bg-white/90 shadow-lg backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className={`rounded-lg ${kpi.bg} p-2`}>
                            <kpi.icon className={`h-5 w-5 ${kpi.text}`} />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-stone-300" />
                        </div>
                        <div className="mt-3">
                          <div className="text-2xl font-bold tracking-tight text-stone-800">
                            {kpi.isMoney ? `¥${kpi.value.toLocaleString()}` : kpi.value}
                          </div>
                          <div className="mt-0.5 text-xs text-stone-400">{kpi.label}<span className="ml-1 text-stone-300">{kpi.unit}</span></div>
                          {(kpi as { subtitle?: string }).subtitle && <div className="mt-0.5 text-[10px] text-amber-600 font-medium">{(kpi as { subtitle?: string }).subtitle}</div>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* 中间行：流程状态 + 供应商分布 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* 流程流水线概览 */}
                  <Card className="border-0 bg-white/90 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 font-serif text-sm text-stone-700">
                        <Gauge className="h-4 w-4 text-amber-600" />
                        流程进度概览
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(() => {
                          const prStages = [
                            { name: "草稿", count: prItems.filter(p => p.status === 0).length },
                            { name: "待审批", count: prItems.filter(p => p.status === 1).length },
                            { name: "已通过", count: prItems.filter(p => p.status === 2).length },
                            { name: "已驳回", count: prItems.filter(p => p.status === -1).length },
                          ];
                          const total = prItems.length || 1;
                          return prStages.map((s, i) => {
                            const pct = Math.round((s.count / total) * 100);
                            return (
                              <div key={s.name} className="flex items-center gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs text-stone-500">
                                  {i + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-600">{s.name}</span>
                                    <span className="font-mono text-stone-400">{s.count} 项</span>
                                  </div>
                                  <div className="mt-1 h-1.5 w-full rounded-full bg-stone-100">
                                    <div
                                      className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-700 transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                            </div>
                          );
                        })}
                        )()}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 供应商品类饼图 */}
                  <Card className="border-0 bg-white/90 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 font-serif text-sm text-stone-700">
                        <Package className="h-4 w-4 text-amber-600" />
                        供应商品类分布
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {suppliers.length > 0 ? (
                        <div className="flex items-center gap-4">
                          <div className="h-36 w-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={(() => {
                                    const cats = suppliers.reduce<Record<string, number>>((acc, s) => {
                                      acc[s.category] = (acc[s.category] ?? 0) + 1;
                                      return acc;
                                    }, {});
                                    return Object.entries(cats).map(([name, value]) => ({ name, value }));
                                  })()}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={50}
                                  innerRadius={25}
                                  paddingAngle={3}
                                >
                                  {suppliers.map((_, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={["#B8860B", "#A8A29E", "#78716C", "#D4AF37", "#8B7355"][idx % 5]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 11 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {(() => {
                              const cats = suppliers.reduce<Record<string, number>>((acc, s) => {
                                acc[s.category] = (acc[s.category] ?? 0) + 1;
                                return acc;
                              }, {});
                              return Object.entries(cats).map(([name, count], i) => (
                                <div key={name} className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#B8860B", "#A8A29E", "#78716C", "#D4AF37", "#8B7355"][i % 5] }} />
                                  <span className="text-stone-600">{name}</span>
                                  <span className="font-mono text-stone-400">{count}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-stone-400">暂无供应商数据</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 底部：最近报价 + 快速入口 */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* 最近比价 Top 3 */}
                  <Card className="border-0 bg-white/90 shadow-lg lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 font-serif text-sm text-stone-700">
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                        最佳供应商排名
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {scored.length > 0 ? (
                        <div className="space-y-2">
                          {scored.slice(0, 3).map((q, i) => (
                            <div key={q.id} className="flex items-center justify-between rounded-lg bg-stone-50 p-3">
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-700 text-amber-50" : "bg-stone-200 text-stone-500"}`}>
                                  {RANK_GLYPH[i]}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-stone-700">{q.supplier}</div>
                                  <div className="text-xs text-stone-400">{q.item}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-sm font-bold text-amber-700">{q.total.toFixed(1)} <span className="text-xs font-normal text-stone-400">/10</span></div>
                                <div className="text-xs text-stone-400">¥{q.price.toLocaleString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-stone-400">暂无报价数据，去"询价比价"录入</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 快捷操作 */}
                  <Card className="border-0 bg-white/90 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 font-serif text-sm text-stone-700">
                        <Clock className="h-4 w-4 text-amber-600" />
                        快捷操作
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { label: "添加供应商", tab: "suppliers", icon: Plus },
                        { label: "录入报价", tab: "quotes", icon: ClipboardList },
                        { label: "新增采购事项", tab: "flow", icon: FileText },
                        { label: "咨询 AI 助手", tab: "ai", icon: Bot },
                      ].map((action) => (
                        <Button
                          key={action.tab}
                          variant="ghost"
                          className="w-full justify-start gap-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-800"
                          onClick={() => setTab(action.tab)}
                        >
                          <action.icon className="h-4 w-4 text-amber-600" />
                          {action.label}
                          <ArrowRight className="ml-auto h-3 w-3 text-stone-300" />
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ---------------- PR 采购申请 ---------------- */}
            {tab === "pr" && (
              <div className="space-y-4">
                {/* 角色选择 + 操作栏 */}
                <div className="flex items-center gap-3 rounded-lg border border-amber-900/10 bg-white/80 p-3 shadow-sm">
                  <UserCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-stone-500">当前审批身份：</span>
                  <select
                    value={approvalRole}
                    onChange={(e) => saveApprovalRole(e.target.value)}
                    className="rounded border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 outline-none"
                  >
                    {APPROVAL_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {pendingApprovalCount > 0 && (
                    <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">{pendingApprovalCount} 条待审批</span>
                  )}
                  <div className="ml-auto">
                    <div className="flex gap-2">
                      {prItems.length > 0 && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportPR}>
                          <Download className="h-3 w-3" /> 导出Excel
                        </Button>
                      )}
                      <Button size="sm" className="gap-1 bg-stone-800 text-amber-100 hover:bg-stone-700 text-xs" onClick={() => { setShowPRForm(true); }}>
                        <Plus className="h-3.5 w-3.5" /> 新建PR申请
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 新建PR表单 */}
                {showPRForm && (
                  <PanelCard title="新建采购申请" icon={FileText} extra={<Button size="sm" variant="ghost" className="text-xs text-stone-400" onClick={() => setShowPRForm(false)}>取消</Button>}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-500">申请部门 *</label>
                        <Input placeholder="如 IT部" value={newPR.department} onChange={(e) => setNewPR({ ...newPR, department: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-500">申请人</label>
                        <Input placeholder="姓名" value={newPR.applicant} onChange={(e) => setNewPR({ ...newPR, applicant: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-500">采购类型</label>
                        <select
                          value={newPR.type}
                          onChange={(e) => setNewPR({ ...newPR, type: e.target.value })}
                          className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                        >
                          {["IT硬件", "软件授权", "云服务", "网络设备", "其他"].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] text-stone-500">产品规格 *</label>
                        <Input placeholder="具体型号、配置" value={newPR.spec} onChange={(e) => setNewPR({ ...newPR, spec: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-500">数量</label>
                        <Input type="number" value={newPR.quantity} onChange={(e) => setNewPR({ ...newPR, quantity: Number(e.target.value) || 1 })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-stone-500">预算(元)</label>
                        <Input type="number" value={newPR.budget} onChange={(e) => setNewPR({ ...newPR, budget: Number(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] text-stone-500">采购原因</label>
                        <Input placeholder="简述采购原因" value={newPR.reason} onChange={(e) => setNewPR({ ...newPR, reason: e.target.value })} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button onClick={handleAddPR} className="gap-1 bg-stone-800 text-amber-100 hover:bg-stone-700">
                        <Plus className="h-4 w-4" /> 创建PR
                      </Button>
                    </div>
                  </PanelCard>
                )}

                {/* PR 列表 */}
                {prItems.length === 0 ? (
                  <PanelCard title="采购申请列表" icon={ClipboardList}>
                    <p className="py-8 text-center text-sm text-stone-400">暂无采购申请，点击"新建PR申请"创建第一个</p>
                  </PanelCard>
                ) : (
                  <div className="space-y-2">
                    {prItems.map((pr) => {
                      const statusLabel = pr.status === 0 ? "草稿" : pr.status === 1 ? "待审批" : pr.status === 2 ? "已通过" : "已驳回";
                      const statusColor = pr.status === 0 ? "bg-stone-100 text-stone-600" : pr.status === 1 ? "bg-amber-100 text-amber-700" : pr.status === 2 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600";
                      const canApprove = pr.status === 1 && pr.approvalStep === APPROVAL_ROLES.indexOf(approvalRole) - 1;
                      const isExpanded = expandedPR === pr.id;

                      return (
                        <div key={pr.id} className="rounded-lg border border-amber-900/10 bg-white shadow-sm">
                          {/* 主行 */}
                          <div className="flex cursor-pointer items-center justify-between px-4 py-3" onClick={() => setExpandedPR(isExpanded ? null : pr.id)}>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[10px] ${isExpanded ? "rotate-90" : ""} transition-transform`}>
                                <ChevronDown className="h-4 w-4 text-stone-400" />
                              </span>
                              <span className="font-mono text-xs text-stone-500">{pr.prNumber}</span>
                              <span className="font-medium text-stone-700">{pr.spec.length > 30 ? pr.spec.slice(0, 30) + "…" : pr.spec}</span>
                              <span className="text-xs text-stone-400">×{pr.quantity}</span>
                              <span className="font-mono text-xs text-amber-700">¥{pr.budget.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
                              {canApprove && (
                                <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] text-white animate-pulse">待我审批</span>
                              )}
                              {pr.status === 0 && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-amber-700" onClick={(e) => { e.stopPropagation(); submitPR(pr.id); }}>提交</Button>
                              )}
                              {pr.status === -1 && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs text-amber-700" onClick={(e) => { e.stopPropagation(); resubmitPR(pr.id); }}>重新提交</Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={(e) => { e.stopPropagation(); removePR(pr.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="border-t border-stone-100 px-4 py-3">
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-4">
                                <div><span className="text-stone-400">部门：</span>{pr.department}</div>
                                <div><span className="text-stone-400">申请人：</span>{pr.applicant || "—"}</div>
                                <div><span className="text-stone-400">类型：</span>{pr.type}</div>
                                <div><span className="text-stone-400">预算：</span>¥{pr.budget.toLocaleString()}</div>
                                <div className="md:col-span-2"><span className="text-stone-400">规格：</span>{pr.spec}</div>
                                <div className="md:col-span-2"><span className="text-stone-400">原因：</span>{pr.reason || "—"}</div>
                              </div>

                              {/* 审批链 */}
                              <div className="mt-3 border-t border-stone-100 pt-3">
                                <div className="mb-2 text-[11px] font-medium text-stone-500">审批进度</div>
                                <div className="flex items-center gap-1">
                                  {APPROVAL_ROLES.slice(1).map((role, i) => {
                                    const log = pr.approvalLog.find((l) => l.step === i && l.action !== "提交" && l.action !== "重新提交");
                                    const isCurrent = pr.status === 1 && pr.approvalStep === i;
                                    const isApproved = log?.action === "通过";
                                    const isRejected = log?.action === "驳回";
                                    return (
                                      <div key={role} className={`flex flex-1 flex-col items-center text-center ${i > 0 ? "" : ""}`}>
                                        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                                          isApproved ? "bg-emerald-100 text-emerald-700" :
                                          isRejected ? "bg-red-100 text-red-500" :
                                          isCurrent ? "bg-amber-100 text-amber-700 ring-2 ring-amber-400" :
                                          "bg-stone-100 text-stone-400"
                                        }`}>
                                          {isApproved ? <Check className="h-3.5 w-3.5" /> : isRejected ? <XIcon className="h-3.5 w-3.5" /> : i + 1}
                                        </div>
                                        <div className="mt-1 text-[9px] text-stone-400">{role}</div>
                                        {log && <div className="mt-0.5 text-[9px] text-stone-500">{log.operator}</div>}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* 审批日志 */}
                                {pr.approvalLog.length > 0 && (
                                  <div className="mt-3 space-y-1 border-t border-stone-50 pt-2">
                                    {pr.approvalLog.map((log, i) => (
                                      <div key={i} className="flex items-center gap-2 text-[10px] text-stone-400">
                                        <span className="font-mono">{new Date(log.time).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                        <span>{log.operator}</span>
                                        <span className={`font-medium ${log.action === "通过" ? "text-emerald-600" : log.action === "驳回" ? "text-red-500" : "text-stone-600"}`}>{log.action}</span>
                                        {log.comment && <span className="text-stone-400">— {log.comment}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* 审批/驳回操作 */}
                                {canApprove && (
                                  <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
                                    {rejectId === pr.id ? (
                                      <>
                                        <Input
                                          placeholder="驳回原因..."
                                          value={rejectComment}
                                          onChange={(e) => setRejectComment(e.target.value)}
                                          className="h-8 flex-1 text-xs"
                                          autoFocus
                                        />
                                        <Button size="sm" className="h-8 bg-red-600 text-xs text-white" onClick={() => rejectPR(pr.id)}>确认驳回</Button>
                                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setRejectId(null); setRejectComment(""); }}>取消</Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button size="sm" className="h-8 bg-emerald-600 text-xs text-white" onClick={() => approvePR(pr.id)}>
                                          <Check className="mr-1 h-3 w-3" /> 通过
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400" onClick={() => setRejectId(pr.id)}>
                                          <XIcon className="mr-1 h-3 w-3" /> 驳回
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------------- 供应商库 ---------------- */}
            {tab === "suppliers" && (
              <PanelCard
                title="供应商信息库 · 档案总录"
                icon={Building2}
                extra={
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportSuppliers}>
                    <Download className="h-3 w-3" /> 导出Excel
                  </Button>
                }
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                    <Input placeholder="供应商名称" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                    <Input placeholder="品类（如云服务/硬件）" value={newSupplier.category} onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })} />
                    <Input placeholder="联系人/电话" value={newSupplier.contact} onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })} />
                    <Input placeholder="标签（逗号分隔）" value={newSupplier.tags} onChange={(e) => setNewSupplier({ ...newSupplier, tags: e.target.value })} />
                    <Button onClick={handleAddSupplier} className="gap-1 bg-stone-800 text-amber-100 hover:bg-stone-700">
                      <Plus className="h-4 w-4" /> 添加
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {suppliers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-amber-900/15 bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-700/40 bg-amber-50 text-xs font-semibold text-amber-800">
                            {s.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-stone-800">{s.name}</div>
                            <div className="text-sm text-stone-500">{s.category} · {s.contact}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {s.tags.map((tagName, i) => (
                                <span key={i} className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-700/20">
                                  {tagName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveSupplier(s.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                    {suppliers.length === 0 && <p className="text-sm text-stone-400">暂无供应商，请先添加</p>}
                  </div>
                </div>
              </PanelCard>
            )}

            {/* ---------------- 询价比价 ---------------- */}
            {tab === "quotes" && (
              <div className="space-y-4">
                <PanelCard title="评分权重仪表 · 四维加权" icon={Gauge}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {[
                      { key: "price", label: "价格权重" },
                      { key: "delivery", label: "交付周期权重" },
                      { key: "service", label: "服务能力权重" },
                      { key: "quality", label: "质量权重" },
                    ].map((w) => (
                      <div key={w.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-stone-500">
                          <span>{w.label}</span>
                          <span className="font-mono font-semibold text-amber-700">{weights[w.key as keyof typeof weights]}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={weights[w.key as keyof typeof weights]}
                          onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                          className="w-full accent-amber-700"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-stone-400">* 权重总和不必为100，系统自动归一化计算综合评分</p>
                </PanelCard>

                <PanelCard
                  title="报价录入 · 比价台账"
                  icon={ClipboardList}
                  extra={
                    scored.length > 0 && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportQuotes}>
                        <Download className="h-3 w-3" /> 导出Excel
                      </Button>
                    )
                  }
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      <Input placeholder="供应商" value={newQuote.supplier} onChange={(e) => setNewQuote({ ...newQuote, supplier: e.target.value })} />
                      <Input placeholder="采购项目" value={newQuote.item} onChange={(e) => setNewQuote({ ...newQuote, item: e.target.value })} />
                      <Input placeholder="报价(元)" type="number" value={newQuote.price} onChange={(e) => setNewQuote({ ...newQuote, price: e.target.value })} />
                      <Input placeholder="交付天数" type="number" value={newQuote.deliveryDays} onChange={(e) => setNewQuote({ ...newQuote, deliveryDays: e.target.value })} />
                      <Input placeholder="服务评分(0-10)" type="number" value={newQuote.service} onChange={(e) => setNewQuote({ ...newQuote, service: e.target.value })} />
                      <Input placeholder="质量评分(0-10)" type="number" value={newQuote.quality} onChange={(e) => setNewQuote({ ...newQuote, quality: e.target.value })} />
                    </div>
                    <Button onClick={handleAddQuote} className="gap-1 bg-stone-800 text-amber-100 hover:bg-stone-700">
                      <Plus className="h-4 w-4" /> 添加报价
                    </Button>

                    <div className="overflow-x-auto rounded-md border border-amber-900/10">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-amber-900/10 bg-stone-100 text-left text-stone-500">
                            <th className="py-2 pl-3">名次</th>
                            <th>供应商</th>
                            <th>项目</th>
                            <th className="font-mono">报价</th>
                            <th>交付</th>
                            <th>服务</th>
                            <th>质量</th>
                            <th className="font-mono">综合评分</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {scored.map((q, i) => (
                            <tr key={q.id} className={i === 0 ? "border-b border-amber-900/10 bg-amber-50" : "border-b border-amber-900/10 bg-white"}>
                              <td className="py-2 pl-3">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-serif text-xs font-bold ${i === 0 ? "bg-amber-700 text-amber-50" : "bg-stone-200 text-stone-600"}`}>
                                  {RANK_GLYPH[i] ?? i + 1}
                                </span>
                              </td>
                              <td className="text-stone-700">{q.supplier}</td>
                              <td className="text-stone-600">{q.item}</td>
                              <td className="font-mono text-stone-800">¥{q.price.toLocaleString()}</td>
                              <td className="font-mono text-stone-600">{q.deliveryDays}天</td>
                              <td className="font-mono text-stone-600">{q.service}</td>
                              <td className="font-mono text-stone-600">{q.quality}</td>
                              <td className="font-mono font-semibold text-amber-700">{q.total.toFixed(1)}</td>
                              <td>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveQuote(q.id)}>
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {scored.length === 0 && (
                            <tr>
                              <td colSpan={9} className="py-4 text-center text-stone-400">暂无报价数据</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </PanelCard>

                {chartData.length > 0 && (
                  <PanelCard title="综合评分可视化对比" icon={BarChart3}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d0" horizontal={false} />
                          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: "#78716c" }} />
                          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#57534e" }} />
                          <Tooltip formatter={(v) => v} contentStyle={{ fontSize: 12 }} />
                          <Bar dataKey="综合评分" radius={[0, 4, 4, 0]}>
                            {chartData.map((_entry, idx) => (
                              <Cell key={idx} fill={idx === 0 ? "#B8860B" : "#A8A29E"} />
                            ))}
                            <LabelList dataKey="综合评分" position="right" style={{ fontSize: 11, fill: "#57534e" }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </PanelCard>
                )}
              </div>
            )}

            {/* ---------------- 云服务比价 ---------------- */}
            {tab === "cloud" && (
              <PanelCard
                title="云服务方案比价计算器（示例数据，仅供学习演示）"
                icon={Cloud}
                extra={
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportCloud}>
                    <Download className="h-3 w-3" /> 导出Excel
                  </Button>
                }
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <label className="mb-1 block text-xs text-stone-500">规格筛选</label>
                      <div className="flex gap-2">
                        {["2核4G", "4核8G"].map((s) => (
                          <Button
                            key={s}
                            variant={selectedSpec === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedSpec(s)}
                            className={selectedSpec === s ? "bg-stone-800 text-amber-100" : ""}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-stone-500">采购数量（台）</label>
                      <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="w-24" />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {cloudFiltered.map((p, i) => (
                      <div key={i} className="rounded-lg border border-amber-900/15 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-800 text-[10px] font-bold text-amber-200">
                            {p.vendor.slice(0, 1)}
                          </div>
                          <div className="font-medium text-stone-800">{p.vendor}</div>
                        </div>
                        <div className="mb-2 mt-1 text-sm text-stone-500">{p.spec}</div>
                        <div className="font-mono text-xl font-bold text-amber-700">¥{(p.monthly * qty).toLocaleString()}/月</div>
                        <div className="mt-1 text-xs text-stone-400">单台 ¥{p.monthly}/月 · {p.note}</div>
                      </div>
                    ))}
                  </div>

                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cloudChartData} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => `¥${(v as number).toLocaleString()}`} />
                        <Bar dataKey="月度总价" radius={[4, 4, 0, 0]}>
                          {cloudChartData.map((_, idx) => (
                            <Cell key={idx} fill={idx === 0 ? "#B8860B" : "#A8A29E"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="text-xs text-stone-400">* 价格为教学演示用估算值，非实时官方报价；实际采购需以官网询价/合同为准。</p>

                  {/* 新增云方案 */}
                  {showCloudForm ? (
                    <div className="rounded-lg border border-amber-900/15 bg-stone-50 p-4">
                      <div className="mb-2 text-xs font-medium text-stone-600">新增云服务方案</div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                        <Input placeholder="供应商/产品" value={newCloud.vendor} onChange={(e) => setNewCloud({ ...newCloud, vendor: e.target.value })} />
                        <select value={newCloud.spec} onChange={(e) => setNewCloud({ ...newCloud, spec: e.target.value })} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none">
                          {["2核4G", "4核8G", "8核16G", "16核32G", "其他"].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <Input placeholder="月费(元)" type="number" value={newCloud.monthly || ""} onChange={(e) => setNewCloud({ ...newCloud, monthly: Number(e.target.value) })} />
                        <Input placeholder="备注" value={newCloud.note} onChange={(e) => setNewCloud({ ...newCloud, note: e.target.value })} />
                        <div className="flex gap-1">
                          <Button size="sm" className="bg-stone-800 text-amber-100 text-xs" onClick={handleAddCloud}>添加</Button>
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowCloudForm(false)}>取消</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowCloudForm(true)}>
                      <Plus className="h-3 w-3" /> 新增云方案
                    </Button>
                  )}
                </div>
              </PanelCard>
            )}

            {/* ---------------- 流程看板 ---------------- */}
            {tab === "flow" && (
              <PanelCard
                title="采购流程看板 · PR → RFQ → 比价 → PO → 验收"
                icon={Server}
                extra={
                  flowItems.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleExportFlow}>
                      <Download className="h-3 w-3" /> 导出Excel
                    </Button>
                  )
                }
              >
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="新增采购事项，如：打印机采购" value={newFlowItem} onChange={(e) => setNewFlowItem(e.target.value)} />
                    <Button onClick={handleAddFlowItem} className="gap-1 bg-stone-800 text-amber-100 hover:bg-stone-700">
                      <Plus className="h-4 w-4" /> 添加
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    {stages.map((stage, sIdx) => {
                      const StageIcon = stage.icon;
                      return (
                        <div key={stage.name} className="rounded-lg border border-amber-900/15 bg-stone-100/80 p-2">
                          <div className="mb-2 flex items-center justify-center gap-1.5 border-b border-amber-900/10 pb-2 text-center text-xs font-semibold text-stone-600">
                            <StageIcon className="h-3.5 w-3.5 text-amber-700" />
                            {stage.name}
                          </div>
                          <div className="space-y-2">
                            {flowItems.filter((f) => f.stage === sIdx).map((f) => (
                              <div key={f.id} className="rounded border border-amber-900/10 bg-white p-2 text-sm shadow-sm">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-stone-700">{f.name}</span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleRemoveFlowItem(f.id)}>
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </Button>
                                </div>
                                <div className="mt-1 flex gap-2">
                                  {sIdx < stages.length - 1 && (
                                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-amber-700" onClick={() => handleAdvanceStage(f.id, f.stage)}>
                                      下一步 <ArrowRight className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {sIdx > 0 && (
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-stone-500" onClick={() => handleResetStage(f.id)}>
                                      重置
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {flowItems.filter((f) => f.stage === sIdx).length === 0 && (
                              <div className="py-2 text-center text-xs text-stone-400">空</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </PanelCard>
            )}

            {/* ---------------- AI 采购助手 ---------------- */}
            {tab === "ai" && (
              <div className="space-y-0">
                <PanelCard
                  title="AI 采购 Agent"
                  icon={Bot}
                  extra={
                    aiMessages.length > 0 && (
                      <Button
                        size="sm" variant="outline" className="gap-1 text-xs text-red-400 hover:text-red-600"
                        onClick={() => { persistAI([]); setPendingActions([]); setExecutedActions([]); setAgentMsgBuffer([]); }}
                      >
                        <Trash2 className="h-3 w-3" /> 清空对话
                      </Button>
                    )
                  }
                >
                  <div className="flex flex-col" style={{ minHeight: "calc(100vh - 340px)", maxHeight: "calc(100vh - 340px)" }}>
                    <div className="flex-1 space-y-3 overflow-y-auto">
                      {aiMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Bot className="mb-3 h-10 w-10 text-amber-300" />
                          <p className="text-sm font-medium text-stone-500">AI 采购 Agent</p>
                          <p className="mt-1 text-xs text-stone-400">
                            我可以帮你操作采购系统——添加供应商、录入报价、推进流程等。
                          </p>
                          <p className="mt-1 text-xs text-stone-300">所有数据仅保存在本机浏览器，不会外泄。操作前会请你确认。</p>
                          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                            {[
                              "帮我添加2家云服务供应商",
                              "给所有供应商录入报价并排名",
                              "查看采购流程进度",
                            ].map((hint) => (
                              <button
                                key={hint}
                                className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-400 hover:border-amber-300 hover:text-amber-700"
                                onClick={() => { setAiInput(hint); }}
                              >
                                {hint}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {aiMessages.map((msg, i) => (
                            <div key={i}>
                              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`group relative max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                                  msg.role === "user"
                                    ? "bg-stone-800 text-amber-100"
                                    : "border border-amber-900/10 bg-white text-stone-700 shadow-sm"
                                }`}>

                                  {/* 编辑模式 */}
                                  {editingIndex === i ? (
                                    <div className="space-y-2">
                                      <textarea
                                        className="w-full rounded border border-amber-300 bg-white p-2 text-sm text-stone-800 outline-none"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        rows={3}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(i); }
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                      />
                                      <div className="flex gap-1.5">
                                        <Button size="sm" className="h-7 bg-stone-800 px-2 text-xs text-amber-100" onClick={() => saveEdit(i)}>保存并重新发送</Button>
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEdit}>取消</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                      <div className={`mt-1 flex items-center justify-between text-[10px] ${msg.role === "user" ? "text-stone-400" : "text-stone-400"}`}>
                                        <span>{new Date(typeof msg.time === "number" ? msg.time : Date.now()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}{msg.role === "assistant" && " · Agent"}</span>
                                      </div>
                                      {/* Hover 操作按钮 */}
                                      {pendingActions.length === 0 && editingIndex < 0 && (
                                        <div className={`absolute top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "right-1" : "right-1"}`}>
                                          {msg.role === "user" && (
                                            <button
                                              className="rounded p-1 hover:bg-white/20"
                                              title="编辑"
                                              onClick={() => startEdit(i)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </button>
                                          )}
                                          {msg.role === "assistant" && (
                                            <button
                                              className="rounded p-1 hover:bg-black/10"
                                              title="重新生成"
                                              onClick={() => regenerateResponse(i)}
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                            </button>
                                          )}
                                          <button
                                            className={`rounded p-1 ${msg.role === "user" ? "hover:bg-white/20" : "hover:bg-black/10"}`}
                                            title="删除"
                                            onClick={() => deleteMessage(i)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Agent 操作卡片 */}
                              {msg.actions && msg.actions.length > 0 && (
                                <div className="ml-2 mt-2 space-y-1.5">
                                  <div className="text-[11px] font-medium text-stone-500">Agent 计划执行以下操作：</div>
                                  {msg.actions.map((tc) => {
                                    const exec = executedActions.find((e) => e.id === tc.id);
                                    return (
                                      <div key={tc.id} className={`overflow-hidden rounded-lg border text-sm transition-all ${
                                        exec
                                          ? exec.status === "done" ? "border-emerald-200 bg-emerald-50/60" : exec.status === "skipped" ? "border-stone-200 bg-stone-50" : "border-red-200 bg-red-50/60"
                                          : "border-amber-200 bg-amber-50/40"
                                      }`}>
                                        <div className="flex items-center justify-between px-3 py-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">
                                                {tc.name.replace(/_/g, " ")}
                                              </span>
                                              {exec && (
                                                <span className={`text-[11px] font-medium ${exec.status === "done" ? "text-emerald-600" : exec.status === "skipped" ? "text-stone-400" : "text-red-500"}`}>
                                                  {exec.status === "done" ? "已执行" : exec.status === "skipped" ? "已跳过" : "失败"}
                                                </span>
                                              )}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">
                                              {Object.entries(tc.args).map(([k, v]) => (
                                                <span key={k} className="mr-3">{k}: <span className="font-medium text-stone-700">{String(v)}</span></span>
                                              ))}
                                            </div>
                                            {exec?.result && (
                                              <div className="mt-1 text-xs text-stone-500">{exec.result}</div>
                                            )}
                                          </div>
                                          {!exec && (
                                            <div className="flex gap-1.5">
                                              <Button
                                                size="sm" variant="ghost"
                                                className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                                                onClick={() => confirmAction(tc)}
                                              >
                                                确认
                                              </Button>
                                              <Button
                                                size="sm" variant="ghost"
                                                className="h-7 px-2 text-xs text-stone-400 hover:bg-stone-100"
                                                onClick={() => skipAction(tc.id)}
                                              >
                                                跳过
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* 执行全部按钮 */}
                                  {pendingActions.length > 0 && executedActions.filter((e) => e.status !== undefined).length < pendingActions.length && (
                                    <div className="flex gap-2 pt-1">
                                      <Button
                                        size="sm"
                                        className="gap-1 bg-amber-700 text-xs text-amber-50 hover:bg-amber-800"
                                        onClick={confirmAllActions}
                                      >
                                        执行全部 ({pendingActions.length} 项)
                                      </Button>
                                      <Button
                                        size="sm" variant="ghost"
                                        className="text-xs text-stone-400"
                                        onClick={() => { setPendingActions([]); setAiLoading(false); }}
                                      >
                                        取消
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 执行结果摘要 */}
                              {msg.actionResults && msg.actionResults.length > 0 && (
                                <div className="ml-2 mt-1 text-xs text-stone-400">
                                  {msg.actionResults.filter((r) => r.status === "done").length}/{msg.actionResults.length} 项操作成功
                                </div>
                              )}
                            </div>
                          ))}
                          {aiLoading && pendingActions.length === 0 && (
                            <div className="flex justify-start">
                              <div className="max-w-[80%] rounded-lg border border-amber-900/10 bg-white px-4 py-2.5 text-sm shadow-sm">
                                <div className="flex items-center gap-2 text-stone-400">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  思考中...
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 输入栏 */}
                    <div className="mt-3 flex gap-2 border-t border-stone-100 pt-3">
                      <Input
                        placeholder="告诉我你想做什么，例如：帮我添加2家云服务供应商"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskAI(); } }}
                        className="flex-1"
                        disabled={pendingActions.length > 0}
                      />
                      <Button
                        onClick={handleAskAI}
                        disabled={aiLoading || !aiInput.trim() || pendingActions.length > 0}
                        className="gap-1.5 bg-stone-800 text-amber-100 hover:bg-stone-700"
                      >
                        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        发送
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px] text-stone-400">
                    <span>AI Agent · 对话记录自动保存在本地 · {aiMessages.length} 条消息</span>
                    <span>Powered by GLM-4.7-Flash</span>
                  </div>
                </PanelCard>
              </div>
            )}
          </main>
        </div>

        <footer className="border-t border-amber-900/20 bg-stone-900/85 px-6 py-2 text-center text-[11px] text-stone-500">
          SmartProcureRadar © 企业IT采购决策系统 · 古典企业科技美学界面演示{demo ? " · 演示模式" : ""}
        </footer>
      </div>
    </div>
  );
}
