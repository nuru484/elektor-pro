import { notificationJobId } from '#jobs/notifications.queue.js';
import { deliverNotification } from '#workers/notification.worker.js';
// Delivery rules for one queued notification. These are the behaviours the
// retry story rests on: a failure must throw (so BullMQ retries it), and a
// recipient with no channel must not (so attempts are not burned on an
// outcome that cannot change).
import { describe, expect, it, vi } from 'vitest';

const deps = (overrides: Partial<{ mail: unknown; sms: unknown }> = {}) =>
  ({
    mail: { send: vi.fn().mockResolvedValue(undefined) },
    sms: { send: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  }) as unknown as Parameters<typeof deliverNotification>[1];

const job = (over: Partial<Parameters<typeof deliverNotification>[0]> = {}) => ({
  email: null,
  name: 'Ama',
  phoneNumber: null,
  subject: 'Voting is open',
  text: 'Cast your ballot.',
  ...over,
});

describe('deliverNotification', () => {
  it('prefers SMS when the voter has a phone', async () => {
    const d = deps();
    const channel = await deliverNotification(
      job({ email: 'ama@example.com', phoneNumber: '+233550000001' }),
      d,
    );
    expect(channel).toBe('sms');
    expect(d.sms.send).toHaveBeenCalledWith('+233550000001', 'Cast your ballot.');
    expect(d.mail.send).not.toHaveBeenCalled();
  });

  it('falls back to email when there is no phone', async () => {
    const d = deps();
    const channel = await deliverNotification(job({ email: 'ama@example.com' }), d);
    expect(channel).toBe('email');
    expect(d.mail.send).toHaveBeenCalledWith({
      email: 'ama@example.com',
      subject: 'Voting is open',
      text: 'Hello Ama,\n\nCast your ballot.',
    });
  });

  it('reports "none" - not an error - when the voter has no channel', async () => {
    // Retrying this forever would waste every attempt on a voter who simply
    // has no contact details, so it must not throw.
    await expect(deliverNotification(job(), deps())).resolves.toBe('none');
  });

  it('propagates a provider failure so the job is retried', async () => {
    const d = deps({
      sms: { send: vi.fn().mockRejectedValue(new Error('gateway rate limit')) },
    });
    await expect(
      deliverNotification(job({ phoneNumber: '+233550000002' }), d),
    ).rejects.toThrow('gateway rate limit');
  });
});

describe('notificationJobId', () => {
  it('is stable for the same recipient and announcement', () => {
    // BullMQ rejects a duplicate id while the job exists, which is what stops
    // a repeated announcement texting the whole roll twice.
    expect(notificationJobId('election.opened', 'e1', 'v1')).toBe(
      notificationJobId('election.opened', 'e1', 'v1'),
    );
  });

  it('separates recipients, elections and announcement kinds', () => {
    const base = notificationJobId('election.opened', 'e1', 'v1');
    expect(notificationJobId('election.opened', 'e1', 'v2')).not.toBe(base);
    expect(notificationJobId('election.opened', 'e2', 'v1')).not.toBe(base);
    expect(notificationJobId('results.published', 'e1', 'v1')).not.toBe(base);
  });
});
