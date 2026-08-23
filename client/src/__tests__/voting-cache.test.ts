// Casting a ballot has to invalidate the lists that describe where the voter
// stands, or the portal keeps offering a ballot they have already cast.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import { makeStore } from "@/redux/store";
import { votingApi } from "@/redux/voting-api";

const API = env.apiUrl;

const election = (hasVoted: boolean) => ({
  accreditationRequired: false,
  description: null,
  endDate: "2026-12-31T00:00:00.000Z",
  id: "e1",
  name: "General Election",
  resultsPolicy: "ON_CLOSE",
  resultsPublishedAt: null,
  slug: "general-election",
  startDate: "2026-01-01T00:00:00.000Z",
  status: "IN_PROGRESS",
  voterElections: [{ accreditedAt: null, hasVoted, isEligible: true }],
});

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("voter election list caching", () => {
  it("refetches the elections list after a ballot is cast", async () => {
    let listCalls = 0;

    server.use(
      http.get(`${API}/voter/elections`, () => {
        listCalls += 1;
        // Before the ballot the entry says not voted; after it, voted.
        return HttpResponse.json({
          data: [election(listCalls > 1)],
          message: "ok",
          meta: { limit: 10, page: 1, total: 1, totalPages: 1 },
          success: true,
        });
      }),
      http.post(`${API}/voter/elections/e1/ballot`, () =>
        HttpResponse.json({
          data: { receiptCode: "7Q4K-9XPM-2R8T" },
          message: "Ballot cast",
          success: true,
        }),
      ),
    );

    const store = makeStore();
    const params = { limit: 10, page: 1 };

    // The list is subscribed, the way the portal keeps it mounted.
    const subscription = store.dispatch(
      votingApi.endpoints.listVoterElections.initiate(params),
    );
    const before = await subscription;
    expect(before.data?.data[0].voterElections[0].hasVoted).toBe(false);

    await store.dispatch(
      votingApi.endpoints.castBallot.initiate({
        electionId: "e1",
        selections: [],
      }),
    );

    // The invalidation drives the refetch; read the settled cache entry.
    const after = await store.dispatch(
      votingApi.endpoints.listVoterElections.initiate(params, {
        subscribe: false,
      }),
    );

    expect(listCalls).toBeGreaterThan(1);
    expect(after.data?.data[0].voterElections[0].hasVoted).toBe(true);
    subscription.unsubscribe();
  });
});
