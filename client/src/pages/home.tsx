import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, AlertTriangle, CheckCircle2, HelpCircle,
  TrendingUp, MessageSquare, Zap, Youtube, FileText,
  Twitter, ClipboardPaste, ExternalLink, Share2, Copy,
  ChevronDown, ChevronUp, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AnalysisState = "idle" | "fetching" | "analyzing" | "complete" | "error";
type ContentType = "youtube" | "article" | "twitter" | "text";

interface Claim {
  id: string;
  timestamp: string;
  offsetMs: number;
  text: string;
  type: "claim" | "opinion";
  rating: "supported" | "unsupported" | "uncertain";
  explanation: string;
}

interface FramingTactic {
  name: string;
  count: number;
  severity: "low" | "medium" | "high";
  examples: string[];
}

interface AnalysisResult {
  capScore: number;
  capScoreExplanation: string;
  summary: string;
  claims: Claim[];
  framingTactics: FramingTactic[];
}

interface ContentMeta {
  contentType: ContentType;
  title?: string;
  source?: string;
  authorName?: string;
  thumbnailUrl?: string;
}

function CapScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const getColor = () => {
    if (score < 33) return { text: "text-emerald-400", stroke: "#34d399", label: "Low Cap", desc: "Mostly factual" };
    if (score < 66) return { text: "text-amber-400", stroke: "#fbbf24", label: "Moderate Cap", desc: "Mixed reliability" };
    return { text: "text-red-400", stroke: "#f87171", label: "High Cap", desc: "Manipulative content" };
  };
  const c = getColor();
  const dim = size === "sm" ? 80 : 160;
  const r = size === "sm" ? 32 : 65;
  const strokeW = size === "sm" ? 6 : 9;
  const circ = 2 * Math.PI * r;
  return (
    <div className={`flex flex-col items-center ${size === "sm" ? "gap-1" : "gap-3"}`}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="hsl(220 15% 12%)" strokeWidth={strokeW} />
          <motion.circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={c.stroke} strokeWidth={strokeW} strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${(score/100)*circ} ${circ}` }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className={`font-bold ${c.text} ${size === "sm" ? "text-xl" : "text-4xl"}`}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
            {score}
          </motion.span>
          {size === "lg" && <span className="text-muted-foreground text-xs">/100</span>}
        </div>
      </div>
      <div className="text-center">
        <p className={`font-semibold ${c.text} ${size === "sm" ? "text-xs" : "text-lg"}`}>{c.label}</p>
        {size === "lg" && <p className="text-muted-foreground text-xs mt-0.5">{c.desc}</p>}
      </div>
    </div>
  );
}

function ShareModal({ result, contentMeta, onClose }: { result: AnalysisResult; contentMeta: ContentMeta | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const getScoreLabel = () => {
    if (result.capScore < 33) return "Low Cap ✅";
    if (result.capScore < 66) return "Moderate Cap ⚠️";
    return "High Cap 🚨";
  };
  const getScoreColor = () => {
    if (result.capScore < 33) return "#34d399";
    if (result.capScore < 66) return "#fbbf24";
    return "#f87171";
  };
  const shareText = `Cap Detector Analysis\n\n📊 Cap Score: ${result.capScore}/100 — ${getScoreLabel()}\n\n${result.summary}\n\n🔍 ${result.claims.length} claims analyzed · ${result.framingTactics.length} manipulation tactics detected\n\nCheck it yourself → capdetector.app`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleShare = () => {
    if (navigator.share) { navigator.share({ title: "Cap Detector", text: shareText }); }
    else { handleCopy(); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={onClose}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-card border border-card-border rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="p-5 space-y-4" style={{ background: "linear-gradient(135deg, hsl(220 20% 6%), hsl(220 18% 9%))" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(38 95% 55%), hsl(0 85% 60%))" }}>
                <Zap className="w-3.5 h-3.5 text-black" />
              </div>
              <span className="font-bold text-sm tracking-tight">Cap Detector</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="rounded-xl p-4 border" style={{ borderColor: getScoreColor() + "33", background: getScoreColor() + "08" }}>
            <div className="flex items-center gap-4">
              <CapScoreGauge score={result.capScore} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1 truncate">{contentMeta?.title || "Analysis"}</p>
                <p className="text-sm font-medium leading-snug line-clamp-3 text-foreground/90">{result.summary}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-3 pt-3 border-t border-white/5">
              {[
                { val: result.claims.length, label: "Claims", color: "text-foreground" },
                { val: result.claims.filter(c => c.rating === "supported").length, label: "Supported", color: "text-emerald-400" },
                { val: result.claims.filter(c => c.rating === "unsupported").length, label: "Unsupported", color: "text-red-400" },
                { val: result.framingTactics.length, label: "Tactics", color: "text-amber-400" },
              ].map(s => (
                <div key={s.label} className="text-center flex-1">
                  <p className={`text-base font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2 border-t border-border">
          <Button onClick={handleShare} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Share2 className="w-4 h-4" /> Share Results
          </Button>
          <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
            <Copy className="w-4 h-4" />{copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const icon = { supported: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />, unsupported: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />, uncertain: <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> }[claim.rating];
  const badge = { supported: <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] px-1.5 py-0">Supported</Badge>, unsupported: <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px] px-1.5 py-0">Unsupported</Badge>, uncertain: <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] px-1.5 py-0">Uncertain</Badge> }[claim.rating];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className="p-3.5 bg-card border border-card-border rounded-xl">
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-2.5">
          {icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {badge}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{claim.type === "claim" ? "Factual" : "Opinion"}</Badge>
              {claim.timestamp !== "N/A" && <span className="text-[10px] font-mono text-primary">{claim.timestamp}</span>}
            </div>
            <p className="text-sm text-foreground leading-snug line-clamp-2">{claim.text}</p>
          </div>
          <div className="shrink-0 text-muted-foreground mt-1">{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</div>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="text-xs text-muted-foreground mt-2.5 ml-6 leading-relaxed overflow-hidden border-l border-border pl-3">
              {claim.explanation}
            </motion.p>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

function FramingCard({ tactic, index }: { tactic: FramingTactic; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const severityStyle = { low: "bg-emerald-500/15 text-emerald-400", medium: "bg-amber-500/15 text-amber-400", high: "bg-red-500/15 text-red-400" }[tactic.severity];
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }}
      className="p-3.5 bg-card border border-card-border rounded-xl">
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{tactic.name}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityStyle}`}>{tactic.severity}</span>
            <span className="text-muted-foreground text-xs">{tactic.count}x</span>
          </div>
          <div className="shrink-0 text-muted-foreground">{expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</div>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mt-2.5 space-y-1.5">
                {tactic.examples.map((ex, i) => <p key={i} className="text-xs text-muted-foreground italic pl-3 border-l border-border">"{ex}"</p>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  youtube: <Youtube className="w-3.5 h-3.5" />,
  article: <FileText className="w-3.5 h-3.5" />,
  twitter: <Twitter className="w-3.5 h-3.5" />,
  text: <ClipboardPaste className="w-3.5 h-3.5" />,
};
const contentTypeLabels: Record<ContentType, string> = { youtube: "YouTube", article: "Article", twitter: "Twitter", text: "Paste Text" };

export default function Home() {
  const [inputTab, setInputTab] = useState<ContentType>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [state, setState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [contentMeta, setContentMeta] = useState<ContentMeta | null>(null);
  const [activeResultTab, setActiveResultTab] = useState("summary");
  const [errorMessage, setErrorMessage] = useState("");
  const [contentFailedMessage, setContentFailedMessage] = useState("");
  const [showShare, setShowShare] = useState(false);

  const charCount = pasteText.length;

  const getInputValue = () => {
    switch (inputTab) {
      case "youtube": return { url: youtubeUrl };
      case "article": return { url: articleUrl };
      case "twitter": return { url: twitterUrl };
      case "text": return { text: pasteText };
    }
  };

  const isSubmitDisabled = () => {
    switch (inputTab) {
      case "youtube": return !youtubeUrl.trim();
      case "article": return !articleUrl.trim();
      case "twitter": return !twitterUrl.trim();
      case "text": return !pasteText.trim() || pasteText.trim().length < 100;
    }
  };

  const runAnalysis = async () => {
    setState("fetching"); setProgress(10); setProgressMessage("Connecting...");
    setErrorMessage(""); setContentFailedMessage("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...getInputValue(), contentType: inputTab }),
      });
      if (!response.ok && !response.headers.get("content-type")?.includes("text/event-stream")) {
        const error = await response.json();
        throw new Error(error.message || "Analysis failed");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            switch (data.type) {
              case "progress":
                setProgressMessage(data.message);
                if (data.message.includes("Fetching") || data.message.includes("Starting")) setProgress(20);
                else if (data.message.includes("transcript") || data.message.includes("Extracting")) setProgress(45);
                else if (data.message.includes("fetched") || data.message.includes("extracted")) setProgress(65);
                else if (data.message.includes("Analyzing") || data.message.includes("Identifying")) { setState("analyzing"); setProgress(80); }
                break;
              case "content_failed":
                setContentFailedMessage(data.message); setState("error"); setProgress(0); return;
              case "complete":
                setProgress(100); setResult(data.analysis);
                setContentMeta({ contentType: data.contentType, title: data.title, source: data.source, authorName: data.authorName, thumbnailUrl: data.thumbnailUrl });
                setState("complete"); setActiveResultTab("summary");
                break;
              case "error": throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Analysis failed") console.warn("SSE parse error:", line);
            else throw e;
          }
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed");
      setState("error");
    }
  };

  const resetAnalysis = () => { setState("idle"); setResult(null); setContentMeta(null); setProgress(0); setErrorMessage(""); setContentFailedMessage(""); };

  return (
    <div className="min-h-screen bg-background noise-texture">
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border sticky top-0 z-20 bg-background/90 backdrop-blur-md">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(38 95% 55%), hsl(0 85% 60%))" }}>
                <Zap className="w-4 h-4 text-black" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight leading-none">Cap Detector</h1>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Fact-check any content</p>
              </div>
            </div>
            {result && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setShowShare(true)}>
                <Share2 className="w-3.5 h-3.5" /> Share
              </Button>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {/* Input */}
            {(state === "idle" || state === "error") && !result && (
              <motion.div key="input" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <div className="text-center space-y-2 pt-6 pb-2">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Is it <span className="text-gradient">cap</span> or <span className="text-emerald-400">fact</span>?
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Paste a YouTube link, article, tweet, or text — we'll analyze it for manipulation.
                  </p>
                </div>

                <div>
                  <Tabs value={inputTab} onValueChange={(v) => { setInputTab(v as ContentType); setContentFailedMessage(""); setErrorMessage(""); }}>
                    <TabsList className="w-full bg-card border border-card-border p-1 mb-3 grid grid-cols-4">
                      {(["youtube", "article", "twitter", "text"] as ContentType[]).map(t => (
                        <TabsTrigger key={t} value={t} className="flex items-center gap-1 text-xs px-1">
                          {contentTypeIcons[t]}
                          <span className="hidden sm:inline">{contentTypeLabels[t]}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {[
                      { val: "youtube", placeholder: "Paste YouTube URL...", icon: <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />, value: youtubeUrl, onChange: setYoutubeUrl },
                      { val: "article", placeholder: "Paste article URL...", icon: <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />, value: articleUrl, onChange: setArticleUrl },
                      { val: "twitter", placeholder: "Paste Twitter/X URL...", icon: <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />, value: twitterUrl, onChange: setTwitterUrl },
                    ].map(({ val, placeholder, icon, value, onChange }) => (
                      <TabsContent key={val} value={val} className="mt-0">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            {icon}
                            <Input type="text" placeholder={placeholder} value={value}
                              onChange={(e) => onChange(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && !isSubmitDisabled() && runAnalysis()}
                              className="pl-10 h-12 bg-card border-card-border" />
                          </div>
                          <Button onClick={runAnalysis} disabled={isSubmitDisabled()} className="h-12 px-5 bg-primary text-primary-foreground shrink-0">
                            <Search className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Analyze</span>
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                    <TabsContent value="text" className="mt-0 space-y-2">
                      <Textarea placeholder="Paste any text — transcript, article, speech..." value={pasteText}
                        onChange={(e) => { if (e.target.value.length <= 50000) setPasteText(e.target.value); }}
                        className="min-h-[140px] bg-card border-card-border text-sm resize-none" />
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${charCount < 100 ? "text-amber-400" : charCount > 45000 ? "text-red-400" : "text-muted-foreground"}`}>
                          {charCount.toLocaleString()} / 50,000{charCount > 0 && charCount < 100 && " (min 100)"}
                        </span>
                        <Button onClick={runAnalysis} disabled={isSubmitDisabled()} className="gap-2 bg-primary text-primary-foreground h-9 text-sm">
                          <Search className="w-3.5 h-3.5" /> Analyze
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {state === "error" && (errorMessage || contentFailedMessage) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-red-400 font-medium text-sm">{contentFailedMessage ? "Content extraction failed" : "Analysis failed"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{contentFailedMessage || errorMessage}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {state !== "error" && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { icon: <MessageSquare className="w-5 h-5 text-primary" />, title: "Claim Detection", desc: "Facts vs opinions" },
                      { icon: <TrendingUp className="w-5 h-5 text-primary" />, title: "Cap Score", desc: "0–100 reliability" },
                      { icon: <AlertTriangle className="w-5 h-5 text-primary" />, title: "Framing Analysis", desc: "Manipulation tactics" },
                    ].map((f) => (
                      <div key={f.title} className="p-3 bg-card border border-card-border rounded-xl text-center">
                        <div className="flex justify-center mb-1.5">{f.icon}</div>
                        <p className="font-semibold text-xs">{f.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Loading */}
            {(state === "fetching" || state === "analyzing") && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 space-y-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-muted" />
                  <motion.div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent"
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium text-sm">{progressMessage}</p>
                  <p className="text-muted-foreground text-xs">This may take a moment...</p>
                </div>
                <div className="w-48"><Progress value={progress} className="h-1.5" /></div>
              </motion.div>
            )}

            {/* Results */}
            {state === "complete" && result && (
              <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {contentMeta && contentTypeIcons[contentMeta.contentType]}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{contentMeta ? contentTypeLabels[contentMeta.contentType] : "Content"}</Badge>
                    </div>
                    <h2 className="text-base font-bold leading-snug line-clamp-2">{contentMeta?.title || "Analysis Complete"}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.claims.length} claims · Cap Score {result.capScore}/100{contentMeta?.authorName && ` · ${contentMeta.authorName}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setShowShare(true)}><Share2 className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs px-2.5" onClick={resetAnalysis}>New</Button>
                  </div>
                </div>

                <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
                  <TabsList className="w-full bg-card border border-card-border p-1 grid grid-cols-4">
                    <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                    <TabsTrigger value="claims" className="text-xs">Claims ({result.claims.length})</TabsTrigger>
                    <TabsTrigger value="score" className="text-xs">Score</TabsTrigger>
                    <TabsTrigger value="framing" className="text-xs">Framing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-4 space-y-4">
                    <div className="p-4 bg-card border border-card-border rounded-xl">
                      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <CapScoreGauge score={result.capScore} />
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-2">Analysis Summary</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { val: result.claims.length, label: "Claims", color: "text-foreground" },
                        { val: result.claims.filter(c => c.rating === "supported").length, label: "Supported", color: "text-emerald-400" },
                        { val: result.claims.filter(c => c.rating === "unsupported").length, label: "Unsupported", color: "text-red-400" },
                        { val: result.claims.filter(c => c.rating === "uncertain").length, label: "Uncertain", color: "text-amber-400" },
                      ].map(s => (
                        <div key={s.label} className="p-3 bg-card border border-card-border rounded-xl text-center">
                          <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="claims" className="mt-4 space-y-2.5">
                    {result.claims.length === 0
                      ? <div className="text-center py-10 text-muted-foreground text-sm">No specific claims identified.</div>
                      : result.claims.map((claim, i) => <ClaimCard key={claim.id} claim={claim} index={i} />)}
                  </TabsContent>

                  <TabsContent value="score" className="mt-4">
                    <div className="p-6 bg-card border border-card-border rounded-xl space-y-5">
                      <div className="flex justify-center"><CapScoreGauge score={result.capScore} /></div>
                      <div>
                        <h3 className="font-semibold text-sm mb-2 text-center">Score Breakdown</h3>
                        <p className="text-sm text-muted-foreground text-center leading-relaxed">{result.capScoreExplanation}</p>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        {[
                          { range: "0–30", label: "Mostly Factual", color: "bg-emerald-500" },
                          { range: "31–60", label: "Mixed / Biased", color: "bg-amber-500" },
                          { range: "61–100", label: "Highly Misleading", color: "bg-red-500" },
                        ].map(s => (
                          <div key={s.range} className="flex items-center gap-2.5 text-xs">
                            <div className={`w-2 h-2 rounded-full ${s.color} shrink-0`} />
                            <span className="font-mono text-muted-foreground w-14">{s.range}</span>
                            <span className="text-foreground/80">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="framing" className="mt-4 space-y-2.5">
                    {result.framingTactics.length === 0
                      ? <div className="text-center py-10 text-muted-foreground text-sm">No significant framing tactics detected.</div>
                      : result.framingTactics.map((t, i) => <FramingCard key={t.name} tactic={t} index={i} />)}
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showShare && result && <ShareModal result={result} contentMeta={contentMeta} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </div>
  );
}
