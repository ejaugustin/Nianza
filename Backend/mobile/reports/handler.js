const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");
const vaccinesLibrary = require("../vaccines/library");
const periods = require("./periods");
const reportData = require("./data");
const assemble = require("./assemble");
const { getEntitlements } = require("../../shared/entitlements");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const REPORTS_TABLE = process.env.REPORTS_TABLE;
const VITALS_TABLE = process.env.VITALS_TABLE;
const MILESTONES_TABLE = process.env.MILESTONES_TABLE;
const SICK_ENCOUNTERS_TABLE = process.env.SICK_ENCOUNTERS_TABLE;
const VACCINES_TABLE = process.env.VACCINES_TABLE;
const VISIT_DEBRIEFS_TABLE = process.env.VISIT_DEBRIEFS_TABLE;

const PERIODS = new Set(["month", "halfyear", "year", "visit"]);

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function claimsFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  return {
    userId: claims.sub || "local-acceptance-user",
    email: claims.email || null
  };
}

function pathPart(event, name) {
  if (event.pathParameters?.[name]) return decodeURIComponent(event.pathParameters[name]);
  const path = event.rawPath || event.path || "";
  const match = path.match(/\/reports\/([^/]+)(?:\/([^/]+))?/);
  if (name === "childId") return match?.[1] ? decodeURIComponent(match[1]) : null;
  if (name === "reportId") return match?.[2] ? decodeURIComponent(match[2]) : null;
  return null;
}

