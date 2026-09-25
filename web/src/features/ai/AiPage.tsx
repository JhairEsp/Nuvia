import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, MessageCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { askCopilot, type AiReply } from "../../lib/ai";
import { useDB } from "../../store/db";

interface Msg { role: "user" | "ai"; text: string; ai?:AiReply["ai"]; cta?: AiReply["cta"]; }

const SUGGESTIONS = [
  "¿Cómo estuvo mi negocio esta semana?",
  "¿Qué servicio vende más?",
  "¿Qué clientes debería recuperar?",
  "¿Qué horarios están vacíos?",
  "¿Cuánto vendí por Yape este mes?",
  "¿Cómo vendo más los martes?",
];

export default function AiPage() {
  const db = useDB();
  const navigate = useNavigate();
  const welcome = "Hola. Soy tu copiloto comercial. Consultaré únicamente los datos de este negocio que tus permisos permitan ver.";
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "ai", text: welcome }]);
  const tenant = useRef(db.businessId);
  const [q, setQ] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  useEffect(() => { tenant.current = db.businessId; setMsgs([{ role: "ai", text: welcome }]); setTyping(false); }, [db.businessId]);
  const ask = async (text: string) => {
    if (!text.trim() || typing) return;
    const businessId = db.businessId;
    setMsgs(m => [...m, { role: "user", text }]); setQ(""); setTyping(true);
    const reply = await askCopilot(text);
    if (tenant.current !== businessId) return;
    setMsgs(m => [...m, { role: "ai", text: reply.answer, ai:reply.ai, cta: reply.cta }]); setTyping(false);
  };

  const insights = db.insights.filter((i) => i.status !== "DISMISSED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold tracking-[-0.014em]">Copiloto IA</h1>
        <p className="text-body text-muted">Consultas a datos autorizados · disponibilidad sujeta al proveedor de IA</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Chat */}
        <Card className="lg:col-span-3 flex flex-col h-[640px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Chat</CardTitle>
            <Badge tone="accent">datos autorizados</Badge>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4">
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {m.role === "ai" ? (
                  <div className="h-8 w-8 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                ) : <Avatar name="Tú" size="sm" />}
                <div className={`max-w-[80%] p-3.5 rounded-2xl text-body ${
                  m.role === "user" ? "bg-accent text-on-accent rounded-tr-md" : "bg-subtle rounded-tl-md"
                }`}>
                  {m.text}
                  {m.ai&&<p className="text-micro text-muted mt-2">Nuvia IA</p>}
                  {m.cta && (
                    <button onClick={() => navigate(m.cta!.href)}
                      className="mt-2 flex items-center gap-1.5 text-caption font-semibold text-accent hover:underline">
                      {m.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {typing && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-accent-soft text-accent flex items-center justify-center"><Sparkles className="h-4 w-4" /></div>
                <div className="bg-subtle rounded-2xl px-4 py-3 text-muted text-caption">analizando tus datos…</div>
              </div>
            )}
            <div ref={endRef} />
          </CardContent>
          <div className="p-4 border-t border-hairline space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(0, 3).map((s) => (
                <button key={s} onClick={() => ask(s)} className="px-3 py-1.5 rounded-full bg-subtle text-caption text-muted hover:bg-inset hover:text-ink transition-colors">
                  {s}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregúntale a tu negocio…" />
              <Button type="submit" disabled={!q.trim()}><MessageCircle className="h-4 w-4" /></Button>
            </form>
          </div>
        </Card>

        {/* Insights + sugerencias */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>AI Insights</CardTitle><Badge tone="warning">{insights.length} nuevos</Badge></CardHeader>
            <CardContent className="space-y-3">
              {insights.map((ins) => (
                <motion.div key={ins.id} layout className="p-4 rounded-[var(--radius-tile)] bg-subtle relative">
                  <button onClick={() => { db.dismissInsight(ins.id); toast.success("Insight descartado"); }}
                    className="absolute top-2 right-2 text-faint hover:text-ink" aria-label="Descartar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={ins.severity === "warning" ? "warning" : "accent"}>
                      {ins.severity === "warning" ? <AlertTriangle className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {ins.type === "AT_RISK" ? "Clientes" : ins.type === "WEAK_SLOTS" ? "Demanda" : "Oportunidad"}
                    </Badge>
                  </div>
                  <p className="text-body font-medium pr-4">{ins.title}</p>
                  <p className="text-caption text-muted mt-1">{ins.body}</p>
                  {ins.cta && (
                    <button onClick={() => {
                      if (ins.type === "AT_RISK") navigate("/app/clients");
                      else if (ins.type === "WEAK_SLOTS") navigate("/app/loyalty");
                      else navigate("/app/services");
                      toast.success("Abierto ✓");
                    }} className="text-caption font-semibold text-accent hover:underline mt-2 flex items-center gap-1">
                      {ins.cta} <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </motion.div>
              ))}
              {insights.length === 0 && (
                <p className="text-body text-muted text-center py-6 flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Todo revisado
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Prueba estas preguntas</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="w-full text-left px-3.5 py-2.5 rounded-[var(--radius-control)] text-caption text-muted hover:bg-subtle hover:text-ink transition-colors">
                  “{s}”
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
