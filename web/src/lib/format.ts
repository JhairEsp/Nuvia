import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export const money = (n: number) => PEN.format(n).replace("PEN", "S/").replace(/\s/g, " ");
export const moneyShort = (n: number) =>
  n >= 1000 ? `S/${(n / 1000).toFixed(1).replace(".0", "")}k` : `S/${Math.round(n)}`;

export const dayLabel = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return `Hoy · ${format(d, "h:mm a", { locale: es })}`;
  if (isTomorrow(d)) return `Mañana · ${format(d, "h:mm a", { locale: es })}`;
  return format(d, "EEE d MMM · h:mm a", { locale: es });
};

export const timeLabel = (iso: string) => format(parseISO(iso), "h:mm a", { locale: es });
export const dateLabel = (iso: string) => format(parseISO(iso), "d 'de' MMMM", { locale: es });
export const weekdayShort = (iso: string) => format(parseISO(iso), "EEE", { locale: es });