function reportTitle(reportType, period) {
  if (reportType === "visit-pack") return "Doctor Visit Pack";
  if (period === "halfyear") return "6-Month Digest";
  if (period === "year") return "Yearly Report";
  return "Monthly Progress Report";
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

// NZA-SUB-v1.0 Section 5: Doctor Visit Pack and Progress Reports (Monthly /
// 6-Month / Yearly) are both fully locked on the free tier -- distinct
// capabilities even though they share this one handler/table, since a
// future plan could plausibly unbundle them. "Locked" per Section 5's table
// means locked outright (not "can generate but not view"), consistent with
// Section 7's edge case that a lapsed account's old reports become viewable
// again only on resubscribe -- so this gates GET as well as POST, not just
// generation.
function capabilityForReportType(reportType) {
  return reportType === "visit-pack" ? "canAccessDoctorVisitPack" : "canAccessProgressReports";
}

async function requireReportAccess(userId, reportType) {
  const entitlements = await getEntitlements(userId);
  const capability = capabilityForReportType(reportType);
  return { allowed: Boolean(entitlements.capabilities[capability]), entitlements };
}

// Section 6.3 "Locked feature opened" copy, implemented verbatim per
// Section 8.4: "This one needs the full plan, [Name]. I can put it together
// the moment you're ready." {Name} drops cleanly (no dangling comma) when
// the client doesn't have a parent first name on hand, same pattern as the
// home screen greeting fix and messageCapReachedText in chat/handler.js.
function lockedFeatureText(parentFirstName) {
  const address = parentFirstName ? `, ${parentFirstName}` : "";
  return `This one needs the full plan${address}. I can put it together the moment you're ready.`;
}

function lockedReportError(reportType, parentFirstName) {
  return error(403, "SUBSCRIPTION_REQUIRED", lockedFeatureText(parentFirstName));
}

async function handleListReports(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting reports.");

  const [result, entitlements] = await Promise.all([
    documentClient.send(new QueryCommand({
      TableName: REPORTS_TABLE,
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
      ScanIndexForward: false
    })),
    getEntitlements(userId)
  ]);

  // Filtered, not errored: a free-tier parent opening the reports list
  // should see "nothing here yet" (locked), not a hard failure -- the
  // upgrade prompt lives at the point of tapping a locked item (Section
  // 6.3), not on the list screen itself.
  const reports = (result.Items || []).filter((item) => entitlements.capabilities[capabilityForReportType(item.reportType)]);

  return json(200, { reports });
}

async function handleCreateReport(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before generating reports.");

  const body = parseBody(event);
  const reportType = body.reportType === "visit-pack" ? "visit-pack" : "monthly";

  const access = await requireReportAccess(userId, reportType);
  if (!access.allowed) return lockedReportError(reportType, body.parentFirstName);
  const options = body.options || {};
  const period = reportType === "visit-pack" ? "visit" : (PERIODS.has(options.period) && options.period !== "visit" ? options.period : "month");
  const now = new Date();
  const window = periods.resolvePeriodWindow(period, options, now);
  const childName = child.childName || child.name || "your child";

  const [vitalsEntries, milestoneObservations, encounters, doses] = await Promise.all([
    reportData.fetchVitalsInRange(documentClient, VITALS_TABLE, childId, window.startDate, window.endDate),
    reportData.fetchMilestonesInRange(documentClient, MILESTONES_TABLE, childId, window.startDate, window.endDate),
    reportData.fetchAllEncounters(documentClient, SICK_ENCOUNTERS_TABLE, childId),
    reportData.fetchAllVaccineDoses(documentClient, VACCINES_TABLE, childId)
  ]);

  const dosesInWindow = doses.filter((d) => d.givenOn && d.givenOn >= window.startDate.slice(0, 10) && d.givenOn <= window.endDate.slice(0, 10));
  const vaccineProgress = vaccinesLibrary.buildVaccineProgress({ child, records: doses, now });

  let sectionKey;
  let sectionContent;
  if (period === "halfyear") {
    sectionKey = "halfyear";
    sectionContent = await assemble.buildHalfYearSection({ childName, window, vitalsEntries, milestoneObservations, encounters, doses: dosesInWindow, allDoses: doses });
  } else if (period === "year") {
    sectionKey = "year";
    sectionContent = await assemble.buildYearSection({ child, childName, window, vitalsEntries, milestoneObservations, encounters, allDoses: doses, childSummary: options.childSummary });
  } else if (period === "visit") {
    sectionKey = "visit";
    const latestDebrief = await reportData.fetchLatestDebrief(documentClient, VISIT_DEBRIEFS_TABLE, childId);
    sectionContent = await assemble.buildVisitPackSection({ childName, window, vitalsEntries, milestoneObservations, encounters, doses: dosesInWindow, allDoses: doses, vaccineProgress, parentConcerns: options.parentConcerns, latestDebrief });
  } else {
    sectionKey = "month";
    sectionContent = await assemble.buildMonthSection({ child, childName, window, vitalsEntries, milestoneObservations, encounters, doses: dosesInWindow, vaccineProgress });
  }

  const reportId = `${reportType}#${period}#${now.toISOString()}`;
  const report = {
    childId,
    reportId,
    userId,
    reportType,
    period,
    title: reportTitle(reportType, period),
    periodLabel: window.windowLabel,
    isFallbackWindow: Boolean(window.isFallbackWindow),
    status: "ready",
    distribution: reportType === "visit-pack" ? ["share", "email-to-doctor"] : ["share"],
    pdfStatus: "contract-ready",
    url: null,
    expiresIn: 0,
    options,
    sections: { [sectionKey]: sectionContent },
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  await documentClient.send(new PutCommand({
    TableName: REPORTS_TABLE,
    Item: report
  }));

  return json(202, { reportId, status: report.status, report });
}

async function handleGetReport(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  const reportId = pathPart(event, "reportId");
  if (!childId || !reportId) return error(400, "INVALID_FIELD", "childId and reportId are required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting reports.");

  const result = await documentClient.send(new GetCommand({
    TableName: REPORTS_TABLE,
    Key: { childId, reportId }
  }));
  if (!result.Item) return error(404, "REPORT_NOT_FOUND", "Report not found.");

  const access = await requireReportAccess(userId, result.Item.reportType);
  if (!access.allowed) return lockedReportError(result.Item.reportType, (event.queryStringParameters || {}).parentFirstName);

  return json(200, { report: result.Item });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CHILDREN_TABLE || !REPORTS_TABLE) {
    return error(500, "CONFIGURATION_ERROR", "Report tables are not configured.");
  }

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.includes("/reports/") && pathPart(event, "reportId")) return handleGetReport(event);
    if (event.httpMethod === "GET" && path.includes("/reports/")) return handleListReports(event);
    if (event.httpMethod === "POST" && path.includes("/reports/")) return handleCreateReport(event);
    return error(404, "NOT_FOUND", "Mobile reports route not found.");
  } catch (err) {
    console.error("mobile reports route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile reports service.");
  }
};

exports._private = { periods, reportData, assemble };
