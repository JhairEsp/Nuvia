import { BRAND_NAME } from "../../lib/brand";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, Clock, MapPin, MessageCircle, Music2, Navigation, Phone, Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { money } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { EMPTY_SITE, publicSiteFromSnapshot } from "../../store/db";
import type { PublicSite, Service, WebsiteSectionType } from "../../types/domain";
import BookingDrawer from "./BookingDrawer";

const ease: [number, number, number, number] = [0.32, 0.72, 0, 1];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ duration: 0.6, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Landing pública · /b/:slug — render del snapshot publicado (§5–15, DECISIÓN 4/8). */
export default function LandingPage() {
  const { slug } = useParams();
  const [site, setSite] = useState<PublicSite>(EMPTY_SITE);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_public_site", { p_slug: slug ?? "" });
      setSite(publicSiteFromSnapshot((data ?? null) as Record<string, unknown> | null) ?? EMPTY_SITE);
      setLoaded(true);
    })();
  }, [slug]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preset, setPreset] = useState<Service | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const sections = useMemo(
    () => site.sections.filter((s) => s.active).sort((a, b) => a.position - b.position),
    [site.sections],
  );

  const openBooking = (s?: Service) => {
    setPreset(s ?? null);
    setBookingOpen(true);
  };

  const gold = site.branding.colors.primary ?? "#c9a227";
  const c = (s: Record<string, unknown>, k: string, fb = "") => (s[k] as string) ?? fb;

  const render: Record<WebsiteSectionType, (content: Record<string, unknown>) => React.ReactNode> = {
    HERO: (content) => (
      <section ref={heroRef} className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#0e0c0a] text-[#f3efeb]">
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(70% 60% at 50% 30%, ${gold}33, transparent 60%), radial-gradient(50% 40% at 80% 80%, ${gold}22, transparent 55%), #0e0c0a`,
            }}
          />
          <div className="absolute inset-0 opacity-[0.5] [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:72px_72px]" />
        </motion.div>
        <div className="relative text-center px-6 max-w-3xl mx-auto space-y-8">
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
            className="text-caption tracking-[0.3em] uppercase" style={{ color: gold }}
          >
            {site.business.name}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease }}
            className="font-[family-name:var(--font-display)] leading-[1.05] tracking-[-0.01em]"
            style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)" }}
          >
            {c(content, "title", "Tu estilo comienza aquí.")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25, ease }}
            className="text-headline text-white/60 font-light max-w-xl mx-auto"
          >
            {c(content, "subtitle", site.website.tagline)}
          </motion.p>
          {c(content, "cta_enabled", "true") === "true" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4, ease }}
            >
              <Button size="lg" onClick={() => openBooking()} style={{ background: gold, color: "#0e0c0a" }} className="hover:opacity-90">
                {c(content, "cta", "Reservar cita")} <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </section>
    ),

    SERVICES: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#f7f4ef] text-[#191410]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-center mb-12" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Nuestros servicios")}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {site.services.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.07}>
                <div className="h-full p-6 rounded-2xl bg-white border border-[#e8e2db] shadow-[0_1px_2px_rgba(25,20,16,.04)] hover:shadow-[0_16px_48px_rgba(25,20,16,.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  <h3 className="text-headline font-semibold">{s.name}</h3>
                  <p className="text-caption text-[#7d7268] mt-1.5 flex-1">{s.description}</p>
                  <div className="flex items-center justify-between mt-5">
                    <div>
                      <p className="text-caption text-[#7d7268] num">{s.durationMin} min</p>
                      <p className="text-headline font-semibold num">{money(s.price)}</p>
                    </div>
                    <Button size="sm" onClick={() => openBooking(s)} style={{ background: gold, color: "#0e0c0a" }}>
                      Reservar
                    </Button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    ),

    ABOUT: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#0e0c0a] text-[#f3efeb]">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)]" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Sobre nosotros")}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-headline text-white/60 font-light leading-relaxed">
              {c(content, "body", site.business.description)}
            </p>
          </Reveal>
        </div>
      </section>
    ),

    GALLERY: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#f7f4ef] text-[#191410]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-center mb-12" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Nuestro trabajo")}
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: Number(c(content, "visible_count", "6")) }).map((_, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div
                  className="aspect-[4/5] rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-500"
                  style={{
                    background: `linear-gradient(${145 + i * 25}deg, ${gold}${18 + i * 8}, #1a1512), #1a1512`,
                  }}
                  role="img"
                  aria-label={`Trabajo ${i + 1} de ${site.business.name}`}
                />
              </Reveal>
            ))}
          </div>
          <p className="text-center text-caption text-[#a39a90] mt-6">Sube tus fotos desde el editor → sección Galería</p>
        </div>
      </section>
    ),

    TEAM: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#0e0c0a] text-[#f3efeb]">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-center mb-12" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Nuestro equipo")}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {site.team.map((e, i) => (
              <Reveal key={e.id} delay={i * 0.08}>
                <div className="text-center space-y-3">
                  <div
                    className="h-32 w-32 rounded-full mx-auto flex items-center justify-center text-title font-semibold"
                    style={{ background: `${gold}22`, color: gold }}
                  >
                    {e.fullName.split(" ").map((p) => p[0]).join("")}
                  </div>
                  <div>
                    <p className="text-headline font-semibold">{e.fullName.split(" ")[0]}</p>
                    <p className="text-caption" style={{ color: gold }}>{e.roleLabel}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    ),

    PROMOTIONS: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#f7f4ef] text-[#191410]">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-center mb-12" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Promociones")}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {site.promotions.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className="relative p-8 rounded-2xl bg-white border border-[#e8e2db] overflow-hidden">
                  <Badge tone="accent">-{p.discount_percent}%</Badge>
                  <h3 className="text-title font-semibold mt-3">{p.name}</h3>
                  <p className="text-caption text-[#7d7268] mt-1">{p.description}</p>
                  <div className="flex items-center justify-between mt-6">
                    <p className="text-title font-semibold num" style={{ color: gold }}>{money(p.price ?? 0)}</p>
                    <Button size="sm" onClick={() => openBooking()} style={{ background: gold, color: "#0e0c0a" }}>Reservar</Button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    ),

    TESTIMONIALS: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#0e0c0a] text-[#f3efeb]">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-center mb-12" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
              {c(content, "title", "Testimonios")}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {site.testimonials.map((t, i) => (
              <Reveal key={t.author_name} delay={i * 0.08}>
                <figure className="h-full p-6 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, k) => (
                      <Star key={k} className="h-3.5 w-3.5 fill-current" style={{ color: gold }} />
                    ))}
                  </div>
                  <blockquote className="text-body text-white/80">“{t.content}”</blockquote>
                  <figcaption className="text-caption" style={{ color: gold }}>{t.author_name}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    ),

    LOCATION: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#f7f4ef] text-[#191410]">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-8 items-center">
          <Reveal>
            <div className="space-y-5">
              <h2 className="font-[family-name:var(--font-display)]" style={{ fontSize: "clamp(2rem,4vw,3rem)" }}>
                {c(content, "title", "Visítanos")}
              </h2>
              <p className="flex items-start gap-3 text-body">
                <MapPin className="h-5 w-5 mt-0.5 shrink-0" style={{ color: gold }} />
                {site.business.address}
              </p>
              <p className="flex items-center gap-3 text-body">
                <Phone className="h-5 w-5 shrink-0" style={{ color: gold }} /> {site.business.phone}
              </p>
              <div className="flex items-start gap-3 text-body">
                <Clock className="h-5 w-5 mt-0.5 shrink-0" style={{ color: gold }} />
                <div>
                  {site.hours.map((h) => (
                    <p key={h.weekday} className={cn("num", h.is_closed && "line-through text-[#a39a90]")}>
                      {WEEKDAYS[h.weekday]} · {h.open_time}–{h.close_time}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button size="sm" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(site.website.map_query || site.business.address)}`, "_blank")} style={{ background: gold, color: "#0e0c0a" }}>
                  <Navigation className="h-4 w-4" /> Cómo llegar
                </Button>
                <Button size="sm" variant="secondary" style={{ color: gold, borderColor: `${gold}59` }} onClick={() => window.open(`https://wa.me/${site.business.whatsapp.replace(/\D/g, "")}`, "_blank")}>
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="aspect-[4/3] rounded-2xl bg-[#0e0c0a] flex items-center justify-center text-[#f3efeb]/40 text-caption">
              <MapPin className="h-8 w-8 mb-2" style={{ color: gold }} />
              Mapa · {site.website.map_query || site.business.address}
            </div>
          </Reveal>
        </div>
      </section>
    ),

    CTA: (content) => (
      <section className="py-[clamp(4.5rem,9vw,8rem)] px-6 bg-[#0e0c0a] text-[#f3efeb] text-center">
        <Reveal className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-[family-name:var(--font-display)]" style={{ fontSize: "clamp(2.2rem,5vw,3.5rem)" }}>
            {c(content, "title", "¿Listo para tu próximo look?")}
          </h2>
          <Button size="lg" onClick={() => openBooking()} style={{ background: gold, color: "#0e0c0a" }} className="hover:opacity-90">
            {c(content, "cta", "Reservar cita")} <ArrowRight className="h-4 w-4" />
          </Button>
        </Reveal>
      </section>
    ),

    FOOTER: () => (
      <footer className="px-6 py-12 bg-[#0a0908] text-[#f3efeb]/60 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-caption">
          <p>© {new Date().getFullYear()} {site.business.name} · {site.business.address}</p>
          <div className="flex gap-4">
            {site.website.socials.instagram && (
              <a href={site.website.socials.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:opacity-100 opacity-70 transition-opacity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4.5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
              </a>
            )}
            {site.website.socials.tiktok && (
              <a href={site.website.socials.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className="hover:opacity-100 opacity-70 transition-opacity">
                <Music2 className="h-4 w-4" />
              </a>
            )}
            {site.website.socials.facebook && (
              <a href={site.website.socials.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:opacity-100 opacity-70 transition-opacity">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M14 8h3V5h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.5l.5-3H13V9c0-.6.4-1 1-1z" /></svg>
              </a>
            )}
          </div>
          <p className="opacity-60">Hecho con {BRAND_NAME}</p>
        </div>
      </footer>
    ),
  };

  if (!loaded) {
    return <div className="min-h-screen bg-[#191410] text-white/60 flex items-center justify-center text-body">Cargando…</div>;
  }
  if (site.sections.length === 0) {
    return (
      <div className="min-h-screen bg-[#191410] text-white flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-title font-semibold tracking-[-0.014em]">{site.business.name || "Este negocio"}</p>
        <p className="text-body text-white/60">Aún no publica su página. ¡Vuelve pronto!</p>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f4ef]">
      {/* Nav flotante glass */}
      <nav className="fixed top-0 inset-x-0 z-40 glass border-b border-hairline">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-6">
          <span className="font-semibold text-caption tracking-wide">{site.business.name}</span>
          <Button size="sm" onClick={() => openBooking()} style={{ background: gold, color: "#0e0c0a" }}>
            Reservar
          </Button>
        </div>
      </nav>

      <div className="pt-14">
        {sections.map((s) => (
          <div key={s.type}>{render[s.type](s.content)}</div>
        ))}
      </div>

      {/* FAB WhatsApp */}
      <a
        href={`https://wa.me/${site.business.whatsapp.replace(/\D/g, "")}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-[var(--shadow-float)] hover:scale-105 transition-transform"
      >
        <MessageCircle className="h-6 w-6" />
      </a>

      <BookingDrawer open={bookingOpen} onClose={() => setBookingOpen(false)} services={site.services} presetService={preset} team={site.team} slug={slug ?? ""} />
      {!slug && null}
    </div>
  );
}
