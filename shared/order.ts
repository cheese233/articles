export interface SortableEntry {
  route: string;
  date: string;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Newest first; equal timestamps fall back to the route so a shallow clone
 * cannot make the order depend on filesystem readdir order.
 */
export const sortEntries = <T extends SortableEntry>(entries: T[]) =>
  [...entries].sort((a, b) =>
    a.date == b.date ? compare(a.route, b.route) : compare(b.date, a.date)
  );

/**
 * Walk the sorted timeline and attach the neighbours. `next` is newer,
 * `prev` is older, matching how a reader moves through a blog.
 */
export const linkTimeline = <
  T extends SortableEntry & { route: string; title: string },
>(entries: T[]) =>
  new Map(
    entries.map((entry, index) => {
      const newer = entries[index - 1];
      const older = entries[index + 1];
      return [
        entry.route,
        {
          prev: older
            ? { route: older.route, title: older.title, date: older.date }
            : null,
          next: newer
            ? { route: newer.route, title: newer.title, date: newer.date }
            : null,
        },
      ] as const;
    }),
  );
