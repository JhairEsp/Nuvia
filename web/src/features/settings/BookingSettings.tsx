import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input, Label } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { useCapabilities } from '../../store/capabilities';
import { useSession, usePermission } from '../../store/session';
import { useDB } from '../../store/db';
import { BOOKING_DAYS, bookingHoursError, loadBookingHours, type BookingHour } from './booking-hours';

type Rules = { slot_minutes: number; min_lead_minutes: number; cancel_window_hours: number; rebooking_days: number };
const DEFAULT_RULES: Rules = { slot_minutes: 30, min_lead_minutes: 60, cancel_window_hours: 12, rebooking_days: 28 };
const RULE_FIELDS = [
  ['slot_minutes', 'Intervalo entre horas disponibles (min)', 5],
  ['min_lead_minutes', 'Anticipación mínima (min)', 0],
  ['cancel_window_hours', 'Cancelación sin costo hasta (h antes)', 0],
  ['rebooking_days', 'Recordatorio de rebooking (días)', 1],
] as const;
const message = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'No se pudo guardar. Revisa la conexión e intenta nuevamente.';

export default function BookingSettings() {
  const bid = useSession(s => s.businessId);
  return bid ? <BookingSettingsForBusiness key={bid} bid={bid} /> : null;
}
function BookingSettingsForBusiness({ bid }: { bid: string }) {
  const canManage = usePermission('settings.manage');
  const cap = useCapabilities();
  const branches = cap.businessId === bid ? cap.branches : [];
  const scope = useDB(s => s.locationId);
  const timezone = useDB(s => s.business.timezone);
  const employees = useDB(s => s.employees);
  const services = useDB(s => s.services);
  const [choice, setChoice] = useState('');
  const branch = branches.find(b => b.id === choice) ?? branches.find(b => b.id === scope) ?? branches.find(b => b.is_default) ?? branches[0];
  const locationId = branch?.id;
  const [hours, setHours] = useState<BookingHour[]>([]);
  const [configured, setConfigured] = useState(false);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [hoursReady, setHoursReady] = useState('');
  const [rulesReady, setRulesReady] = useState(false);
  const [hoursError, setHoursError] = useState('');
  const [rulesError, setRulesError] = useState('');
  const [hoursRetry, setHoursRetry] = useState(0);
  const [rulesRetry, setRulesRetry] = useState(0);
  const [savingHours, setSavingHours] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const saving = useRef(false);
  const generation = useRef(0);
  const busy = savingHours || savingRules;

  useEffect(() => { if (cap.businessId !== bid && !cap.loading) void useCapabilities.getState().refresh(bid); }, [bid, cap.businessId, cap.loading]);
  useEffect(() => {
    const token = ++generation.current;
    setHoursReady(''); setHoursError(''); setHours([]); setConfigured(false);
    if (locationId) void loadBookingHours(bid, locationId).then(result => {
      if (generation.current !== token) return;
      setHours(result.hours); setConfigured(result.configured); setHoursReady(locationId);
    }).catch(error => { if (generation.current === token) setHoursError(message(error)); });
    return () => { generation.current++; };
  }, [bid, locationId, hoursRetry]);
  useEffect(() => {
    let active = true; setRulesReady(false); setRulesError('');
    void (async () => {
      try {
        const { data, error } = await supabase.from('business_settings').select('slot_minutes,min_lead_minutes,cancel_window_hours,rebooking_days').eq('business_id', bid).maybeSingle();
        if (error) throw error;
        if (active) { setRules(data ?? DEFAULT_RULES); setRulesReady(true); }
      } catch (error) { if (active) setRulesError(message(error)); }
    })();
    return () => { active = false; };
  }, [bid, rulesRetry]);

  const saveHours = async () => {
    if (!canManage || !locationId || hoursReady !== locationId || saving.current) return;
    const invalid = bookingHoursError(hours);
    if (invalid) { setHoursError(invalid); return; }
    saving.current = true; setSavingHours(true); setHoursError('');
    const token = generation.current;
    try {
      // save_branch es atómico y comprueba settings.manage, tenant y siete días en servidor.
      // Leer datos actuales para no enviar metadatos antiguos del store al guardar solo horas.
      const latest = await supabase.from('locations').select('id,name,address,city,phone,active').eq('business_id', bid).eq('id', locationId).single();
      if (latest.error) throw latest.error;
      if (token !== generation.current || useSession.getState().businessId !== bid) return;
      const { data, error } = await supabase.rpc('save_branch', { p_business_id: bid, p_id: locationId, p_data: { ...latest.data, hours } });
      if (error) throw error;
      if (data !== locationId) throw new Error('No recibimos confirmación del guardado. Recarga para verificar los horarios.');
      if (token === generation.current) { setConfigured(true); toast.success('Horarios guardados. Ya se usan en las reservas públicas.'); }
    } catch (error) { if (token === generation.current) setHoursError(message(error)); }
    finally { saving.current = false; setSavingHours(false); }
  };
  const saveRules = async () => {
    if (!canManage || !rulesReady || saving.current) return;
    if (RULE_FIELDS.some(([key, , min]) => !Number.isInteger(rules[key]) || rules[key] < min)) {
      setRulesError('Usa minutos y días enteros válidos: intervalo mínimo 5 minutos, anticipación/cancelación desde 0 y rebooking desde 1 día.'); return;
    }
    saving.current = true; setSavingRules(true); setRulesError('');
    try {
      // La tabla existente aplica RLS settings.manage por business_id. No hay service_role en el cliente.
      const { data, error } = await supabase.from('business_settings').upsert({ business_id: bid, ...rules }, { onConflict: 'business_id' }).select('business_id').single();
      if (error) throw error;
      if (data?.business_id !== bid) throw new Error('No recibimos confirmación del guardado. Recarga para verificar las reglas.');
      if (useSession.getState().businessId === bid) toast.success('Reglas de reserva guardadas');
    } catch (error) { if (useSession.getState().businessId === bid) setRulesError(message(error)); }
    finally { saving.current = false; setSavingRules(false); }
  };
  const online = employees.filter(e => e.locationId === locationId && e.active !== false && e.showOnWebsite);
  const unassigned = online.filter(e => !e.serviceIds?.length);
  const uncovered = services.filter(s => s.locationId === locationId && s.active && s.showOnWebsite && !online.some(e => e.serviceIds?.includes(s.id)));
  const changeHour = (weekday: number, patch: Partial<BookingHour>) => setHours(list => list.map(h => h.weekday === weekday ? { ...h, ...patch } : h));
  return <>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" />Horarios de atención</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-body text-muted">Estos horarios se guardan en el negocio y se usan directamente para reservar, sin volver a publicar la página. Zona horaria: {timezone}.</p>
        {cap.error && <p role="alert">{cap.error}</p>}
        <div><Label htmlFor="hours-branch">Sucursal de estos horarios</Label><select id="hours-branch" className="w-full rounded-xl bg-subtle p-3" value={locationId ?? ''} disabled={busy || !branches.length} onChange={e => setChoice(e.target.value)}>{!branches.length && <option value="">Sin sucursales cargadas</option>}{branches.map(b => <option key={b.id} value={b.id}>{b.name}{!b.active ? ' (inactiva)' : ''}</option>)}</select></div>
        {!locationId ? <Link to="/app/settings/branches" className="text-accent underline">Revisar sucursales</Link> : hoursReady !== locationId ? <p role="status">{hoursError ? 'No pudimos cargar los horarios.' : 'Cargando horarios guardados…'}</p> : <>
          {!configured && <p role="status" className="rounded-xl bg-subtle p-4 text-body">No hay horarios guardados para esta sucursal. Activa los días de atención, indica apertura y cierre y guarda. Sin este horario, el calendario público no puede ofrecer citas.</p>}
          {!branch?.active && <p className="text-body text-danger">Esta sucursal está inactiva. Actívala en Sucursales para permitir reservas públicas.</p>}
          <fieldset disabled={!canManage || busy} className="space-y-2">
            {hours.map(h => <div key={h.weekday} className="flex flex-wrap items-center gap-3 rounded-xl bg-subtle p-3">
              <label className="flex items-center gap-2 text-body font-medium w-32"><input type="checkbox" aria-label={`Abierto ${BOOKING_DAYS[h.weekday]}`} checked={!h.is_closed} onChange={e => changeHour(h.weekday, { is_closed: !e.target.checked })} />{BOOKING_DAYS[h.weekday]}</label>
              {h.is_closed ? <span className="text-caption text-muted">Cerrado</span> : <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                <div className="min-w-0"><Label htmlFor={`hours-open-${h.weekday}`}>Apertura</Label><Input id={`hours-open-${h.weekday}`} aria-label={`Apertura ${BOOKING_DAYS[h.weekday]}`} className="min-w-0 sm:w-40 h-10 px-2" type="time" required value={h.open_time} onChange={e => changeHour(h.weekday, { open_time: e.target.value })} /></div>
                <div className="min-w-0"><Label htmlFor={`hours-close-${h.weekday}`}>Cierre</Label><Input id={`hours-close-${h.weekday}`} aria-label={`Cierre ${BOOKING_DAYS[h.weekday]}`} className="min-w-0 sm:w-40 h-10 px-2" type="time" required value={h.close_time} onChange={e => changeHour(h.weekday, { close_time: e.target.value })} /></div>
              </div>}
            </div>)}
            <Button loading={savingHours} onClick={() => void saveHours()}>Guardar horarios</Button>
          </fieldset>
          <div className="rounded-xl border border-hairline p-4 text-body space-y-2">
            <p>Para ofrecer una hora libre también debe haber un profesional activo y visible asignado a todos los servicios elegidos.</p>
            {online.length === 0 && <p className="text-danger">No hay profesionales activos y visibles en esta sucursal.</p>}
            {uncovered.length > 0 && <p className="text-danger">Servicios sin profesional habilitado: {uncovered.map(s => s.name).join(', ')}.</p>}
            {unassigned.length > 0 && <p className="text-danger">{unassigned.length} {unassigned.length === 1 ? 'profesional visible sin servicios asignados' : 'profesionales visibles sin servicios asignados'}: {unassigned.map(e => e.fullName).join(', ')}.</p>}
            <Link to="/app/team" className="text-accent underline">Revisar servicios de los profesionales →</Link>
          </div>
        </>}
        {hoursError && <div className="space-y-2"><p role="alert" className="text-danger">{hoursError}</p>{hoursReady !== locationId && <Button variant="quiet" onClick={() => setHoursRetry(v => v + 1)}>Reintentar horarios</Button>}</div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-4 w-4 text-accent" />Reglas de reserva</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-body text-muted">Aplican a todo el negocio. La anticipación mínima oculta las horas demasiado próximas, incluso si no hay citas ese día.</p>
        {!rulesReady ? <p role="status">{rulesError ? 'No pudimos cargar las reglas.' : 'Cargando reglas guardadas…'}</p> : <fieldset disabled={!canManage || busy} className="grid sm:grid-cols-2 gap-3">{RULE_FIELDS.map(([key, label, min]) => <div key={key}><Label htmlFor={`rule-${key}`}>{label}</Label><Input id={`rule-${key}`} type="number" min={min} step={1} value={Number.isNaN(rules[key]) ? '' : rules[key]} onChange={e => setRules(current => ({ ...current, [key]: e.target.value === '' ? NaN : Number(e.target.value) }))} /></div>)}<div className="sm:col-span-2"><Button loading={savingRules} onClick={() => void saveRules()}>Guardar reglas</Button></div></fieldset>}
        {rulesError && <div className="space-y-2"><p role="alert" className="text-danger">{rulesError}</p>{!rulesReady && <Button variant="quiet" onClick={() => setRulesRetry(v => v + 1)}>Reintentar reglas</Button>}</div>}
      </CardContent>
    </Card>
  </>;
}
