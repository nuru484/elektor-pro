// src/utils/slug.ts
import { randomBytes } from 'node:crypto';

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';

/**
 * Build a slug that is unique according to `exists`, appending a short random
 * suffix on collision.
 */
export const uniqueSlug = async (
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${root}-${randomBytes(2).toString('hex')}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
};
