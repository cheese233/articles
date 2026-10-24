import assert from "node:assert/strict";
import { test } from "node:test";
import { linkTimeline, sortEntries } from "../shared/order.ts";

const entries = [
  { route: "/b", title: "B", date: "2026-10-20T00:00:00.000Z" },
  { route: "/a", title: "A", date: "2026-10-21T00:00:00.000Z" },
  { route: "/c", title: "C", date: "2026-10-20T00:00:00.000Z" },
];

test("sorts newest first and breaks ties by route", () => {
  assert.deepEqual(
    sortEntries(entries).map((entry) => entry.route),
    ["/a", "/b", "/c"],
  );
});

test("links prev (older) and next (newer)", () => {
  const sorted = sortEntries(entries);
  const timeline = linkTimeline(sorted);

  const a = timeline.get("/a");
  assert.equal(a?.next, null);
  assert.equal(a?.prev?.route, "/b");

  const b = timeline.get("/b");
  assert.equal(b?.next?.route, "/a");
  assert.equal(b?.prev?.route, "/c");

  const c = timeline.get("/c");
  assert.equal(c?.prev, null);
  assert.equal(c?.next?.route, "/b");
});
