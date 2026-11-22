import type { Request } from 'express';
import type { AppSettings, UsageQuota } from '../../src/types/visualizer.ts';

interface DailyBucket {
  dayKey: string;
  count: number;
}

const usageByClient = new Map<string, DailyBucket>();

function getUtcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getNextUtcMidnightIso(now = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.toISOString();
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-client';
}

export function getUsageQuota(clientId: string, settings: AppSettings): UsageQuota {
  const today = getUtcDayKey();
  const bucket = usageByClient.get(clientId);
  const usedToday = bucket && bucket.dayKey === today ? bucket.count : 0;
  const limit = settings.dailyLimitPerIp;
  const remaining = Math.max(0, limit - usedToday);

  return {
    usedToday,
    limit,
    remaining,
    enforced: settings.dailyLimitEnabled,
    resetsAt: getNextUtcMidnightIso(),
  };
}

export function checkAndReserveQuota(
  clientId: string,
  settings: AppSettings
): { allowed: boolean; quota: UsageQuota } {
  const today = getUtcDayKey();
  const current = usageByClient.get(clientId);
  const usedToday = current && current.dayKey === today ? current.count : 0;

  if (settings.dailyLimitEnabled && usedToday >= settings.dailyLimitPerIp) {
    return {
      allowed: false,
      quota: getUsageQuota(clientId, settings),
    };
  }

  usageByClient.set(clientId, {
    dayKey: today,
    count: usedToday + 1,
  });

  // Periodic map bound check to avoid unbounded growth
  if (usageByClient.size > 5000) {
    for (const [key, entry] of usageByClient.entries()) {
      if (entry.dayKey !== today) {
        usageByClient.delete(key);
      }
    }
  }

  return {
    allowed: true,
    quota: getUsageQuota(clientId, settings),
  };
}

export function refundQuotaOnFailure(clientId: string): void {
  const today = getUtcDayKey();
  const current = usageByClient.get(clientId);
  if (current && current.dayKey === today && current.count > 0) {
    usageByClient.set(clientId, {
      dayKey: today,
      count: current.count - 1,
    });
  }
}

export function resetQuotaForClient(clientId: string): void {
  usageByClient.delete(clientId);
}
