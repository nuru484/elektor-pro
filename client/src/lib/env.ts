// src/lib/env.ts - typed public env, validated at module load.
const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing public env var: ${name}`);
  return value;
};

export const env = {
  apiUrl: required(
    "NEXT_PUBLIC_API_URL",
    // Fallback matches .env.example and the server's configured PORT (4040).
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4040/api/v1",
  ),
};

export const socketUrl = env.apiUrl.replace(/\/api\/v1\/?$/, "");
