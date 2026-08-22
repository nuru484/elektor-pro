// test/integration/voter-import.test.ts
//
// The CSV/XLSX voter import preview: header aliasing, per-row
// validation, in-file and against-DB duplicate detection, no writes.
import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../generated/prisma/client.js';
import { api, bodyOf, createUser, loginCookie, prisma, resetDb } from '../helpers.js';

interface PreviewBody {
  data: {
    errors: { field: string; message: string; row: number }[];
    ignoredColumns: string[];
    rows: { name: string; voterId: string }[];
    summary: { invalid: number; total: number; valid: number };
  };
}

const adminCookie = async (): Promise<string> => {
  await createUser(Role.SUPER_ADMIN, { email: 'import@test.com' });
  return loginCookie('import@test.com');
};

const preview = (cookie: string, buffer: Buffer, filename: string, contentType: string) =>
  api()
    .post('/api/v1/voters/import/preview')
    .set('Cookie', cookie)
    .attach('file', buffer, { contentType, filename });

describe('voter import preview', () => {
  beforeEach(resetDb);

  it('parses a CSV with aliased headers and reports every kind of problem', async () => {
    const cookie = await adminCookie();
    await prisma.voter.create({
      data: { email: 'taken@test.com', name: 'Existing', voterId: 'EXIST-1' },
    });

    const csv = [
      'Full Name,Index Number,Phone,Email,Level',
      'Ama Mensah,V-001,+233550001111,ama@test.com,300',
      ',V-002,,,100',
      'Kofi Boadu,V-001,,kofi@test.com,200',
      'Esi Antwi,V-003,,taken@test.com,400',
    ].join('\n');

    const res = await preview(cookie, Buffer.from(csv), 'voters.csv', 'text/csv');
    expect(res.status).toBe(200);
    const { data } = bodyOf<PreviewBody>(res);

    expect(data.summary).toEqual({ invalid: 3, total: 4, valid: 1 });
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ name: 'Ama Mensah', voterId: 'V-001' });
    // Unmapped columns are reported, not silently dropped.
    expect(data.ignoredColumns).toEqual(['Level']);

    const errorFields = data.errors.map((e) => `${String(e.row)}:${e.field}`);
    expect(errorFields).toContain('2:name'); // missing name
    expect(errorFields).toContain('3:voterId'); // duplicate within the file
    expect(errorFields).toContain('4:email'); // already registered

    // Preview never writes.
    expect(await prisma.voter.count()).toBe(1);
  });

  it('parses an XLSX workbook', async () => {
    const cookie = await adminCookie();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Voters');
    sheet.addRow(['Name', 'Voter ID', 'Phone Number']);
    sheet.addRow(['Yaw Ofori', 'X-001', '+233550002222']);
    sheet.addRow(['Abena Sarpong', 'X-002', '']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const res = await preview(
      cookie,
      buffer,
      'voters.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.status).toBe(200);
    const { data } = bodyOf<PreviewBody>(res);
    expect(data.summary).toEqual({ invalid: 0, total: 2, valid: 2 });
    expect(data.rows.map((r) => r.voterId)).toEqual(['X-001', 'X-002']);
  });

  it('refuses unsupported files and files without the required columns', async () => {
    const cookie = await adminCookie();

    const unsupported = await preview(
      cookie,
      Buffer.from('hello'),
      'voters.txt',
      'text/plain',
    );
    expect(unsupported.status).toBe(400);
    expect(bodyOf<{ code?: string }>(unsupported).code).toBe(
      'UNSUPPORTED_IMPORT_FILE',
    );

    const missingColumns = await preview(
      cookie,
      Buffer.from('Nickname,Town\nKwame,Tamale'),
      'voters.csv',
      'text/csv',
    );
    expect(missingColumns.status).toBe(400);
    expect(bodyOf<{ code?: string }>(missingColumns).code).toBe(
      'MISSING_IMPORT_COLUMNS',
    );
  });
});
