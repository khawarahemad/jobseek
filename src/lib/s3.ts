import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

// ─── MinIO-compatible S3 client for kh-cloud storage ───────────────────────
const S3_ENDPOINT     = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY   = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_KEY   = process.env.S3_SECRET_ACCESS_KEY;
export const S3_BUCKET = process.env.S3_BUCKET;

if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
  throw new Error(
    "[s3] Missing required environment variables: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET"
  );
}

export const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO / self-hosted S3
});

/**
 * Upload a resume PDF to S3.
 * Key pattern: resumes/<userId>/<filename>
 */
export async function uploadResumeToS3(
  userId: string,
  filename: string,
  buffer: Buffer | Uint8Array,
  contentType = "application/pdf"
): Promise<string> {
  const key = `resumes/${userId}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
      ContentType: contentType,
      // Make the object accessible via presigned URL only (not public)
      Metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
      },
    })
  );

  return key; // Return the S3 key (not a public URL – we stream it server-side)
}

/**
 * Download resume bytes from S3 for attaching to emails.
 * Returns a Buffer with the file contents.
 */
export async function downloadResumeFromS3(s3Key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    })
  );

  if (!res.Body) {
    throw new Error(`S3 object not found: ${s3Key}`);
  }

  // Convert the readable stream to a Buffer
  const chunks: Uint8Array[] = [];
  const stream = res.Body as Readable;
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Check if a resume exists in S3 for this user.
 * Returns the S3 key if found, null otherwise.
 */
export async function getResumeS3Key(userId: string): Promise<string | null> {
  // Convention: store as resumes/<userId>/resume.pdf
  const key = `resumes/${userId}/resume.pdf`;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return key;
  } catch {
    return null;
  }
}
