import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Drawer } from "../../components/ui/overlay";
import { Field, Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { dateLabel, dayLabel, money, timeLabel, weekdayShort } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { Employee, Service } from "../../types/domain";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS = ["Servicio", "Profesional", "Fecha", "Hora", "Tus datos", "Confirmar"];

/** Flujo §15: SERVICIO → PROFESIONAL → FECHA → HORA → NOMBRE → WHATSAPP → CONFIRMAR (sin cuenta). */
export default function BookingDrawer({
  open,
  onClose,
  services: initialServices,
  presetService,
  team: initialTeam,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  services: Service[];
  presetService?: Service | null;
  team: Employee[];
  slug: string;
}) {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; timezone?: string; services: Service[]; team: Employee[] }>>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [saving, setSaving] = useState(false);
  const branch = branches.find(b => b.id === locationId);
  const services = branch?.services ?? initialServices;
  const team = branch?.team ?? initialTeam;
  const timezone = branch?.timezone ?? "America/Lima";
  const slotDate = (s: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(s));
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBookingError("");
    void (async () => {
      const r = await supabase.rpc("get_public_branches", { p_slug: slug });
      if (!active) return;
      if (r.error) { setBookingError(r.error.message); return; }
      const list = (r.data ?? []) as typeof branches;
      setBranches(list);
      const chosen = list.find(b => b.services.some(s => s.id === presetService?.id)) ?? list[0];
      setLocationId(chosen?.id ?? null);
      setSelected(presetService && chosen?.services.some(s => s.id === presetService.id) ? [presetService] : []);
      setEmployee(null); setDay(null); setSlot(null); setAddons([]);
    })();
    return () => { active = false; };
  }, [open, slug, presetService?.id]);
  const [step, setStep] = useState<Step>(0);
  const [selected, setSelected] = useState<Service[]>(presetService ? [presetService] : []);
  const [addons, setAddons] = useState<Service[]>([]);
  const [employee, setEmployee] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  useEffect(() => {
    const ids = [...selected, ...addons].map((x) => x.id);
    if (!open || !slug || !locationId || ids.length === 0) { setSlots([]); return; }
    let active = true;
    void (async () => {
      const out: string[] = [];
      for (let d = 1; d <= 7; d++) {
        const day = new Date();
        day.setDate(day.getDate() + d);
        const iso = slotDate(day.toISOString());
        const { data, error } = await supabase.rpc("get_public_availability", {
          p_slug: slug, p_date: iso, p_service_ids: ids, p_employee_id: employee, p_location_id: locationId,
        });
        if (error) { if (active) setBookingError(error.message); return; }
        const arr: unknown[] = Array.isArray(data) ? data : [];
        arr.forEach((x) => {
          const t = typeof x === "string" ? x
            : typeof x === "object" && x ? String((x as { starts_at?: string }).starts_at ?? (x as { start?: string; slot?: string; time?: string }).start ?? (x as { slot?: string }).slot ?? (x as { time?: string }).time ?? "")
            : "";
          if (!t) return;
          out.push(t);
        });
      }
      if (active) { setSlots([...new Set(out)]); setBookingError(""); }
    })();
    return () => { active = false; };
  }, [open, slug, employee, selected, addons, locationId]);
  const days = useMemo(() => [...new Set(slots.map(slotDate))], [slots, timezone]);
  const hoursForDay = (d: string) => slots.filter((s) => slotDate(s) === d);
  const total = [...selected, ...addons].reduce((s, x) => s + x.price, 0);

  const reset = () => {
    setStep(0);
    setSelected(presetService ? [presetService] : []);
    setAddons([]);
    setEmployee(null);
    setDay(null);
    setSlot(null);
    setName("");
    setPhone("");
    setDone(false);
  };

  const close = () => {
    onClose();
    setTimeout(reset, 320);
  };

  const toggle = (list: Service[], setList: (v: Service[]) => void, s: Service) => {
    setList(list.some((x) => x.id === s.id) ? list.filter((x) => x.id !== s.id) : [...list, s]);
  };

  const canNext =
    step === 0 ? selected.length > 0 && !!locationId && !bookingError
    : step === 1 ? true // "Cualquiera" es una elección válida
    : step === 2 ? day !== null
    : step === 3 ? slot !== null
    : step === 4 ? name.trim().length > 2 && phone.trim().length >= 9
    : true;

  const confirm = () => {
    if (saving) return;
    setSaving(true);
    void (async () => {
      try {
      const ids = [...selected, ...addons].map((x) => x.id);
      const { error } = await supabase.rpc("create_booking", {
        p_slug: slug, p_service_ids: ids, p_employee_id: employee,
        p_location_id: locationId, p_start: new Date(slot ?? "").toISOString(), p_name: name.trim(), p_phone: phone.trim(), p_notes: "",
      });
      if (error) {
        toast.error("No se pudo reservar", { description: error.message });
        return;
      }
      setDone(true);
      toast.success("¡Reserva registrada!");
      } finally { setSaving(false); }
    })();
  };

  const mainServices = services.filter((s) => s.price >= 25);
  const upsells = services.filter((s) => s.price < 25);

  return (
    <Drawer open={open} onClose={close} side="bottom" className="sm:max-w-xl sm:mx-auto sm:bottom-0">
      <div className="p-6 sm:p-8">
        {!done && <div className="mb-5 space-y-2"><Field label="Sucursal"><select aria-label="Sucursal para reservar" className="w-full rounded-xl bg-subtle p-3" value={locationId ?? ""} disabled={saving} onChange={e => { setLocationId(e.target.value); setSelected([]); setAddons([]); setEmployee(null); setDay(null); setSlot(null); setStep(0); }}><option value="" disabled>Selecciona una sucursal</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>{bookingError && <p role="alert" className="text-caption text-danger">{bookingError}</p>}</div>}
        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10 space-y-4"
          >
            <div className="h-20 w-20 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
              <Check className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-title font-semibold tracking-[-0.014em]">¡Listo, {name.split(" ")[0]}!</h2>
            <p className="text-body text-muted max-w-sm mx-auto">
              Tu cita de <strong className="text-ink">{selected[0]?.name}{addons.length ? " + extras" : ""}</strong>{" "}
              está registrada. {slot && dayLabel(slot)} con {team.find((e) => e.id === employee)?.fullName ?? "tu profesional"}.
            </p>
            <p className="text-caption text-faint">El negocio podrá comunicarse contigo al número registrado.</p>
            <Button onClick={close} className="mt-4">Hecho</Button>
          </motion.div>
        ) : (
          <>
            {/* Progreso */}
            <div className="flex items-center gap-1.5 mb-6">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors duration-300",
                      i <= step ? "bg-accent" : "bg-inset",
                    )}
                  />
                  <p className={cn("text-micro mt-1.5 hidden sm:block", i === step ? "text-accent font-semibold" : "text-faint")}>
                    {s}
                  </p>
                </div>
              ))}
            </div>

            <div className="min-h-[280px]">
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">¿Qué te vas a hacer hoy?</h2>
                  <div className="space-y-2">
                    {mainServices.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggle(selected, setSelected, s)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-[var(--radius-tile)] border transition-all duration-200 text-left",
                          selected.some((x) => x.id === s.id)
                            ? "border-accent bg-accent-soft"
                            : "border-hairline bg-surface hover:border-accent/40",
                        )}
                      >
                        <div className="flex-1">
                          <p className="text-body font-semibold">{s.name}</p>
                          <p className="text-caption text-muted">{s.durationMin} min</p>
                        </div>
                        <span className="text-body font-semibold num">{money(s.price)}</span>
                      </button>
                    ))}
                  </div>
                  {upsells.length > 0 && selected.length > 0 && (
                    <div>
                      <p className="text-caption font-semibold text-accent flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3.5 w-3.5" /> Completa tu servicio
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {upsells.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => toggle(addons, setAddons, s)}
                            className={cn(
                              "px-4 py-2 rounded-full border text-caption font-medium transition-all duration-200",
                              addons.some((x) => x.id === s.id)
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-hairline text-muted hover:border-accent/40",
                            )}
                          >
                            + {s.name} · {money(s.price)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">Elige a tu profesional</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setEmployee(null)}
                      className={cn(
                        "p-4 rounded-[var(--radius-tile)] border text-center transition-all duration-200",
                        employee === null ? "border-accent bg-accent-soft" : "border-hairline hover:border-accent/40",
                      )}
                    >
                      <p className="text-2xl">✨</p>
                      <p className="text-caption font-semibold mt-1">Cualquiera</p>
                    </button>
                    {team.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEmployee(e.id)}
                        className={cn(
                          "p-4 rounded-[var(--radius-tile)] border text-center transition-all duration-200",
                          employee === e.id ? "border-accent bg-accent-soft" : "border-hairline hover:border-accent/40",
                        )}
                      >
                        <div className="h-12 w-12 rounded-full bg-accent-soft text-accent font-semibold flex items-center justify-center mx-auto">
                          {e.fullName.split(" ").map((p) => p[0]).join("")}
                        </div>
                        <p className="text-caption font-semibold mt-2">{e.fullName.split(" ")[0]}</p>
                        <p className="text-micro text-faint">{e.roleLabel}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">¿Qué día te viene bien?</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {days.map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setDay(d);
                          setSlot(null);
                        }}
                        className={cn(
                          "px-3 py-4 rounded-[var(--radius-tile)] border text-caption font-medium transition-all duration-200",
                          day === d ? "border-accent bg-accent-soft text-accent" : "border-hairline hover:border-accent/40",
                        )}
                      >
                        {dateLabel(d)}
                        <span className="block text-micro text-faint mt-0.5">{weekdayShort(d)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">Elige tu horario</h2>
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                    {(day ? hoursForDay(day) : []).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "px-3 py-3 rounded-[var(--radius-tile)] border text-body font-medium num transition-all duration-200",
                          slot === s ? "border-accent bg-accent-soft text-accent" : "border-hairline hover:border-accent/40",
                        )}
                      >
                        {timeLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">¿A nombre de quién?</h2>
                  <Field label="Nombre">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="María Fernández" />
                  </Field>
                  <Field label="WhatsApp">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="987 654 321" inputMode="tel" />
                  </Field>
                  <p className="text-caption text-faint">
                    Solo lo usamos para confirmar tu cita. Sin cuentas, sin spam. ✓
                  </p>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <h2 className="text-headline font-semibold">Confirma tu reserva</h2>
                  <div className="p-5 rounded-[var(--radius-tile)] bg-subtle space-y-2.5">
                    {[...selected, ...addons].map((s) => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-body">{s.name} · {s.durationMin} min</span>
                        <span className="text-body font-semibold num">{money(s.price)}</span>
                      </div>
                    ))}
                    <div className="border-t border-hairline pt-2.5 flex justify-between">
                      <span className="text-body font-semibold">Total</span>
                      <span className="text-headline font-semibold num">{money(total)}</span>
                    </div>
                    <p className="text-caption text-muted num">
                      {slot && dayLabel(slot)} · {team.find((e) => e.id === employee)?.fullName ?? "Cualquier profesional"} · {name} · {phone}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navegación */}
            <div className="flex items-center gap-3 mt-8">
              {step > 0 && (
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}>
                  <ArrowLeft className="h-4 w-4" /> Atrás
                </Button>
              )}
              <div className="flex-1" />
              {step < 5 ? (
                <Button disabled={!canNext} onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={confirm} loading={saving}>Confirmar reserva</Button>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
