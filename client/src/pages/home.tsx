import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, AlertTriangle, CheckCircle2, HelpCircle, TrendingUp, Clock, MessageSquare, Zap, ExternalLink, Copy, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type AnalysisState = "idle" | "fetching" | "analyzing" | "complete" | "error";

interface Claim {
  id: string;
  timestamp: string;
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
  videoTitle: string;
  channelName: string;
  duration: string;
  capScore: number;
  summary: string;
  claims: Claim[];
  framingTactics: FramingTactic[];
  transcript: string;
}

const mockAnalysisResult: AnalysisResult = {
  videoTitle: "Why Everything You Know About Diet Is Wrong",
  channelName: "Health Explained",
  duration: "14:32",
  capScore: 67,
  summary: "This video makes several bold claims about nutrition science, mixing legitimate research findings with exaggerated conclusions. The presenter uses emotional appeals and cherry-picked studies to support a narrative that contradicts mainstream scientific consensus on several points. While some claims about processed foods have merit, the overall framing is designed to provoke rather than inform.",
  claims: [
    {
      id: "1",
      timestamp: "0:45",
      text: "Sugar is more addictive than cocaine according to brain imaging studies.",
      type: "claim",
      rating: "unsupported",
      explanation: "This claim misrepresents a single rat study. Human addiction research does not support this comparison."
    },
    {
      id: "2", 
      timestamp: "2:15",
      text: "The food industry has spent billions lobbying against nutrition education.",
      type: "claim",
      rating: "supported",
      explanation: "Public lobbying records confirm significant industry spending on food policy influence."
    },
    {
      id: "3",
      timestamp: "4:30",
      text: "Doctors receive almost no nutrition training in medical school.",
      type: "claim",
      rating: "supported",
      explanation: "Multiple surveys confirm average nutrition education is under 20 hours in US medical schools."
    },
    {
      id: "4",
      timestamp: "6:12",
      text: "This one simple change could add 10 years to your life.",
      type: "opinion",
      rating: "unsupported",
      explanation: "Lifestyle impact claims this specific are not supported by longitudinal research."
    },
    {
      id: "5",
      timestamp: "8:45",
      text: "Processed foods are designed to override your satiety signals.",
      type: "claim",
      rating: "supported",
      explanation: "Food science research confirms hyper-palatability engineering in processed foods."
    },
    {
      id: "6",
      timestamp: "11:20",
      text: "The government dietary guidelines are influenced by corporate interests.",
      type: "claim",
      rating: "uncertain",
      explanation: "While conflicts of interest exist, the degree of influence is debated among researchers."
    }
  ],
  framingTactics: [
    {
      name: "Appeal to Fear",
      count: 8,
      severity: "high",
      examples: ["Your body is being poisoned daily", "The truth they don't want you to know"]
    },
    {
      name: "False Dichotomy",
      count: 4,
      severity: "medium",
      examples: ["You either eat clean or you're killing yourself slowly"]
    },
    {
      name: "Cherry-Picked Evidence",
      count: 6,
      severity: "high",
      examples: ["Studies that contradict main claims are ignored while supporting ones are emphasized"]
    },
    {
      name: "Emotional Language",
      count: 12,
      severity: "medium",
      examples: ["Terrifying", "Shocking truth", "Life-changing secret"]
    }
  ],
  transcript: `[0:00] Hey everyone, welcome back to the channel...
[0:15] Today we're going to expose the truth about what you're really eating...
[0:45] Sugar is more addictive than cocaine according to brain imaging studies...
[2:15] The food industry has spent billions lobbying against nutrition education...
[4:30] Doctors receive almost no nutrition training in medical school...
[6:12] This one simple change could add 10 years to your life...
[8:45] Processed foods are designed to override your satiety signals...
[11:20] The government dietary guidelines are influenced by corporate interests...
[14:00] Thanks for watching, don't forget to like and subscribe...`
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function CapScoreGauge({ score }: { score: number }) {
  const getScoreColor = () => {
    if (score < 33) return "text-emerald-400";
    if (score < 66) return "text-amber-400";
    return "text-red-400";
  };
  
  const getScoreLabel = () => {
    if (score < 33) return "Low Cap";
    if (score < 66) return "Moderate Cap";
    return "High Cap";
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={getScoreColor()}
            initial={{ strokeDasharray: "0 264" }}
            animate={{ strokeDasharray: `${(score / 100) * 264} 264` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className={`text-5xl font-bold ${getScoreColor()}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-muted-foreground text-sm">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-xl font-semibold ${getScoreColor()}`}>{getScoreLabel()}</p>
        <p className="text-muted-foreground text-sm mt-1">
          {score < 33 && "Content appears mostly factual"}
          {score >= 33 && score < 66 && "Contains some misleading elements"}
          {score >= 66 && "Heavy use of manipulation tactics"}
        </p>
      </div>
    </div>
  );
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const getRatingIcon = () => {
    switch (claim.rating) {
      case "supported": return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "unsupported": return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case "uncertain": return <HelpCircle className="w-5 h-5 text-amber-400" />;
    }
  };
  
  const getRatingBadge = () => {
    switch (claim.rating) {
      case "supported": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Supported</Badge>;
      case "unsupported": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Unsupported</Badge>;
      case "uncertain": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Uncertain</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="p-4 bg-card border border-card-border rounded-lg hover:border-muted-foreground/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">{getRatingIcon()}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              className="text-xs font-mono text-primary hover:underline cursor-pointer"
              data-testid={`claim-timestamp-${claim.id}`}
            >
              {claim.timestamp}
            </button>
            {getRatingBadge()}
            <Badge variant="outline" className="text-xs">
              {claim.type === "claim" ? "Factual Claim" : "Opinion"}
            </Badge>
          </div>
          <p className="text-foreground">{claim.text}</p>
          <p className="text-sm text-muted-foreground">{claim.explanation}</p>
        </div>
      </div>
    </motion.div>
  );
}

function FramingCard({ tactic, index }: { tactic: FramingTactic; index: number }) {
  const getSeverityColor = () => {
    switch (tactic.severity) {
      case "low": return "bg-emerald-500/20 text-emerald-400";
      case "medium": return "bg-amber-500/20 text-amber-400";
      case "high": return "bg-red-500/20 text-red-400";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="p-4 bg-card border border-card-border rounded-lg"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">{tactic.name}</h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor()}`}>
            {tactic.severity}
          </span>
          <span className="text-muted-foreground text-sm">{tactic.count}x</span>
        </div>
      </div>
      <div className="space-y-1">
        {tactic.examples.map((example, i) => (
          <p key={i} className="text-sm text-muted-foreground italic">"{example}"</p>
        ))}
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  const simulateAnalysis = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      setState("error");
      return;
    }

    setState("fetching");
    setProgress(0);
    setProgressMessage("Fetching video transcript...");
    
    await new Promise(r => setTimeout(r, 1500));
    setProgress(25);
    setProgressMessage("Parsing captions...");
    
    await new Promise(r => setTimeout(r, 1000));
    setProgress(40);
    
    const transcriptFailed = Math.random() > 0.7;
    
    if (transcriptFailed && !manualTranscript) {
      setShowFallback(true);
      setState("idle");
      setProgress(0);
      return;
    }

    setState("analyzing");
    setProgressMessage("Identifying claims and opinions...");
    setProgress(50);
    
    await new Promise(r => setTimeout(r, 1200));
    setProgressMessage("Fact-checking claims...");
    setProgress(65);
    
    await new Promise(r => setTimeout(r, 1500));
    setProgressMessage("Detecting framing tactics...");
    setProgress(80);
    
    await new Promise(r => setTimeout(r, 1000));
    setProgressMessage("Calculating cap score...");
    setProgress(95);
    
    await new Promise(r => setTimeout(r, 800));
    setProgress(100);
    
    setResult(mockAnalysisResult);
    setState("complete");
    setActiveTab("summary");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setShowFallback(false);
    setManualTranscript("");
    simulateAnalysis();
  };

  const handleFallbackSubmit = () => {
    if (!manualTranscript.trim()) return;
    simulateAnalysis();
  };

  const resetAnalysis = () => {
    setState("idle");
    setResult(null);
    setUrl("");
    setProgress(0);
    setShowFallback(false);
    setManualTranscript("");
  };

  return (
    <div className="min-h-screen bg-background noise-texture">
      <div className="relative z-10">
        <header className="border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-background" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Cap Detector</h1>
                <p className="text-xs text-muted-foreground">Fact-check any YouTube video</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {state === "idle" && !result && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4 pt-12 pb-8">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Is it <span className="text-gradient">cap</span> or{" "}
                    <span className="text-emerald-400">fact</span>?
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                    Paste any YouTube URL and we'll analyze the video for factual claims, 
                    emotional manipulation, and rhetorical tactics.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
                  <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Paste YouTube URL here..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="pl-12 pr-32 h-14 text-lg bg-card border-card-border focus:border-primary"
                      data-testid="input-youtube-url"
                    />
                    <Button 
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid="button-analyze"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Analyze
                    </Button>
                  </div>
                </form>

                {showFallback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="max-w-2xl mx-auto"
                  >
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-amber-400 font-medium">Transcript unavailable</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            This video doesn't have accessible captions. Please paste the transcript manually below.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Paste the video transcript here..."
                      value={manualTranscript}
                      onChange={(e) => setManualTranscript(e.target.value)}
                      className="min-h-[200px] bg-card border-card-border"
                      data-testid="textarea-manual-transcript"
                    />
                    <Button 
                      onClick={handleFallbackSubmit}
                      className="mt-4 w-full bg-primary text-primary-foreground"
                      data-testid="button-analyze-transcript"
                    >
                      Analyze Transcript
                    </Button>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-8">
                  <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                    <MessageSquare className="w-8 h-8 text-primary mx-auto mb-2" />
                    <h3 className="font-semibold">Claim Detection</h3>
                    <p className="text-sm text-muted-foreground">Separates facts from opinions</p>
                  </div>
                  <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                    <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                    <h3 className="font-semibold">Cap Score</h3>
                    <p className="text-sm text-muted-foreground">Overall reliability rating</p>
                  </div>
                  <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                    <AlertTriangle className="w-8 h-8 text-primary mx-auto mb-2" />
                    <h3 className="font-semibold">Framing Analysis</h3>
                    <p className="text-sm text-muted-foreground">Detects manipulation tactics</p>
                  </div>
                </div>
              </motion.div>
            )}

            {(state === "fetching" || state === "analyzing") && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 space-y-6"
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-muted animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">{progressMessage}</p>
                  <p className="text-muted-foreground text-sm">This may take a moment...</p>
                </div>
                <div className="w-64">
                  <Progress value={progress} className="h-2" />
                </div>
              </motion.div>
            )}

            {state === "complete" && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{result.videoTitle}</h2>
                    <div className="flex items-center gap-3 text-muted-foreground text-sm mt-1">
                      <span>{result.channelName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {result.duration}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={resetAnalysis} data-testid="button-new-analysis">
                    New Analysis
                  </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start bg-card border border-card-border p-1">
                    <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
                    <TabsTrigger value="claims" data-testid="tab-claims">
                      Claims ({result.claims.length})
                    </TabsTrigger>
                    <TabsTrigger value="score" data-testid="tab-score">Cap Score</TabsTrigger>
                    <TabsTrigger value="framing" data-testid="tab-framing">Framing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 p-6 bg-card border border-card-border rounded-lg">
                        <h3 className="text-lg font-semibold mb-3">Analysis Summary</h3>
                        <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
                      </div>
                      <div className="p-6 bg-card border border-card-border rounded-lg flex flex-col items-center justify-center">
                        <CapScoreGauge score={result.capScore} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                        <p className="text-3xl font-bold text-foreground">{result.claims.length}</p>
                        <p className="text-sm text-muted-foreground">Total Claims</p>
                      </div>
                      <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                        <p className="text-3xl font-bold text-emerald-400">
                          {result.claims.filter(c => c.rating === "supported").length}
                        </p>
                        <p className="text-sm text-muted-foreground">Supported</p>
                      </div>
                      <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                        <p className="text-3xl font-bold text-red-400">
                          {result.claims.filter(c => c.rating === "unsupported").length}
                        </p>
                        <p className="text-sm text-muted-foreground">Unsupported</p>
                      </div>
                      <div className="p-4 bg-card border border-card-border rounded-lg text-center">
                        <p className="text-3xl font-bold text-amber-400">
                          {result.claims.filter(c => c.rating === "uncertain").length}
                        </p>
                        <p className="text-sm text-muted-foreground">Uncertain</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="claims" className="mt-6">
                    <div className="space-y-3">
                      {result.claims.map((claim, index) => (
                        <ClaimCard key={claim.id} claim={claim} index={index} />
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="score" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 bg-card border border-card-border rounded-lg flex items-center justify-center">
                        <CapScoreGauge score={result.capScore} />
                      </div>
                      <div className="p-6 bg-card border border-card-border rounded-lg space-y-4">
                        <h3 className="text-lg font-semibold">What affects the Cap Score?</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Unsupported claims</span>
                            <span className="font-mono text-red-400">+25 pts</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Fear-based framing</span>
                            <span className="font-mono text-red-400">+18 pts</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Emotional language</span>
                            <span className="font-mono text-amber-400">+12 pts</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cherry-picked evidence</span>
                            <span className="font-mono text-red-400">+12 pts</span>
                          </div>
                          <div className="h-px bg-border my-2" />
                          <div className="flex items-center justify-between font-semibold">
                            <span>Total Cap Score</span>
                            <span className="font-mono text-primary">{result.capScore}/100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="framing" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.framingTactics.map((tactic, index) => (
                        <FramingCard key={tactic.name} tactic={tactic} index={index} />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
