// test/global-setup.ts — create the test database and apply migrations once.
import { execSync } from 'node:child_process';

const DB_URL = 'postgresql://nuru:0553997465@localhost:5432/elektor_pro_test';
const ADMIN_URL = 'postgresql://nuru:0553997465@localhost:5432/postgres';

export default function setup(): void {
  try {
    execSync(
      `psql "${ADMIN_URL}" -c "CREATE DATABASE elektor_pro_test"`,
      { stdio: 'ignore' },
    );
  } catch {
    // database already exists — fine
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: DB_URL },
    stdio: 'ignore',
  });
}
