const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const chatContext = require("./context");

const TEMPLATE_IDS = {
  emergency: "chat-template#emergency",
  distress: "chat-template#distress",
  "vaccine-hesitancy": "chat-template#vaccine-hesitancy"
};

const FALLBACK_TEMPLATES = {
  emergency: "Call emergency services now.",
  distress: "I am very glad you said that out loud. If you might hurt yourself or your baby, put the baby somewhere safe and call emergency services now. If you can, reach one real person near you and say, I need help right now.",
  "vaccine-hesitancy": "That is a good question for your pediatrician, and you deserve a clear answer. I can help you write down what you are worried about so you do not have to hold it all in your head."
};

function renderTemplate(text, bundle) {
  const childName = bundle?.childSnapshot?.name || "your child";
  return String(text || "")
    .replace(/\{childName\}/g, childName)
    .replace(/\{name\}/g, childName);
}

async function readReviewedTemplate(documentClient, contentTable, type, language = "en") {
  if (!documentClient || !contentTable || !TEMPLATE_IDS[type]) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: contentTable,
    KeyConditionExpression: "contentId = :contentId",
    FilterExpression: "#language = :language AND clinicallyReviewed = :trueValue AND ejApproved = :trueValue AND (attribute_not_exists(deleted) OR deleted = :deletedFalse)",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":contentId": TEMPLATE_IDS[type],
      ":language": language,
      ":trueValue": true,
      ":deletedFalse": false
    },
    ScanIndexForward: false,
    Limit: 1
  }));
  return result.Items?.[0]?.bodyText || null;
}

async function safetyGate({ message, bundle, language, documentClient, contentTable, classifier }) {
  const text = String(message || "");
  let type = null;
  if (chatContext.isEmergencyText(text)) type = "emergency";
  if (!type && chatContext.isDistressText(text)) type = "distress";
  if (!type) {
    const label = await classifier(text);
    if (label === "vaccine-hesitancy") type = label;
  }

  if (!type) return null;

  const template = await readReviewedTemplate(documentClient, contentTable, type, language)
    .catch((err) => {
      console.warn("reviewed chat template unavailable", type, err?.name || err);
      return null;
    });

  return {
    type,
    eventType: "template",
    clinicallyReviewed: Boolean(template),
    text: renderTemplate(template || FALLBACK_TEMPLATES[type], bundle)
  };
}

module.exports = {
  FALLBACK_TEMPLATES,
  safetyGate
};
