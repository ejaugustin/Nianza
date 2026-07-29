// N2/N3 (Voice memories): thin wrapper around S3 so handler.js and its test
// harness don't need to load the real AWS SDK client to exercise the
// DynamoDB-only logic paths. Isolated in its own module specifically so it
// can be swapped out in tests via require.cache substitution.
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({});
const BUCKET = process.env.VOICE_MEMORIES_BUCKET;

async function putAudioObject(key, buffer, contentType) {
  await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

async function presignedPlaybackUrl(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

async function deleteAudioObject(key) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { putAudioObject, presignedPlaybackUrl, deleteAudioObject };
