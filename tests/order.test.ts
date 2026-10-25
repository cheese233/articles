import { expect } from "@esm-bundle/chai";
import { linkTimeline, sortEntries } from "../shared/order.ts";

const entries = [
  { route: "/b", title: "B", date: "2026-10-20T00:00:00.000Z" },
  { route: "/a", title: "A", date: "2026-10-21T00:00:00.000Z" },
  { route: "/c", title: "C", date: "2026-10-20T00:00:00.000Z" },
];

describe("timeline", () => {
  it("sorts newest first and breaks ties by route", () => {
    expect(sortEntries(entries).map((entry) => entry.route)).to.deep.equal([
      "/a",
      "/b",
      "/c",
    ]);
  });

  it("links prev (older) and next (newer)", () => {
    const sorted = sortEntries(entries);
    const timeline = linkTimeline(sorted);

    const a = timeline.get("/a");
    expect(a?.next).to.equal(null);
    expect(a?.prev?.route).to.equal("/b");

    const b = timeline.get("/b");
    expect(b?.next?.route).to.equal("/a");
    expect(b?.prev?.route).to.equal("/c");

    const c = timeline.get("/c");
    expect(c?.prev).to.equal(null);
    expect(c?.next?.route).to.equal("/b");
  });
});
