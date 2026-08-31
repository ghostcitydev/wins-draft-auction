export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function fmtSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toFixed(decimals);
  return n > 0 ? `+${s}` : s;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${Math.round(n)}`;
}

export function fmtSignedMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const rounded = Math.round(n);
  return rounded > 0 ? `+$${rounded}` : `-$${Math.abs(rounded)}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
