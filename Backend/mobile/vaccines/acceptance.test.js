const assert = require("node:assert/strict");
const { buildVaccineProgress } = require("./library");

function dose(result, doseId) {
  return result.groups.flatMap((group) => group.doses).find((item) => item.doseId === doseId);
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-01-02T00:00:00.000Z"
  };
  const result = buildVaccineProgress({
    child,
    records: [],
    now: new Date("2026-05-01T00:00:00.000Z")
  });
  assert.equal(dose(result, "VX-DTAP-1").status, "due");
  assert.equal(dose(result, "VX-DTAP-2").status, "due");
  assert.equal(dose(result, "VX-DTAP-3").status, "upcoming");
  assert.equal(result.vaccineStatus, "due");
  assert.equal(result.ageBasis, "chronological");
}

{
  const child = {
    childId: "child-1",
    birthDate: "2024-01-01",
    createdAt: "2027-01-01T00:00:00.000Z"
  };
  const result = buildVaccineProgress({
    child,
    records: [],
    now: new Date("2027-01-15T00:00:00.000Z")
  });
  assert.equal(result.dueCount, 0);
  assert.equal(result.vaccineStatus, "up-to-date");
  assert.equal(dose(result, "VX-DTAP-1").status, "unrecorded");
  assert.equal(result.shouldOfferBackfill, true);
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-01-02T00:00:00.000Z"
  };
  const result = buildVaccineProgress({
    child,
    records: [{ childId: "child-1", doseId: "VX-DTAP-1", givenOn: "2026-03-02", backfilled: true }],
    now: new Date("2026-05-01T00:00:00.000Z")
  });
  assert.equal(dose(result, "VX-DTAP-1").status, "recorded");
  assert.equal(dose(result, "VX-DTAP-1").backfilled, true);
  assert.equal(dose(result, "VX-DTAP-1").givenOn, "2026-03-02");
}

{
  const child = {
    childId: "child-1",
    birthDate: "2026-01-01",
    createdAt: "2026-01-02T00:00:00.000Z"
  };
  const result = buildVaccineProgress({
    child,
    records: [],
    now: new Date("2026-10-15T00:00:00.000Z")
  });
  assert.equal(dose(result, "VX-FLU-2026").status, "due");
}

console.log("vaccines acceptance: ok");
