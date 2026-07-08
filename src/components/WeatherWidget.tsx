import { useState, useEffect, useRef, useMemo } from "react";
import {
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, CloudFog,
  RefreshCw, Minus, GripHorizontal
} from "lucide-react";

const WEATHER_MODES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  sunny:  { label: "晴朗", icon: Sun,             color: "#D4A34B" },
  cloudy: { label: "多云", icon: Cloud,           color: "#8E9AA3" },
  rain:   { label: "雨",   icon: CloudRain,       color: "#6B8A9E" },
  storm:  { label: "雷暴", icon: CloudLightning,  color: "#5C6BC0" },
  snow:   { label: "雪",   icon: Snowflake,       color: "#90A4AE" },
  fog:    { label: "雾",   icon: CloudFog,        color: "#9AA0A3" },
};

const PHILOSOPHY: Record<string, { mood: string; thinker: string; quote: string; note: string }> = {
  sunny:  { mood: "澄明",   thinker: "尼采",     quote: "澄明", note: "永恒回归凝结于一束光——毫无保留的肯定。" },
  cloudy: { mood: "延异",   thinker: "德里达",   quote: "延异", note: "意义永远被推迟；阴云握住了它从未完全释放的东西。" },
  rain:   { mood: "沉思",   thinker: "海德格尔",  quote: "沉思", note: "存在的现象学——雨水揭示了在世之在的纹理。" },
  storm:  { mood: "强力意志", thinker: "尼采",    quote: "强力意志", note: "凝视深渊，即是感受内心升起的风暴。" },
  snow:   { mood: "空寂",   thinker: "禅宗",      quote: "空寂", note: "静默有声；雪是空性坠落时所取的形。" },
  fog:    { mood: "迷雾",   thinker: "维特根斯坦", quote: "迷雾", note: "语言的边界即是雾起之处——之外，唯有沉默。" },
};

