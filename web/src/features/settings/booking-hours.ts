import { supabase } from '../../lib/supabase';

export type BookingHour = { weekday: number; open_time: string; close_time: string; is_closed: boolean };
export type StoredBookingHour = BookingHour & { location_id: string | null };
export const BOOKING_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Misma precedencia que get_public_availability: sucursal > horario general, por día.
 * Un cierre explícito de sucursal NO debe caer al horario general. No inventar aperturas. */
export function effectiveBookingHours(rows: StoredBookingHour[], locationId: string): BookingHour[] {
  return BOOKING_DAYS.map((_, weekday) => {
    const row = rows.find(h => h.weekday === weekday && h.location_id === locationId)
      ?? rows.find(h => h.weekday === weekday && h.location_id === null);
    return { weekday, open_time: row?.open_time?.slice(0, 5) ?? '', close_time: row?.close_time?.slice(0, 5) ?? '', is_closed: row?.is_closed ?? true };
  });
}
export async function loadBookingHours(businessId: string, locationId: string) {
  const { data, error } = await supabase.from('business_hours')
    .select('location_id,weekday,open_time,close_time,is_closed')
    .eq('business_id', businessId).or(`location_id.eq.${locationId},location_id.is.null`);
  if (error) throw error;
  const rows = (data ?? []) as StoredBookingHour[];
  return { hours: effectiveBookingHours(rows, locationId), configured: rows.length > 0 };
}
export function bookingHoursError(hours: BookingHour[]) {
  const invalid = hours.find(h => !h.is_closed && (!/^\d{2}:\d{2}$/.test(h.open_time) || !/^\d{2}:\d{2}$/.test(h.close_time) || h.close_time <= h.open_time));
  return invalid ? `Revisa la apertura y el cierre de ${BOOKING_DAYS[invalid.weekday]}. El cierre debe ser posterior a la apertura.` : '';
}
