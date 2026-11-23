// Reads every page of a milestone's issues (TRK-25). Pure: the caller injects `fetchPage`.
// `complete` is true only when the last page said `hasNextPage: false`. A page that claims
// more data but gives no usable cursor, a repeated cursor, or hitting `maxPages` stays incomplete.

export const MAX_PAGES = 40;

/**
 * @param {(after: string | null) => Promise<{ nodes: unknown[], pageInfo: { hasNextPage: boolean, endCursor?: string | null } }>} fetchPage
 * @param {number} [maxPages]
 */
export async function readAllPages(fetchPage, maxPages = MAX_PAGES) {
  const nodes = [];
  const seen = new Set();
  let after = null;
  for (let page = 0; page < maxPages; page += 1) {
    const { nodes: pageNodes, pageInfo } = await fetchPage(after);
    nodes.push(...pageNodes);
    if (!pageInfo.hasNextPage) return { nodes, complete: true };
    const next = pageInfo.endCursor;
    if (!next || seen.has(next)) return { nodes, complete: false };
    seen.add(next);
    after = next;
  }
  return { nodes, complete: false };
}
