export function formatMoney(minor: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export function validateRouteSearch(origin: string, destination: string, date: string, today = new Date().toISOString().slice(0, 10)): string | null {
  if (origin.trim().length < 2 || destination.trim().length < 2) return 'Enter an origin and destination.';
  if (origin.trim().toLocaleLowerCase() === destination.trim().toLocaleLowerCase()) return 'Choose a different arrival city.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return 'Choose a valid date from today onwards.';
  return null;
}
