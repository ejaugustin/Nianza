export type PatriciaContextEvent =
  | "general"
  | "home"
  | "milestone-checked"
  | "visit-upcoming"
  | "sick-encounter-active"
  | "vaccines"
  | "reports";

export type ChatContextSeed = {
  source: string;
  childId?: string;
  childName?: string;
  eventType: PatriciaContextEvent;
  entityId?: string;
  title?: string;
  detail?: string;
  occurredAt?: string;
};

export type ChatRouteParams = Record<string, string>;

export function seedToParams(seed: ChatContextSeed): ChatRouteParams {
  return Object.fromEntries(
    Object.entries({
      source: seed.source,
      childId: seed.childId,
      childName: seed.childName,
      eventType: seed.eventType,
      entityId: seed.entityId,
      title: seed.title,
      detail: seed.detail,
      occurredAt: seed.occurredAt
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
  );
}

export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function seedFromParams(params: Record<string, string | string[] | undefined>, fallbackChildName: string): ChatContextSeed {
  return {
    source: one(params.source) || "floating-patricia",
    childId: one(params.childId),
    childName: one(params.childName) || fallbackChildName,
    eventType: (one(params.eventType) as PatriciaContextEvent | undefined) || "general",
    entityId: one(params.entityId),
    title: one(params.title),
    detail: one(params.detail),
    occurredAt: one(params.occurredAt)
  };
}

export function patriciaOpening(seed: ChatContextSeed) {
  const childName = seed.childName || "your child";

  if (seed.eventType === "milestone-checked") {
    return `${childName} ${seed.detail?.toLowerCase() || "did something new"}? Oh, I love hearing that. Tell me what you noticed first.`;
  }

  if (seed.eventType === "visit-upcoming") {
    return `A visit coming up can make your mind feel crowded. Let's sort through what you want to ask about ${childName}, one thing at a time.`;
  }

  if (seed.eventType === "sick-encounter-active") {
    return `I'm here with you. Tell me what's been happening with ${childName}, and we'll keep the notes clear while you decide what needs a clinician.`;
  }

  if (seed.eventType === "vaccines") {
    return `You're looking at ${childName}'s vaccine notes. Tell me what feels unclear, and we'll put it in plain words.`;
  }

  if (seed.eventType === "reports") {
    return `You're gathering records for ${childName}. Tell me what you need this report to make easier.`;
  }

  if (seed.eventType === "home" && seed.detail) {
    return `I saw the note you were reading about ${childName}. What part do you want to talk through?`;
  }

  return "Hello. I'm Patricia. I've been with a lot of new parents over the years, and I'm glad you're here. What's on your mind?";
}

export function mockTranscriptFromSeed(seed: ChatContextSeed) {
  const childName = seed.childName || "my child";

  if (seed.eventType === "milestone-checked") {
    return `I noticed ${childName} ${seed.detail?.toLowerCase() || "doing something new"}, and I want to understand what to watch for next.`;
  }

  if (seed.eventType === "visit-upcoming") {
    return `I want to prepare a few clear questions for ${childName}'s visit.`;
  }

  if (seed.eventType === "sick-encounter-active") {
    return `${childName} has been off today, and I want help organizing what I should pay attention to.`;
  }

  return `I want to talk through something I noticed with ${childName} today.`;
}
