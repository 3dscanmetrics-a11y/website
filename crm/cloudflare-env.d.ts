/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  PRIVATE_FILES: R2Bucket;
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}
