// test/unit/email-templates.test.ts
//
// The branded shell renders, carries the message, and treats every value as
// text: these templates interpolate voter names, election titles and
// administrator-entered addresses, so an unescaped one would be markup in
// somebody's inbox.
import { beforeEach, describe, expect, it } from 'vitest';

import { buildCredentialsEmail } from '../../src/mail/account-emails.js';
import {
  buildAdminEmailChangeEmail,
  buildPasswordResetEmail,
  buildSignInCodeEmail,
} from '../../src/mail/auth-emails.js';
import { buildVoterCodeEmail } from '../../src/mail/election-emails.js';
import {
  renderTemplate,
  resetBrandingCache,
} from '../../src/mail/render-template.js';

const render = (data: Record<string, unknown>) =>
  renderTemplate('message.ejs', data);

beforeEach(() => {
  resetBrandingCache();
});

describe('email templates', () => {
  it('wraps the message in the branded shell', async () => {
    const html = await render({ intro: ['Hello there'], title: 'A title' });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('A title');
    expect(html).toContain('Hello there');
  });

  it('escapes interpolated values instead of rendering them as markup', async () => {
    const html = await render({
      intro: ['<b>bold</b>'],
      name: '<img src=x onerror=alert(1)>',
      rows: [{ label: 'Item', value: '<script>alert(1)</script>' }],
      title: 'Escaping',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img src=x');
  });

  it('rejects a non-http action URL rather than putting it in an href', async () => {
    const html = await render({
      action: { label: 'Go', url: 'javascript:alert(1)' },
      title: 'Link',
    });

    expect(html).not.toContain('javascript:alert(1)');
  });

  it('renders the code and detail blocks only when given them', async () => {
    const bare = await render({ intro: ['nothing else'], title: 'Bare' });
    expect(bare).not.toContain('Your credentials');

    const full = await render({
      code: '481920',
      rows: [{ label: 'Temporary password', value: 'hunter2' }],
      rowsCaption: 'Your credentials',
      title: 'Full',
    });
    expect(full).toContain('481920');
    expect(full).toContain('hunter2');
    expect(full).toContain('Your credentials');
  });

  it('keeps the code, password and link in every plain-text body', () => {
    expect(buildSignInCodeEmail('Ada', '123456', 10).text).toContain('123456');
    expect(buildVoterCodeEmail('654321', 5).text).toContain('654321');
    expect(buildAdminEmailChangeEmail('112233', 15).text).toContain('112233');
    expect(
      buildPasswordResetEmail('Ada', 'https://x.test/reset?token=t', 30).text,
    ).toContain('https://x.test/reset?token=t');
    expect(
      buildCredentialsEmail('Ada', 'temp-pass-1', 'https://x.test/login').text,
    ).toContain('temp-pass-1');
  });
});
