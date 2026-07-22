const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const REPORTS_TABLE = process.env.REPORTS_TABLE;

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

function reportTitle(reportType) {
  return reportType === "visit-pack" ? "Doctor Visit Pack" : "Monthly Progress Report";
}

function periodLabel(reportType, options = {}, now = new Date()) {
  if (reportType === "visit-pack") return options.nextVisitDate ? `Visit ${options.nextVisitDate}` : "Next visit";
  return options.periodMonth || now.toISOString().slice(0, 7);
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

async function handleListReports(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting reports.");

  const result = await documentClient.send(new QueryCommand({
    TableName: REPORTS_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    ScanIndexForward: false
  }));

  return json(200, { reports: result.Items || [] });
}

async function handleCreateReport(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before generating reports.");

  const body = parseBody(event);
  const reportType = body.reportType === "visit-pack" ? "visit-pack" : "monthly";
  const now = new Date();
  const reportId = `${reportType}#${now.toISOString()}`;
  const report = {
    childId,
    reportId,
    userId,
    reportType,
    title: reportTitle(reportType),
    periodLabel: periodLabel(reportType, body.options, now),
    status: "ready",
    distribution: reportType === "visit-pack" ? ["share", "email-to-doctor"] : ["share"],
    pdfStatus: "contract-ready",
    url: null,
    expiresIn: 0,
    options: body.options || {},
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
