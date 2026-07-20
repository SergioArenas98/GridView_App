export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export class FixedClock implements Clock {
  constructor(private readonly value: Date) {}

  now(): Date {
    return new Date(this.value.getTime());
  }
}

export function isoNow(clock: Clock): string {
  return clock.now().toISOString();
}

export function addSeconds(date: string | Date, seconds: number): string {
  const millis = typeof date === 'string' ? Date.parse(date) : date.getTime();
  return new Date(millis + seconds * 1000).toISOString();
}

export function secondsBetween(from: string, to: Date): number | null {
  const fromMillis = Date.parse(from);
  if (Number.isNaN(fromMillis)) return null;
  return Math.max(0, Math.floor((to.getTime() - fromMillis) / 1000));
}
