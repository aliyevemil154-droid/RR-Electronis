import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { readLimitedBody, RequestBodyError } from "./request";

export class EngagementError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function validateEmail(value: unknown): string {
  if (typeof value !== "string")
    throw new EngagementError("Please enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  )
    throw new EngagementError("Please enter a valid email address.");
  return email;
}

export function validateInquiry(value: Record<string, unknown>) {
  const email = validateEmail(value.email);
  if (
    typeof value.name !== "string" ||
    value.name.trim().length < 2 ||
    value.name.trim().length > 100 ||
    /[\u0000-\u001f\u007f]/.test(value.name)
  )
    throw new EngagementError("Please enter your name.");
  if (
    typeof value.message !== "string" ||
    value.message.trim().length < 10 ||
    value.message.trim().length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.message)
  )
    throw new EngagementError(
      "Please enter a message between 10 and 2,000 characters.",
    );
  return { name: value.name.trim(), email, message: value.message.trim() };
}

export async function readEngagementBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new EngagementError(
        "Please send your request from our website.",
        403,
      );
    }
    if (originHost !== host && origin !== process.env.APP_URL)
      throw new EngagementError(
        "Please send your request from our website.",
        403,
      );
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new EngagementError("Please check your details and try again.");
  let text: string;
  try {
    text = (await readLimitedBody(request, 8192)).toString("utf8");
  } catch (error) {
    if (error instanceof RequestBodyError)
      throw new EngagementError(
        error.status === 413
          ? "Your request is too long."
          : "Please check your details and try again.",
        error.status,
      );
    throw error;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new EngagementError("Please check your details and try again.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new EngagementError("Please check your details and try again.");
  return body as Record<string, unknown>;
}

function withDatabase<T>(
  action: (db: DatabaseSync) => T,
  path = process.env.ENGAGEMENT_DB_PATH ||
    join(process.cwd(), ".data", "engagement.sqlite"),
): T {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    chmodSync(path, 0o600);
    db.exec(`PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
    `);
    return action(db);
  } finally {
    db.close();
  }
}

export function saveSubscriber(email: string, path?: string) {
  return withDatabase(
    (db) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)",
        )
        .run(email, new Date().toISOString()).changes > 0,
    path,
  );
}

export function saveInquiry(
  inquiry: ReturnType<typeof validateInquiry>,
  path?: string,
) {
  return withDatabase((db) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const recent = db
        .prepare(
          "SELECT COUNT(*) AS count FROM inquiries WHERE email = ? AND created_at > ?",
        )
        .get(
          inquiry.email,
          new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        ) as { count: number };
      if (recent.count >= 3)
        throw new EngagementError(
          "We've received your messages. Please wait a few minutes before sending another.",
          429,
        );
      db.prepare(
        "INSERT INTO inquiries (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(
        randomUUID(),
        inquiry.name,
        inquiry.email,
        inquiry.message,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }, path);
}
