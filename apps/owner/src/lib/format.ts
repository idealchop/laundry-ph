const whole = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₱8,450 or ₱227.50 */
export function peso(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}₱${Number.isInteger(abs) ? whole.format(abs) : cents.format(abs)}`;
}

/** "6.5 kg", "12 pcs" */
export function qty(value: number, unit: "kg" | "pc"): string {
  return unit === "kg" ? `${value} kg` : `${value} ${value === 1 ? "pc" : "pcs"}`;
}
