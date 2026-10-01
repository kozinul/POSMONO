export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function Next30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export function Next7DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}
