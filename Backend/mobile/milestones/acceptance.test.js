const assert = require("node:assert/strict");
const { buildMilestoneProgress, findActEarly, findMilestone, isCelebratoryProgress } = require("./library");

function milestone(id, observedAt = "2026-08-02T00:00:00.000Z") {
  return { childId: "child-1", milestoneId: id, observedAt };
}

function watchFor(id, observedAt = "2026-08-02T00:00:00.000Z", cleared = false) {
  return { childId: "child-1", milestoneId: id, actEarlyId: id, progressType: "watch-for", observedAt, cleared };
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
  assert.equal(result.watchFor.some((item) => item.originWindow === "2_months"), false);
  assert.equal(result.watchFor.some((item) => item.originWindow === "9_months"), true);
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

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-01-15T00:00:00.000Z"
  };
  const found = findActEarly("AE-9m-01");
  assert.ok(found);
  const result = buildMilestoneProgress({
    child,
    progressItems: [watchFor("AE-9m-01", "2026-10-02T00:00:00.000Z")],
    now: new Date("2026-10-15T00:00:00.000Z")
  });
  const checkedItem = result.watchFor.find((item) => item.actEarlyId === "AE-9m-01");
  assert.equal(checkedItem.status, "checked");
  assert.equal(checkedItem.checkedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(result.currentWindow.milestones.some((item) => item.status === "observed"), false);
  assert.equal(isCelebratoryProgress(watchFor("AE-9m-01")), false);
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-01-15T00:00:00.000Z"
  };
  const result = buildMilestoneProgress({
    child,
    progressItems: [
      watchFor("AE-9m-01", "2026-10-02T00:00:00.000Z"),
      watchFor("AE-9m-01", "2026-10-03T00:00:00.000Z", true)
    ],
    now: new Date("2026-10-15T00:00:00.000Z")
  });
  const uncheckedItem = result.watchFor.find((item) => item.actEarlyId === "AE-9m-01");
  assert.equal(uncheckedItem.status, "unchecked");
  assert.equal(uncheckedItem.checkedAt, null);
}

console.log("milestones acceptance: ok");
