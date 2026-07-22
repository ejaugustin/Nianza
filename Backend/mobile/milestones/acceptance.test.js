const assert = require("node:assert/strict");
const { buildMilestoneProgress, findMilestone } = require("./library");

function milestone(id, observedAt = "2026-08-02T00:00:00.000Z") {
  return { childId: "child-1", milestoneId: id, observedAt };
}

const now = new Date("2027-01-15T12:00:00.000Z");

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-07-20T00:00:00.000Z"
  };
  const result = buildMilestoneProgress({ child, progressItems: [], now });
  assert.equal(result.currentWindow.ageKey, "12_months");
  assert.deepEqual(result.notTrackedWindows, ["2_months", "4_months", "6_months"]);
  assert.equal(result.rolledOver.some((item) => item.originWindow === "2_months"), false);
  assert.equal(result.rolledOver.some((item) => item.originWindow === "9_months"), true);
  assert.equal(result.shouldOfferBackfill, true);
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-02-01T00:00:00.000Z",
    backfillOffered: true
  };
  const observed = findMilestone("MS-6m-MOV-01");
  assert.ok(observed);
  const result = buildMilestoneProgress({ child, progressItems: [milestone("MS-6m-MOV-01")], now });
  assert.equal(result.notTrackedWindows.length, 0);
  assert.equal(result.rolledOver.some((item) => item.milestoneId === "MS-6m-MOV-01"), false);
  assert.equal(result.shouldOfferBackfill, false);
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    bornEarly: true,
    weeksEarly: 4,
    createdAt: "2026-01-15T00:00:00.000Z"
  };
  const result = buildMilestoneProgress({ child, progressItems: [], now: new Date("2026-07-15T00:00:00.000Z") });
  assert.equal(result.effectiveAgeMonths, 5);
  assert.equal(result.currentWindow.ageKey, "6_months");
}

console.log("milestones acceptance: ok");
