import { ArrowLeft, ArrowRight, Check, Clock, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Drawer } from '../../components/ui/overlay';
import { Input, Label, Textarea } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { money } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { Employee, Service } from '../../types/domain';

type Branch = { id: string; name: string; address?: string; timezone?: string; services: Service[]; team: Employee[] };
type Receipt = { appointment_id: string; total: number; starts_at: string; ends_at: string };
const STEPS = ['Servicio', 'Fecha y hora', 'Tus datos', 'Confirmar'];
const dateKey = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};
const calendarLabel = (key: string, short = false) => new Intl.DateTimeFormat('es-PE', {
  timeZone: 'UTC', weekday: short ? 'short' : 'long', day: 'numeric', month: 'short',
}).format(new Date(`${key}T12:00:00Z`));
const safeTimezone = (timezone?: string) => {
  try { new Intl.DateTimeFormat('es', { timeZone: timezone || 'America/Lima' }); return timezone || 'America/Lima'; }
  catch { return 'America/Lima'; }
};
const errorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : '';

/** Catálogo y disponibilidad vivos: el release publicado nunca decide si se puede reservar. */
export default function BookingDrawer({ open, onClose, presetService, slug }: {
  open: boolean; onClose: () => void; presetService?: Service | null; slug: string;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locationId, setLocationId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Service[]>([]);
  const [employee, setEmployee] = useState('');
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const [availability, setAvailability] = useState({ key: '', loading: false, slots: [] as string[], error: '' });
  const [slotsRetry, setSlotsRetry] = useState(0);
  const branch = branches.find(b => b.id === locationId);
  const timezone = safeTimezone(branch?.timezone);
  const today = dateKey(new Date(), timezone);
  const services = branch?.services ?? [];
  const team = branch?.team ?? [];
  const serviceKey = selected.map(s => s.id).sort().join(',');
  const availabilityKey = [slug, locationId, serviceKey, employee, day, slotsRetry].join('|');
  const slots = availability.key === availabilityKey ? availability.slots : [];
  const slotsLoading = availability.key !== availabilityKey || availability.loading;
  const slotsError = availability.key === availabilityKey ? availability.error : '';
  const timeLabel = (iso: string) => new Intl.DateTimeFormat('es-PE', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const duration = selected.reduce((sum, s) => sum + s.durationMin, 0);
  const normalizedPhone = phone.trim().replace(/[\s().-]/g, '');
  const contactValid = name.trim().length >= 2 && /^(?:9\d{8}|\+[1-9]\d{7,14})$/.test(normalizedPhone);
  const serviceValid = !!branch && selected.length > 0 && team.length > 0 && !catalogLoading && !catalogError;
  const slotValid = serviceValid && !!slot && slots.includes(slot) && !slotsLoading && !slotsError && new Date(slot).getTime() > Date.now();
  const canNext = step === 0 ? serviceValid : step === 1 ? slotValid : contactValid;
  const close = () => { if (!submitting.current) onClose(); };

  // Reset on opening, not in a delayed close callback that could erase a reopened form.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBranches([]); setLocationId(''); setSelected([]); setEmployee(''); setDay(''); setSlot('');
    setStep(0); setName(''); setPhone(''); setNotes(''); setReceipt(null); setBookingError(''); setUncertain(false);
    setNotice(''); setCatalogLoading(true); setCatalogError('');
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_branches', { p_slug: slug });
        if (!active) return;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Catálogo inválido');
        const list = (data as Branch[]).filter(b => b && typeof b.id === 'string' && Array.isArray(b.services) && Array.isArray(b.team))
          .map(b => ({ ...b, services: b.services.filter(s => s.active !== false && s.showOnWebsite !== false && Number.isFinite(s.price) && s.price >= 0 && s.durationMin > 0) }));
        const chosen = list.find(b => b.services.some(s => s.id === presetService?.id)) ?? list.find(b => b.services.length && b.team.length) ?? list[0];
        const preset = chosen?.services.find(s => s.id === presetService?.id);
        setBranches(list); setLocationId(chosen?.id ?? ''); setSelected(preset ? [preset] : []);
        setDay(dateKey(new Date(), safeTimezone(chosen?.timezone)));
        if (presetService && !preset) setNotice('Ese servicio ya no está disponible. Elige otro del catálogo actual.');
      } catch {
        if (active) setCatalogError('No pudimos cargar los servicios. Revisa tu conexión e intenta nuevamente.');
      } finally { if (active) setCatalogLoading(false); }
    })();
    return () => { active = false; };
  }, [open, slug, presetService?.id, catalogRetry]);

  useEffect(() => {
    if (!open || !locationId || !serviceKey || !day || day < today || receipt) return;
    let active = true;
    setAvailability({ key: availabilityKey, loading: true, slots: [], error: '' });
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_availability', {
          p_slug: slug, p_date: day, p_service_ids: serviceKey.split(','), p_employee_id: employee || null, p_location_id: locationId,
        });
        if (!active) return;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Disponibilidad inválida');
        const times: string[] = data.flatMap((value: { starts_at?: string; location_id?: string; employee_id?: string }) => {
          const iso = value?.starts_at;
          if (typeof iso !== 'string' || !Number.isFinite(Date.parse(iso)) || Date.parse(iso) <= Date.now()) return [];
          if (value.location_id !== locationId || (employee && value.employee_id !== employee) || dateKey(new Date(iso), timezone) !== day) return [];
          return [new Date(iso).toISOString()];
        });
        setAvailability({ key: availabilityKey, loading: false, slots: [...new Set(times)].sort(), error: '' });
      } catch {
        if (active) setAvailability({ key: availabilityKey, loading: false, slots: [], error: 'No pudimos consultar los horarios. Intenta nuevamente.' });
      }
    })();
    return () => { active = false; };
  }, [open, slug, locationId, serviceKey, employee, day, today, timezone, availabilityKey, receipt]);

  // Keep keyboard navigation inside this drawer and restore focus to the booking CTA.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') ?? [])].filter(el => el.offsetParent !== null);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (!panel.current?.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); opener?.focus(); };
  }, [open]);

  const changeBranch = (id: string) => {
    const next = branches.find(b => b.id === id);
    setLocationId(id); setSelected([]); setEmployee(''); setSlot(''); setStep(0); setNotice(''); setBookingError('');
    setDay(dateKey(new Date(), safeTimezone(next?.timezone)));
  };
  const confirm = async () => {
    if (submitting.current || receipt || uncertain || !slotValid || !contactValid) return;
    submitting.current = true; setSaving(true); setBookingError('');
    try {
      const { data, error } = await supabase.rpc('create_booking', {
        p_slug: slug, p_service_ids: selected.map(s => s.id), p_employee_id: employee || null,
        p_location_id: locationId, p_start: slot, p_name: name.trim(), p_phone: normalizedPhone, p_notes: notes.trim(),
      });
      if (error) {
        const message = errorMessage(error);
        if (/horario.*(?:disponible|ocupado)/i.test(message)) {
          setSlot(''); setSlotsRetry(v => v + 1); setStep(1);
          setBookingError('Ese horario acaba de ocuparse o ya no está disponible. Elige otro; conservamos tus datos.');
        } else if (!error.code || /fetch|network|timeout|connection/i.test(message)) {
          setUncertain(true);
          setBookingError('Se interrumpió la respuesta. No podemos asegurar si la reserva se guardó. Contacta al negocio antes de volver a reservar para evitar duplicados.');
        } else setBookingError(message || 'No se pudo registrar tu reserva. Intenta nuevamente.');
        return;
      }
      if (!data || typeof data.appointment_id !== 'string' || !data.appointment_id.trim() || !Number.isFinite(Number(data.total)) || !Number.isFinite(Date.parse(data.starts_at)) || !Number.isFinite(Date.parse(data.ends_at))) {
        setUncertain(true);
        setBookingError('No recibimos una confirmación válida. Contacta al negocio antes de volver a reservar para evitar duplicados.');
        return;
      }
      setReceipt({ ...data, total: Number(data.total) });
    } catch {
      setUncertain(true);
      setBookingError('Se interrumpió la conexión al enviar. Contacta al negocio para verificar tu reserva antes de repetirla.');
    } finally { submitting.current = false; setSaving(false); }
  };

  return <Drawer open={open} onClose={close} side="bottom" labelledBy="booking-title" className="sm:max-w-xl sm:mx-auto sm:bottom-0">
    <div ref={panel} className="p-5 sm:p-8 text-ink">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div><p className="text-caption text-muted mb-1">Sin cuenta · Directo con el negocio</p><h2 id="booking-title" className="text-title font-semibold">{receipt ? '¡Reserva registrada!' : 'Reserva tu cita'}</h2></div>
        <Button variant="quiet" size="icon" aria-label="Cerrar reserva" disabled={saving} onClick={close}><X className="h-5 w-5" /></Button>
      </div>
      {receipt ? <div className="space-y-5" role="status">
        <div className="h-16 w-16 rounded-full bg-accent-soft text-accent flex items-center justify-center"><Check className="h-8 w-8" /></div>
        <p className="text-body">{name.trim()}, tu solicitud quedó registrada. Está pendiente de confirmación por el negocio.</p>
        <div className="rounded-2xl bg-subtle p-5 space-y-2">
          <p className="font-semibold">{calendarLabel(dateKey(new Date(receipt.starts_at), timezone))} · {timeLabel(receipt.starts_at)}</p>
          <p>{branch?.name}{branch?.address ? ` · ${branch.address}` : ''}</p>
          <p className="text-body">{selected.map(s => s.name).join(' + ')}</p>
          <p className="text-body">Total registrado: <strong>{money(receipt.total)}</strong></p>
          <p className="text-caption text-muted break-all">Código de reserva: {receipt.appointment_id}</p>
        </div>
        <p className="text-caption text-muted">Guarda tu código para consultar o solicitar cambios directamente al negocio. No se realizó ningún cobro.</p>
        <Button onClick={close} className="w-full">Listo</Button>
      </div> : <>
        <ol aria-label="Pasos de la reserva" className="grid grid-cols-4 gap-2 mb-6">
          {STEPS.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={cn('text-caption border-t-2 pt-2', index <= step ? 'border-accent text-accent' : 'border-hairline text-faint')}><span className="font-semibold">{index + 1}.</span> {label}</li>)}
        </ol>
        {bookingError && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-4 text-body mb-5">{bookingError}</p>}
        {catalogLoading ? <p role="status" className="py-8 text-muted">Cargando servicios disponibles…</p>
          : catalogError ? <div className="space-y-4"><p role="alert">{catalogError}</p><Button onClick={() => setCatalogRetry(v => v + 1)}>Reintentar servicios</Button></div>
          : !branches.length ? <div className="space-y-3 py-4"><h3 className="text-headline font-semibold">Sin sucursales disponibles para reservar</h3><p className="text-body text-muted">Contacta al negocio para coordinar tu cita. No se ha creado ninguna reserva.</p><Button variant="quiet" onClick={() => setCatalogRetry(v => v + 1)}>Actualizar servicios</Button></div>
          : <fieldset disabled={saving || uncertain} className="min-w-0 space-y-5">
            {step === 0 && <>
              {notice && <p role="status" className="text-body text-muted">{notice}</p>}
              <div><Label htmlFor="booking-branch">Sucursal</Label><select id="booking-branch" className="w-full rounded-xl bg-subtle p-3" value={locationId} onChange={e => changeBranch(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                {branch?.address && <p className="text-caption text-muted mt-2 flex gap-1"><MapPin className="h-4 w-4 shrink-0" />{branch.address}</p>}
              </div>
              <div><h3 className="text-headline font-semibold">¿Qué servicio quieres?</h3><p className="text-caption text-muted mt-1">Puedes elegir uno o varios. Precios actuales del negocio.</p></div>
              {!services.length ? <p role="status" className="rounded-xl bg-subtle p-4 text-body">Esta sucursal aún no tiene servicios disponibles para reservar online. Prueba otra sucursal o contacta al negocio.</p>
                : <div className="space-y-2">{services.map(s => {
                  const checked = selected.some(v => v.id === s.id);
                  return <button key={s.id} type="button" aria-pressed={checked} className={cn('w-full text-left flex items-center gap-3 p-4 border rounded-2xl transition-colors', checked ? 'border-accent bg-accent-soft' : 'border-hairline hover:bg-subtle')} onClick={() => { setSelected(values => checked ? values.filter(v => v.id !== s.id) : [...values, s]); setSlot(''); setBookingError(''); }}>
                    <span className={cn('h-6 w-6 rounded-full border flex items-center justify-center shrink-0', checked ? 'bg-accent text-on-accent border-accent' : 'border-hairline')}>{checked && <Check className="h-4 w-4" />}</span>
                    <span className="flex-1 min-w-0"><span className="block text-body font-semibold">{s.name}</span><span className="block text-caption text-muted">{s.durationMin} min{s.description ? ` · ${s.description}` : ''}</span></span>
                    <span className="text-body font-semibold whitespace-nowrap">{money(s.price)}</span>
                  </button>;
                })}</div>}
              {services.length > 0 && (team.length ? <div><Label htmlFor="booking-employee">Profesional</Label><select id="booking-employee" className="w-full rounded-xl bg-subtle p-3" value={employee} onChange={e => { setEmployee(e.target.value); setSlot(''); setBookingError(''); }}><option value="">Cualquier profesional disponible</option>{team.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select><p className="text-caption text-muted mt-2">Mostraremos horarios de quienes atienden todos los servicios elegidos.</p></div>
                : <p role="status" className="rounded-xl bg-subtle p-4 text-body">Esta sucursal aún no tiene profesionales habilitados para reservas online. Contacta al negocio.</p>)}
            </>}
            {step === 1 && <>
              <div><h3 className="text-headline font-semibold">Elige fecha y hora</h3><p className="text-caption text-muted mt-1">Horarios del negocio · {timezone}. Duración: {duration} min.</p></div>
              <div className="grid grid-cols-4 gap-2">{Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((key, index) => <button key={key} type="button" aria-pressed={day === key} className={cn('rounded-xl border p-2 text-caption min-h-12', day === key ? 'border-accent bg-accent-soft text-accent' : 'border-hairline')} onClick={() => { setDay(key); setSlot(''); }}>{index === 0 ? 'Hoy' : calendarLabel(key, true)}</button>)}</div>
              <div><Label htmlFor="booking-date">O elige otra fecha</Label><Input id="booking-date" type="date" min={today} value={day} onChange={e => { setDay(e.target.value); setSlot(''); }} /></div>
              {!day || day < today ? <p role="status">Elige una fecha a partir de hoy.</p>
                : slotsLoading ? <p role="status" className="text-muted py-4">Consultando horarios reales…</p>
                : slotsError ? <div className="space-y-3"><p role="alert">{slotsError}</p><Button variant="quiet" onClick={() => setSlotsRetry(v => v + 1)}>Reintentar horarios</Button></div>
                : !slots.length ? <div role="status" className="rounded-xl bg-subtle p-4 space-y-2"><p className="font-semibold">No hay horarios disponibles para esta fecha.</p><p className="text-body text-muted">La disponibilidad depende del horario de atención, los servicios del profesional y la anticipación mínima, no solo de las citas existentes. Prueba otro día o cualquier profesional; si sigue sin haber horas, contacta al negocio.</p><Button variant="ghost" onClick={() => setSlotsRetry(v => v + 1)}>Actualizar horarios</Button></div>
                : <div><p className="text-caption font-semibold mb-3">Horas disponibles</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{slots.map(value => <button key={value} type="button" aria-pressed={slot === value} className={cn('rounded-xl border p-3 text-body font-medium', slot === value ? 'border-accent bg-accent-soft text-accent' : 'border-hairline hover:border-accent/40')} onClick={() => { setSlot(value); setBookingError(''); }}>{timeLabel(value)}</button>)}</div></div>}
            </>}
            {step === 2 && <>
              <h3 className="text-headline font-semibold">¿A nombre de quién?</h3>
              <div><Label htmlFor="booking-name">Nombre completo</Label><Input id="booking-name" autoComplete="name" value={name} maxLength={120} required onChange={e => setName(e.target.value)} placeholder="Tu nombre y apellido" /></div>
              <div><Label htmlFor="booking-phone">Teléfono o WhatsApp</Label><Input id="booking-phone" type="tel" autoComplete="tel" value={phone} maxLength={30} required aria-describedby="booking-phone-help" onChange={e => setPhone(e.target.value)} placeholder="987 654 321" /><p id="booking-phone-help" className="text-caption text-muted mt-2">Perú: 9 dígitos empezando por 9. Otro país: +código de país y número.</p>{phone && !/^(?:9\d{8}|\+[1-9]\d{7,14})$/.test(normalizedPhone) && <p className="text-caption text-danger mt-1">Escribe un teléfono válido para que el negocio pueda contactarte.</p>}</div>
              <div><Label htmlFor="booking-notes">Nota para el negocio (opcional)</Label><Textarea id="booking-notes" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} placeholder="¿Hay algo que debamos saber para tu cita?" /></div>
              <p className="text-caption text-muted">Compartiremos estos datos con el negocio para gestionar tu cita. No necesitas crear una cuenta.</p>
            </>}
            {step === 3 && <>
              <h3 className="text-headline font-semibold">Revisa tu reserva</h3>
              <div className="rounded-2xl bg-subtle p-5 space-y-3">
                {selected.map(s => <div key={s.id} className="flex justify-between gap-3 text-body"><span>{s.name} · {s.durationMin} min</span><strong className="whitespace-nowrap">{money(s.price)}</strong></div>)}
                <div className="border-t border-hairline pt-3 flex justify-between font-semibold"><span>Total</span><span>{money(total)}</span></div>
                <p className="text-body flex gap-2"><Clock className="h-4 w-4 shrink-0 mt-1" />{day && calendarLabel(day)} · {slot && timeLabel(slot)} · {duration} min</p>
                <p className="text-caption text-muted">Hora del negocio: {timezone}</p>
                <p className="text-body">{branch?.name}{branch?.address ? ` · ${branch.address}` : ''}</p>
                <p className="text-body">{team.find(e => e.id === employee)?.fullName ?? 'Cualquier profesional disponible'}</p>
                <p className="text-body break-words">{name.trim()} · {normalizedPhone}</p>
                {notes.trim() && <p className="text-body whitespace-pre-wrap break-words">Nota: {notes.trim()}</p>}
              </div>
              <p className="text-caption text-muted">La solicitud quedará pendiente de confirmación por el negocio. No se cobra online. El horario se vuelve a verificar al confirmar.</p>
            </>}
            {selected.length > 0 && step < 3 && <div className="flex justify-between gap-3 border-t border-hairline pt-4 text-body"><span>{selected.length} {selected.length === 1 ? 'servicio' : 'servicios'} · {duration} min</span><strong>{money(total)}</strong></div>}
            <div className="flex items-center gap-3 pt-3">
              {step > 0 && <Button variant="ghost" onClick={() => { setStep(s => s - 1); setBookingError(''); }}><ArrowLeft className="h-4 w-4" />Atrás</Button>}
              <div className="flex-1" />
              {step < 3 ? <Button disabled={!canNext} onClick={() => setStep(s => s + 1)}>Continuar<ArrowRight className="h-4 w-4" /></Button>
                : <Button loading={saving} disabled={!slotValid || !contactValid} onClick={() => void confirm()}>{saving ? 'Registrando…' : 'Confirmar reserva'}</Button>}
            </div>
          </fieldset>}
      </>}
    </div>
  </Drawer>;
}
