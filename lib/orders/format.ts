// Formatowanie z dokładnych groszy (string/BigInt/number) bez konwersji przez float dla dużych sum.
export function formatPln(cents: string | number | bigint): string {
  const v = BigInt(cents);
  const abs = v < 0n ? -v : v;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${v < 0n ? "-" : ""}${whole},${frac}\u00a0zł`;
}
