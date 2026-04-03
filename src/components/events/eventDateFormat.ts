export function formatEventDateOnly(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
  } catch {
    return dateStr;
  }
}
