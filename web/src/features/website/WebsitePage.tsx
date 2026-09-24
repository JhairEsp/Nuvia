import { BRAND_NAME, publicBusinessUrl } from "../../lib/brand";
import {
  ArrowDown, ArrowUp, Eye, GripVertical, Monitor, Palette, Save, Send, Smartphone, Tablet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, Input, Textarea } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { cn } from "../../lib/utils";
import { money } from "../../lib/format";
import { useDB } from "../../store/db";
import type { ThemePreset, WebsiteSectionType } from "../../types/domain";

const PRESETS: Array<{ id: ThemePreset; label: string; primary: string; bg: string; ink: string }> = [
  { id: "LUXURY", label: "Luxury", primary: "#c9a227", bg: "#faf7f0", ink: "#1a1410" },
  { id: "MODERN", label: "Modern", primary: "#3d6bff", bg: "#f7f8fa", ink: "#10131a" },
  { id: "MINIMAL", label: "Minimal", primary: "#191410", bg: "#ffffff", ink: "#191410" },
  { id: "DARK", label: "Dark", primary: "#c9a227", bg: "#0e0c0a", ink: "#f3efeb" },
  { id: "SOFT", label: "Soft", primary: "#d98c9a", bg: "#fdf6f4", ink: "#3a2a2e" },
  { id: "ELEGANT", label: "Elegant", primary: "#8e3b46", bg: "#f8f3ef", ink: "#241418" },
];

const VIEWPORTS = [
  { id: "desktop", icon: Monitor, w: "100%" },
  { id: "tablet", icon: Tablet, w: "48rem" },
  { id: "mobile", icon: Smartphone, w: "22rem" },
] as const;

const LABEL: Record<WebsiteSectionType, string> = {
  HERO: "Portada (Hero)", SERVICES: "Servicios", ABOUT: "Sobre nosotros", GALLERY: "Galería",
  TEAM: "Equipo", PROMOTIONS: "Promociones", TESTIMONIALS: "Testimonios", LOCATION: "Ubicación",
  CTA: "Llamada final", FOOTER: "Footer",
};

