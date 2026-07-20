function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function noContent(headers = {}) {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      ...headers
    },
    body: ""
  };
}

function error(statusCode, code, message) {
  return json(statusCode, { error: message, code });
}

module.exports = { json, noContent, error };
