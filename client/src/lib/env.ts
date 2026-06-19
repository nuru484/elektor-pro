// src/lib/env.ts — typed public env, validated at module load.
const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing public env var: ${name}`);
  return value;
};

export const env = {
  apiUrl: required(
    "NEXT_PUBLIC_API_URL",
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  ),
};

export const socketUrl = env.apiUrl.replace(/\/api\/v1\/?$/, "");