function MiniParticles({ mode }: { mode: string }) {
  const particles = useMemo(() => {
    const n = { sunny: 18, cloudy: 6, rain: 30, storm: 20, snow: 22, fog: 5 }[mode] ?? 12;
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: 0.4 + Math.random() * 1.2,
      delay: Math.random() * 4,
      dur: 3 + Math.random() * 5,
    }));
  }, [mode]);

  const colors: Record<string, string> = {
    sunny: "rgba(212,163,75,0.5)",
    cloudy: "rgba(180,180,190,0.35)",
    rain: "rgba(130,160,190,0.4)",
    storm: "rgba(140,150,210,0.45)",
    snow: "rgba(210,215,225,0.6)",
    fog: "rgba(180,180,185,0.3)",
  };

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.r, height: p.r,
            background: colors[mode] ?? "rgba(255,255,255,0.3)",
            animation: `ww-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`@keyframes ww-float { 0%,100% { opacity:0; transform:translateY(0) } 50% { opacity:1; transform:translateY(-8px) } }`}</style>
    </div>
  );
}

export interface WeatherData {
  mode: string;
  label: string;
  temp: number;
  humidity: number;
  city: string;
  description: string;
  updatedAt: number;
}

export default function WeatherWidget({ wd, error, syncing, onSync, onSetMode }: {
  wd: WeatherData | null; error: string; syncing: boolean; onSync: () => void; onSetMode: (m: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem("procure_widget_pos") ?? "{}");
      return { x: p.x ?? window.innerWidth - 390, y: p.y ?? 20 };
    } catch { return { x: window.innerWidth - 390, y: 20 }; }
  });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aiInsight, setAiInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [showSim, setShowSim] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const mode = wd?.mode ?? "sunny";
  const cfg = WEATHER_MODES[mode];
  const phil = PHILOSOPHY[mode];
  const Icon = cfg.icon;
  const now = new Date();

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const w = collapsed ? 120 : 360;
      setPos({ x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - w)), y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 60)) });
    };
    const onUp = () => { setDragging(false); localStorage.setItem("procure_widget_pos", JSON.stringify(pos)); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragStart, pos, collapsed]);

  const fetchInsight = async () => {
    if (!wd) return;
    setInsightLoading(true);
    try {
      const key = import.meta.env.VITE_ZHIPU_API_KEY as string;
      if (!key) { setAiInsight("未配置 API Key"); setInsightLoading(false); return; }
      const body = JSON.stringify({
        model: "glm-4-flash",
        messages: [
          { role: "system", content: "你是一个哲学助手。根据天气写一句哲学洞察，不超过40个中文字。不要解释，只要洞察本身。" },
          { role: "user", content: `当前天气：${wd.label}（${wd.description}），温度${wd.temp}°C，城市${wd.city}。哲学情绪：${phil.mood}。` },
        ],
        temperature: 0.9, max_tokens: 128,
      });
      console.log("[WeatherWidget] 请求体:", body);
      const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body,
      });
      const raw = await res.text();
      console.log("[WeatherWidget] 响应:", res.status, raw.slice(0, 300));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(raw);
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`API 返回为空 (raw: ${raw.slice(0, 150)})`);
      setAiInsight(text);
    } catch (err) {
      setAiInsight(`生成失败：${err instanceof Error ? err.message : String(err)}`);
    } finally { setInsightLoading(false); }
  };

  const timeline = [
    { label: "晨", temp: wd ? wd.temp - 2 : "--" },
    { label: "午", temp: wd ? wd.temp + 1 : "--" },
    { label: "夜", temp: wd ? wd.temp - 3 : "--" },
  ];

  if (!wd && !error) return null;

  return (
    <div
      className="fixed z-50 font-sans"
      style={{ left: pos.x, top: pos.y, userSelect: "none" }}
    >
      {collapsed ? (
        <div
          className="flex h-[120px] w-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl transition-all hover:scale-105"
          style={{ boxShadow: `0 0 40px ${cfg.color}15` }}
          onClick={() => setCollapsed(false)}
          onMouseDown={onMouseDown}
        >
          <span style={{ color: cfg.color }}><Icon className="mb-1 h-7 w-7" /></span>
          <div className="text-2xl font-light tracking-tight text-white">{wd?.temp ?? "--"}°</div>
          <div className="text-[10px] text-white/40">{wd?.city ?? "未知"}</div>
        </div>
      ) : (
        <div
          className="w-[360px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl transition-all"
          style={{ background: "rgba(18,18,20,0.82)", boxShadow: `0 8px 48px rgba(0,0,0,0.4), 0 0 60px ${cfg.color}10` }}
        >
          <MiniParticles mode={mode} />

          <div className="relative z-10">
            <div
              ref={dragRef}
              className="flex cursor-grab items-center justify-between px-4 py-2 active:cursor-grabbing"
              onMouseDown={onMouseDown}
            >
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                <GripHorizontal className="h-3 w-3" />
                环境感知
              </div>
              <div className="flex items-center gap-1">
                {error && (
                  <button className="rounded p-1 text-white/30 hover:text-white/60" onClick={onSync} title="重试">
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                  </button>
                )}
                <button className="rounded p-1 text-white/30 hover:text-white/60" onClick={() => setCollapsed(true)}>
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="px-5 pb-5">
              {error ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-xs leading-relaxed text-red-300/80">{error}</p>
                  <button className="text-xs text-white/40 underline hover:text-white/70" onClick={onSync}>重试</button>
                </div>
              ) : wd ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-medium tracking-widest text-white/40">{wd.city}</div>
                      <div className="mt-0.5 text-[11px] text-white/25">{wd.label} · {wd.description}</div>
                    </div>
                    <div className="text-right text-[10px] text-white/25">
                      <div>{now.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</div>
                      <div>{now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <span style={{ color: cfg.color }}><Icon className="mb-1 h-9 w-9" /></span>
                    <div className="text-6xl font-extralight leading-none tracking-tighter text-white">{wd.temp}<span className="text-3xl text-white/50">°</span></div>
                  </div>
                  <div className="mt-1 text-[11px] text-white/20">湿度 {wd.humidity}%  ·  更新于 {new Date(wd.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</div>

                  <div className="mt-4 rounded-xl border border-white/5 px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[10px] font-medium tracking-widest text-white/25">氛围</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-serif text-lg text-white/80">{phil.mood}</span>
                      <span className="text-[11px] text-white/25">— {phil.thinker}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-white/35">{phil.note}</div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/5 px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium tracking-widest text-white/25">AI 洞察</span>
                      {!aiInsight && (
                        <button
                          className="text-[10px] text-white/25 hover:text-white/50"
                          onClick={fetchInsight}
                          disabled={insightLoading}
                        >
                          {insightLoading ? "..." : "生成"}
                        </button>
                      )}
                    </div>
                    {aiInsight ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">{aiInsight}</p>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-white/15">点击"生成"获取环境认知解读。</p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {timeline.map((t) => (
                      <div key={t.label} className="flex-1 rounded-lg border border-white/5 px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div className="text-[9px] text-white/25">{t.label}</div>
                        <div className="text-sm font-light text-white/60">{t.temp}°</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : syncing ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/25">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  感知环境中...
                </div>
              ) : null}

              <div className="mt-3 flex gap-1.5">
                <button
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-medium transition-all ${!showSim ? "text-white/70" : "text-white/25"} border border-white/5`}
                  style={{ background: !showSim ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)" }}
                  onClick={() => { setShowSim(false); onSync(); }}
                >
                  实时
                </button>
                <button
                  className={`flex-1 rounded-lg py-1.5 text-[10px] font-medium transition-all ${showSim ? "text-white/70" : "text-white/25"} border border-white/5`}
                  style={{ background: showSim ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)" }}
                  onClick={() => setShowSim(!showSim)}
                >
                  模拟
                </button>
                <button
                  className="flex-1 rounded-lg border border-white/5 py-1.5 text-[10px] font-medium text-white/25 transition-all hover:text-white/50"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                  onClick={fetchInsight}
                >
                  AI
                </button>
              </div>

              {showSim && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(WEATHER_MODES).map(([k, v]) => (
                    <button
                      key={k}
                      className={`rounded-md px-2 py-1 text-[10px] transition-all ${k === mode ? "text-white/80" : "text-white/25"} border border-white/5`}
                      style={{ background: k === mode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)" }}
                      onClick={() => onSetMode(k)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
