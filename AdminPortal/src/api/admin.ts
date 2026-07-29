import { adminApiClient } from "./client";

// ─── Users ──────────────────────────────────────────────────────────────────
// GET /users, GET /users/{userId}, POST /users/{userId}/disable,
// POST /users/{userId}/delete. Never returns vitals, milestone detail, or
// conversation content -- this is a support view, not a surveillance tool.

export type UserSummary = {
  userId: string;
  email: string | null;
  firstName: string | null;
  language: string | null;
  subscriptionStatus: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  createdAt: string | null;
  accountStatus: string | null;
  enabled: boolean;
  childCount: number | null;
};

export type ChildSummary = { childId: string; firstName: string | null; correctedAgeMonths: number | null; dateOfBirth: string | null };

export type UserDetail = {
  user: { userId: string; email: string | null; firstName: string | null; language: string | null; accountStatus: string | null; enabled: boolean; createdAt: string | null };
  children: ChildSummary[];
  subscriptionStatus: string | null;
  notificationLog: unknown[];
};

export async function listUsers(params: { subscriptionStatus?: string; language?: string; limit?: number } = {}): Promise<{ users: UserSummary[]; count: number }> {
  const response = await adminApiClient.get<{ users: UserSummary[]; count: number }>("/users", { params });
  return response.data;
}

export async function getUser(userId: string): Promise<UserDetail> {
  const response = await adminApiClient.get<UserDetail>(`/users/${encodeURIComponent(userId)}`);
  return response.data;
}

export async function disableUser(userId: string, reason: string): Promise<void> {
  await adminApiClient.post(`/users/${encodeURIComponent(userId)}/disable`, { reason });
}

