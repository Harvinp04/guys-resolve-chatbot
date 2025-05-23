import wixData from 'wix-data';

/**
 * Return up to five book suggestions drawn from the “Import485” collection.
 * Matches any keyword in the user’s message against the “topics” field.
 * Works whether “topics” is a Text or Tags field.
 * @param {string} topic  the raw text the user typed
 * @returns {string null} bullet-list string or null if nothing found
 */
export async function recommendBooks(topic) {
  if (!topic) return null;

  // split the sentence into unique lowercase keywords
  const keywords = [...new Set(
    (topic.match(/[a-z0-9']+/gi) || []).map(w => w.toLowerCase())
  )];
  if (!keywords.length) return null;

  // build OR-chained query: topics contains *any* keyword
  let q = wixData.query('Import485');
  keywords.forEach(word => {
    q = q.or(wixData.query('Import485').contains('topics', word));
  });

  const { items } = await q.limit(5).find();
  if (!items.length) return null;

  return items
    .map(book =>
      `• "${book.title}" by ${book.author}\n  ${book.summary ?? ''}`.trim()
    )
    .join('\n');
}
