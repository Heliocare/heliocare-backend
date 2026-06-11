import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "../logger.js";

const bucketName = process.env.AWS_S3_BUCKET || "heliocare-prescriptions-bucket";

// Initialize S3 Client (only if not in test environment)
const isTest = process.env.NODE_ENV === "test" || !process.env.AWS_ACCESS_KEY_ID;

let s3Client: S3Client | null = null;
if (!isTest) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

// Global in-memory storage for test mocks
const mockS3Storage = new Map<string, Buffer>();

// Uploads a buffer securely to AWS S3 or fallback mock in test mode
export async function uploadToS3(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  if (isTest || !s3Client) {
    logger.info(`[MOCK_S3] Uploaded file to S3 under key: ${key} (${buffer.length} bytes, MIME: ${mimeType})`);
    mockS3Storage.set(key, buffer);
    return `https://s3.amazonaws.com/${bucketName}/${key}`;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);
    logger.info(`Successfully uploaded file to S3: ${key}`);
    return `https://s3.amazonaws.com/${bucketName}/${key}`;
  } catch (error) {
    logger.error({ error }, `Failed to upload to S3 for key: ${key}`);
    throw error;
  }
}

// Generates a presigned GET URL for a given S3 key with a custom TTL (default: 15 minutes)
export async function getSignedUrl(key: string, ttlSeconds = 900): Promise<string> {
  if (isTest || !s3Client) {
    logger.info(`[MOCK_S3] Generated signed URL for key: ${key} (TTL: ${ttlSeconds}s)`);
    return `https://s3.amazonaws.com/${bucketName}/${key}?mock-signature=true&expires-in=${ttlSeconds}`;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await s3GetSignedUrl(s3Client, command, { expiresIn: ttlSeconds });
    return url;
  } catch (error) {
    logger.error({ error }, `Failed to generate signed S3 URL for key: ${key}`);
    throw error;
  }
}

/**
 * Helper to get the mocked S3 buffer (useful in integration tests)
 */
export function getMockS3Buffer(key: string): Buffer | undefined {
  return mockS3Storage.get(key);
}