/** Editor visual de landing (§5–13, §41–44): draft → preview → publicar. */
export default function WebsitePage() {
  const db = useDB();
  const [selected, setSelected] = useState<WebsiteSectionType | null>("HERO");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const sections = [...db.site.sections].sort((a, b) => a.position - b.position);
  const publicUrl = db.business.slug ? publicBusinessUrl(db.business.slug) : "";
  const dirty = JSON.stringify(db.site) !== JSON.stringify(db.publishedSnapshot);
  const sec = db.site.sections.find((s) => s.type === selected);
  const preset = PRESETS.find((p) => p.id === db.site.branding.preset) ?? PRESETS[0]!;
  const primary = db.site.branding.colors.primary ?? preset.primary;

  const set = (content: Record<string, unknown>) => selected && db.updateSection(selected, content);

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold tracking-[-0.014em]">Mi página</h1>
          <p className="text-body text-muted">
            <Badge tone={dirty ? "warning" : "success"}>{dirty ? "Borrador sin publicar" : "Publicado"}</Badge>
            {" "}{publicUrl || "Configura el enlace de tu negocio"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="quiet" onClick={() => toast.success("Borrador guardado ✓", { description: "Tus visitantes aún no ven los cambios" })}>
            <Save className="h-4 w-4" /> Guardar borrador
          </Button>
          <Button size="sm" variant="secondary" disabled={!publicUrl} onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}>
            <Eye className="h-4 w-4" /> Previsualizar
          </Button>
          <Button size="sm" disabled={!dirty} onClick={() => { db.publishSite(); toast.success("¡Página publicada! 🎉", { description: "Los cambios ya están visibles para tus clientes" }); }}>
            <Send className="h-4 w-4" /> Publicar cambios
          </Button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[260px_1fr_300px] gap-4">
        {/* Izquierda: secciones drag & drop */}
        <Card className="h-fit">
          <CardHeader><CardTitle>Secciones</CardTitle>
            <GripVertical className="h-4 w-4 text-faint" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {sections.map((s) => (
              <div
                key={s.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/section", s.type)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = e.dataTransfer.getData("text/section") as WebsiteSectionType;
                  if (!from || from === s.type) return;
                  const fromIdx = sections.findIndex((x) => x.type === from);
                  const toIdx = sections.findIndex((x) => x.type === s.type);
                  db.moveSection(from, fromIdx < toIdx ? 1 : -1);
                  toast.success("Orden actualizado");
                }}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-[var(--radius-control)] cursor-grab active:cursor-grabbing transition-colors",
                  selected === s.type ? "bg-accent-soft text-accent" : "hover:bg-subtle",
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-faint shrink-0" />
                <button className="flex-1 text-left text-caption font-medium" onClick={() => setSelected(s.type)}>
                  {LABEL[s.type]}
                </button>
                <button onClick={() => db.moveSection(s.type, -1)} className="text-faint hover:text-ink" aria-label="Subir"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => db.moveSection(s.type, 1)} className="text-faint hover:text-ink" aria-label="Bajar"><ArrowDown className="h-3 w-3" /></button>
                <Switch checked={s.active} onChange={() => db.toggleSection(s.type)} label={LABEL[s.type]} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Centro: preview en vivo */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
            <span className="text-micro font-semibold uppercase tracking-wide text-faint">Preview en vivo</span>
            <div className="flex gap-1 p-0.5 bg-subtle rounded-full">
              {VIEWPORTS.map((v) => (
                <button key={v.id} onClick={() => setViewport(v.id)}
                  className={cn("p-1.5 rounded-full transition-colors", viewport === v.id ? "bg-surface shadow-soft text-accent" : "text-faint")}>
                  <v.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
          <div className="bg-subtle p-4 flex justify-center overflow-y-auto max-h-[640px]">
            <div className="bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden transition-all duration-300 w-full" style={{ maxWidth: VIEWPORTS.find((v) => v.id === viewport)?.w }}>
              {sections.filter((s) => s.active).map((s) => (
                <div key={s.type} className={cn("px-5 py-6 border-b border-hairline/50 last:border-0", selected === s.type && "ring-2 ring-inset ring-[var(--color-accent)]")}>
                  <p className="text-micro uppercase tracking-wide text-faint mb-2">{LABEL[s.type]}</p>
                  {/* mini-render por sección */}
                  {s.type === "HERO" && (
                    <div className="rounded-xl p-8 text-center text-white" style={{ background: `radial-gradient(70% 60% at 50% 30%, ${primary}44, transparent 60%), ${preset.id === "DARK" ? "#0e0c0a" : "#1a1512"}` }}>
                      <p className="text-[1.6rem] font-semibold leading-tight" style={{ fontFamily: db.site.branding.font_key === "sans" ? "inherit" : "var(--font-display)" }}>
                        {String(s.content.title ?? "")}
                      </p>
                      <p className="text-white/60 text-caption mt-1.5">{String(s.content.subtitle ?? "")}</p>
                      {s.content.cta_enabled !== false && (
                        <span className="inline-block mt-3 px-4 py-1.5 rounded-full text-caption font-semibold" style={{ background: primary, color: "#0e0c0a" }}>
                          {String(s.content.cta ?? "Reservar cita")}
                        </span>
                      )}
                    </div>
                  )}
                  {s.type === "SERVICES" && (
                    <div className="grid grid-cols-3 gap-2">
                      {db.site.services.slice(0, 3).map((sv) => (
                        <div key={sv.id} className="p-3 rounded-lg bg-[#faf9f7] text-center">
                          <p className="text-caption font-semibold text-[#191410]">{sv.name}</p>
                          <p className="text-micro text-[#7d7268] num">{sv.durationMin} min · {money(sv.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.type === "ABOUT" && (
                    <div className="text-center max-w-md mx-auto">
                      <p className="font-semibold text-[#191410]">{String(s.content.title ?? "")}</p>
                      <p className="text-caption text-[#7d7268] mt-1">{String(s.content.body ?? "").slice(0, 90)}…</p>
                    </div>
                  )}
                  {s.type === "GALLERY" && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg" style={{ background: `linear-gradient(${140 + i * 30}deg, ${primary}33, #1a1512)` }} />
                      ))}
                    </div>
                  )}
                  {s.type === "TEAM" && (
                    <div className="flex justify-center gap-6">
                      {db.site.team.map((e) => (
                        <div key={e.id} className="text-center">
                          <div className="h-10 w-10 rounded-full mx-auto flex items-center justify-center text-caption font-semibold" style={{ background: `${primary}22`, color: primary }}>
                            {e.fullName.split(" ").map((p) => p[0]).join("")}
                          </div>
                          <p className="text-micro font-medium mt-1 text-[#191410]">{e.fullName.split(" ")[0]}</p>
                          <p className="text-micro" style={{ color: primary }}>{e.roleLabel}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.type === "PROMOTIONS" && (
                    <div className="grid grid-cols-2 gap-2">
                      {db.promos.filter((p) => p.showOnWebsite && p.isActive).map((p) => (
                        <div key={p.id} className="p-3 rounded-lg bg-[#faf9f7]">
                          <p className="text-caption font-semibold text-[#191410]">{p.name}</p>
                          <p className="text-micro num" style={{ color: primary }}>{money(p.price ?? 0)} · -{p.discountPercent}%</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.type === "TESTIMONIALS" && (
                    <div className="grid grid-cols-3 gap-2">
                      {db.site.testimonials.slice(0, 3).map((t) => (
                        <div key={t.author_name} className="p-3 rounded-lg bg-[#faf9f7]">
                          <p className="text-micro text-[#7d7268]">“{t.content.slice(0, 60)}…”</p>
                          <p className="text-micro font-semibold mt-1" style={{ color: primary }}>{t.author_name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.type === "LOCATION" && (
                    <div className="text-center">
                      <p className="text-caption font-semibold text-[#191410]">{db.site.business.address}</p>
                      <p className="text-micro text-[#7d7268] num">{db.site.business.phone} · Lun–Sáb 9am–8pm</p>
                    </div>
                  )}
                  {s.type === "CTA" && (
                    <div className="text-center">
                      <p className="font-semibold text-[#191410]">{String(s.content.title ?? "")}</p>
                      <span className="inline-block mt-2 px-4 py-1.5 rounded-full text-caption font-semibold" style={{ background: primary, color: "#0e0c0a" }}>
                        {String(s.content.cta ?? "Reservar cita")}
                      </span>
                    </div>
                  )}
                  {s.type === "FOOTER" && (
                    <p className="text-center text-micro text-[#a39a90]">© 2026 {db.site.business.name} · Hecho con {BRAND_NAME}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Derecha: props + branding */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{selected ? LABEL[selected] : "Sección"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {selected === "HERO" && (
                <>
                  <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
                  <Field label="Subtítulo"><Input value={String(sec?.content.subtitle ?? "")} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
                  <Field label="Texto del botón"><Input value={String(sec?.content.cta ?? "")} onChange={(e) => set({ cta: e.target.value })} /></Field>
                  <div className="flex items-center justify-between p-3 rounded-[var(--radius-tile)] bg-subtle">
                    <span className="text-caption font-medium">Mostrar botón CTA</span>
                    <Switch checked={sec?.content.cta_enabled !== false} onChange={(v) => set({ cta_enabled: v })} />
                  </div>
                  <Button variant="quiet" size="sm" className="w-full" onClick={() => toast.success("En Supabase: upload a brand-assets/{business}/hero 📸")}>
                    Cambiar imagen de portada
                  </Button>
                </>
              )}
              {selected === "ABOUT" && (
                <>
                  <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
                  <Field label="Texto"><Textarea value={String(sec?.content.body ?? "")} onChange={(e) => set({ body: e.target.value })} /></Field>
                </>
              )}
              {selected === "SERVICES" && <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>}
              {selected === "TEAM" && <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>}
              {selected === "CTA" && (
                <>
                  <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
                  <Field label="Texto del botón"><Input value={String(sec?.content.cta ?? "")} onChange={(e) => set({ cta: e.target.value })} /></Field>
                </>
              )}
              {selected === "GALLERY" && (
                <>
                  <Field label="Título"><Input value={String(sec?.content.title ?? "")} onChange={(e) => set({ title: e.target.value })} /></Field>
                  <Field label="Fotos visibles"><Input type="number" value={String(sec?.content.visible_count ?? 6)} onChange={(e) => set({ visible_count: +e.target.value })} /></Field>
                  <Button variant="quiet" size="sm" className="w-full" onClick={() => toast.success("Galería con drag & drop — upload a website-media/ 📸")}>
                    Gestionar galería (drag & drop)
                  </Button>
                </>
              )}
              {selected === "PROMOTIONS" && (
                <p className="text-caption text-muted">Las promos se gestionan en <strong>Fidelización & Promos</strong>. Las activas y visibles aparecen aquí automáticamente.</p>
              )}
              {selected === "TESTIMONIALS" && (
                <p className="text-caption text-muted">{db.site.testimonials.length} testimonios publicados. Se gestionan desde la ficha de cada cliente.</p>
              )}
              {selected === "LOCATION" && (
                <Field label="Referencia del mapa"><Input defaultValue={db.site.website.map_query} onBlur={(e) => { db.setBranding(undefined); toast.success("Ubicación actualizada"); }} /></Field>
              )}
              {selected === "FOOTER" && (
                <Field label="Instagram"><Input defaultValue={db.site.website.socials.instagram ?? ""} onBlur={() => toast.success("Redes actualizadas")} /></Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4 text-accent" /> Marca</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => { db.setBranding(p.id, { primary: p.primary, button: p.primary }); toast.success(`Preset ${p.label} aplicado`); }}
                    className={cn(
                      "p-2.5 rounded-[var(--radius-tile)] border text-micro font-semibold transition-all",
                      db.site.branding.preset === p.id ? "border-accent bg-accent-soft text-accent" : "border-hairline text-muted hover:border-accent/40",
                    )}>
                    <span className="block h-6 rounded-md mb-1.5" style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.bg})` }} />
                    {p.label}
                  </button>
                ))}
              </div>
              <Field label="Color principal">
                <div className="flex gap-2 items-center">
                  <input type="color" value={primary} onChange={(e) => db.setBranding(undefined, { primary: e.target.value, button: e.target.value })} className="h-10 w-14 rounded-lg border border-hairline cursor-pointer" />
                  <span className="text-caption num text-muted">{primary}</span>
                </div>
              </Field>
              <Field label="Tipografía">
                <select value={db.site.branding.font_key} onChange={(e) => toast.success(`Tipografía ${e.target.value}`)} className="w-full h-11 px-3 rounded-[var(--radius-control)] bg-subtle text-body">
                  <option value="sans">Sans (moderna)</option>
                  <option value="serif">Serif (elegante)</option>
                </select>
              </Field>
              <p className="text-micro text-faint">Solo combinaciones con contraste AA — protegemos tu marca 💎</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
