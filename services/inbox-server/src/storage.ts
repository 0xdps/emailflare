// CF R2 attachment storage via S3-compatible API.
// Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env.js";

const r2 = new S3Client({
	region: "auto",
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	},
});

/** Upload data to R2 under the given key. */
export async function putObject(
	key: string,
	body: Buffer | Uint8Array | ArrayBuffer,
	contentType: string,
): Promise<void> {
	const buf = Buffer.isBuffer(body)
		? body
		: Buffer.from(body instanceof ArrayBuffer ? body : (body as Uint8Array).buffer);

	await r2.send(
		new PutObjectCommand({
			Bucket: env.R2_BUCKET_NAME,
			Key: key,
			Body: buf,
			ContentType: contentType,
		}),
	);
}

/** Generate a presigned GET URL for a stored R2 object. */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
	return getSignedUrl(r2, new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }), { expiresIn });
}