export async function initiateUserDeletion(userId: string, reason: string, legalBasis: string): Promise<{ note: string }> {
  const response = await adminApiClient.post<{ note: string }>(`/users/${encodeURIComponent(userId)}/delete`, { reason, legalBasis });
  return response.data;
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export type SubscriptionSummary = { userId: string; email: string | null; language: string | null; subscriptionStatus: string | null; trialStartedAt: string | null; trialEndsAt: string | null };
export type SubscriptionTotals = { trialing: number; active: number; expired: number; cancelled: number };

export async function listSubscriptions(params: { status?: string; language?: string } = {}): Promise<{ subscriptions: SubscriptionSummary[]; totals: SubscriptionTotals; churnRate: number | null }> {
  const response = await adminApiClient.get<{ subscriptions: SubscriptionSummary[]; totals: SubscriptionTotals; churnRate: number | null }>("/subscriptions", { params });
  return response.data;
}

export async function extendTrial(userId: string, extensionDays: number, reason: string): Promise<{ trialEndsAt: string }> {
  const response = await adminApiClient.post<{ trialEndsAt: string }>(`/subscriptions/${encodeURIComponent(userId)}/extend-trial`, { extensionDays, reason });
  return response.data;
}

// ─── Notifications & Broadcast ──────────────────────────────────────────────

export type NotificationLogEntry = { notificationType: string; createdAt: string; segment: string; title: string; body: string; targetCount: number; sent: number; failed: number; triggeredBy: string; deliveryNote?: string };

export async function listNotifications(params: { notificationType?: string; startDate?: string; endDate?: string } = {}): Promise<{ notifications: NotificationLogEntry[]; count: number }> {
  const response = await adminApiClient.get<{ notifications: NotificationLogEntry[]; count: number }>("/notifications", { params });
  return response.data;
}

export type BroadcastInput = { segment: string; title: string; body: string; dryRun: boolean };

export async function sendBroadcast(input: BroadcastInput): Promise<{ targetCount: number; dryRun?: boolean; sent?: number; failed?: number; note?: string }> {
  const response = await adminApiClient.post("/notifications/broadcast", input);
  return response.data;
}

// ─── SSM Parameters & AI/Voice controls ────────────────────────────────────

export type SsmParameter = { name: string; value: string; type: string; lastModifiedAt: string | null };

export async function listSsmParameters(): Promise<{ parameters: SsmParameter[] }> {
  const response = await adminApiClient.get<{ parameters: SsmParameter[] }>("/ssm");
  return response.data;
}

export async function writeSsmParameter(paramName: string, value: string, reason: string): Promise<void> {
  // paramName includes leading slash, e.g. /nianza/tts-approved/en -- axios
  // will URL-encode each segment, and the {paramName+} greedy path param on
  // the API Gateway side reassembles it.
  await adminApiClient.put(`/ssm${paramName}`, { value, reason });
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export type AdminMetrics = {
  users: { total: number; trialing: number; active: number; expired: number; cancelled: number; newThisPeriod: number };
  revenue: {
    projectedMrr: number;
    projectedArr: number;
    activeMonthlyCount: number;
    activeAnnualCount: number;
    pricing: { monthly: number; annual: number; trialDays: number };
    note: string;
  };
  children: { total: number; avgPerUser: number };
  content: { total: number; approved: number; pendingReview: number };
  notifications: { sentThisPeriod: number; deliveryRate: number | null };
  reports: { generatedThisPeriod: number };
};

export async function getMetrics(period: "today" | "week" | "month" | "all" = "all"): Promise<AdminMetrics> {
  const response = await adminApiClient.get<AdminMetrics>("/metrics", { params: { period } });
  return response.data;
}

// ─── Billing (NZA-ADMIN-v1.1 SS3, real RevenueCat-fed data) ────────────────
// Replaces the old metrics.revenue projection (still served by GET /metrics
// for now, untouched, but no longer what the Dashboard renders -- see
// dashboard.tsx). mrr/arr/atRiskMrr are real once RevenueCat's webhook is
// connected and events start landing; all-zero + source:"live" with no
// events yet is the honest pre-connection state, not an estimate.

export type BillingSummary = {
  version: string;
  mrr: number;
  arr: number;
  atRiskMrr: number;
  activeMonthlyCount: number;
  activeAnnualCount: number;
  trialingCount: number;
  billingIssueCount: number;
  pricing: { monthly: number; annual: number; annualMonthlyEquivalent: number };
  cachedAt: string | null;
  source: "cache" | "live";
};

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await adminApiClient.get<BillingSummary>("/billing/summary");
  return response.data;
}

export type BillingEvent = {
  userId: string;
  eventId: string;
  eventTimestamp: string;
  eventType: string;
  productId: string | null;
  normalizedProductId: "monthly" | "annual" | null;
  price: number | null;
  currency: string | null;
  store: string | null;
  environment: string | null;
  expirationAt: string | null;
};

export async function listBillingEvents(params: { eventType?: string; limit?: number } = {}): Promise<{ events: BillingEvent[]; count: number }> {
  const response = await adminApiClient.get<{ events: BillingEvent[]; count: number }>("/billing/events", { params });
  return response.data;
}

export type FailedPaymentUser = {
  userId: string;
  email: string | null;
  subscriptionStatus: string | null;
  currentProductId: string | null;
  currentPeriodEndsAt: string | null;
  billingIssueSince: string;
};

export async function listFailedPayments(): Promise<{ users: FailedPaymentUser[]; count: number }> {
  const response = await adminApiClient.get<{ users: FailedPaymentUser[]; count: number }>("/billing/failed-payments");
  return response.data;
}

// ─── Portal Users (admin accounts) & Active Sessions ───────────────────────

export type PortalUser = { userId: string; email: string; role: string | null; status: string | null; createdAt: string | null; lastLoginAt: string | null };

export async function listPortalUsers(): Promise<{ users: PortalUser[] }> {
  const response = await adminApiClient.get<{ users: PortalUser[] }>("/portal-users");
  return response.data;
}

export async function createPortalUser(input: { email: string; role: "content_editor" | "operations"; firstName?: string }): Promise<{ user: PortalUser }> {
  const response = await adminApiClient.post<{ user: PortalUser }>("/portal-users", input);
  return response.data;
}

export async function disablePortalUser(adminUserId: string): Promise<void> {
  await adminApiClient.post(`/portal-users/${encodeURIComponent(adminUserId)}/disable`);
}

export type AdminSessionRow = { adminUserId: string; sessionId: string; adminEmail: string; loginAt: string; lastActiveAt: string; ipAddress: string | null; isActive: boolean };

export async function listActiveSessions(): Promise<{ sessions: AdminSessionRow[] }> {
  const response = await adminApiClient.get<{ sessions: AdminSessionRow[] }>("/sessions");
  return response.data;
}

export async function terminateSession(sessionId: string, adminUserId: string): Promise<void> {
  await adminApiClient.post(`/sessions/${encodeURIComponent(sessionId)}/terminate`, { adminUserId });
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  adminUserId: string;
  actionId: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  targetId: string;
  targetType: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  result: string;
  timestamp: string;
};

export async function listAuditLog(params: { action?: string; adminUserId?: string; startDate?: string; endDate?: string } = {}): Promise<{ entries: AuditLogEntry[]; count: number }> {
  const response = await adminApiClient.get<{ entries: AuditLogEntry[]; count: number }>("/audit", { params });
  return response.data;
}

// ─── Reference Data (NZA-ADMIN-v1.1 SS2.1) ─────────────────────────────────

export type ReferenceDataItem = {
  referenceKey: string;
  liveExists: boolean;
  lastUpdatedAt: string | null;
  sourceVerifiedBy: { reviewer: string; verifiedAt: string } | null;
  hasStagedVersion: boolean;
  downloadUrl: string | null;
};

export async function listReferenceData(): Promise<{ items: ReferenceDataItem[] }> {
  const response = await adminApiClient.get<{ items: ReferenceDataItem[] }>("/reference-data");
  return response.data;
}

export async function uploadReferenceData(key: string, content: string): Promise<{ diff: { previousCount: number | null; nextCount: number; delta: number | null } }> {
  const response = await adminApiClient.post(`/reference-data/${encodeURIComponent(key)}/upload`, { content });
  return response.data;
}

export async function publishReferenceData(key: string, sourceVerifiedBy: string): Promise<void> {
  await adminApiClient.post(`/reference-data/${encodeURIComponent(key)}/publish`, { sourceVerifiedBy });
}

// ─── Golden-Harness sign-off (NZA-ADMIN-v1.1 SS2.2) ────────────────────────

export type HarnessScenarioResult = {
  scenarioId: string;
  transcript: { role: "parent" | "patricia"; text: string }[];
  assertions: { name: string; passed: boolean; detail?: string }[];
};

export type HarnessRun = {
  runId: string;
  triggeringChange: string;
  createdAt: string;
  passed: boolean;
  signedBy: string | null;
  signedAt: string | null;
  scenarios: HarnessScenarioResult[];
};

export type HarnessRunSummary = Omit<HarnessRun, "scenarios">;

export async function listHarnessRuns(): Promise<{ runs: HarnessRunSummary[] }> {
  const response = await adminApiClient.get<{ runs: HarnessRunSummary[] }>("/harness-runs");
  return response.data;
}

export async function getHarnessRun(runId: string): Promise<{ run: HarnessRun }> {
  const response = await adminApiClient.get<{ run: HarnessRun }>(`/harness-runs/${encodeURIComponent(runId)}`);
  return response.data;
}

export async function signHarnessRun(runId: string): Promise<void> {
  await adminApiClient.post(`/harness-runs/${encodeURIComponent(runId)}/sign`);
}

// ─── Engagement (NZA-ADMIN-v2 SS1) ─────────────────────────────────────────

export type EngagementMetrics = {
  metrics: {
    totalUsers: number;
    avgDau: number;
    totalChatSessionsInPeriod: number;
    avgSessionLength: number;
    newUsersInPeriod: number;
  };
  dauTrend: { date: string; dau: number }[];
  note: string;
};

export async function getEngagementMetrics(period: "7d" | "30d" | "90d" = "30d"): Promise<EngagementMetrics> {
  const response = await adminApiClient.get<EngagementMetrics>("/engagement/metrics", { params: { period } });
  return response.data;
}

// ─── System Health (NZA-ADMIN-v2 page map) ─────────────────────────────────

export type FunctionHealth = { functionName: string; invocations24h: number; errors24h: number; errorRate: number; status: "healthy" | "watch" | "degraded" };

export async function getSystemHealth(): Promise<{ functions: FunctionHealth[]; windowHours: number }> {
  const response = await adminApiClient.get<{ functions: FunctionHealth[]; windowHours: number }>("/system-health");
  return response.data;
}
