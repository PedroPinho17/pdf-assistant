/**
 * Splits text into overlapping chunks of roughly `size` characters.
 * Boundaries are snapped to whitespace so words are never cut in half.
 */
export function chunkText(
  text: string,
  size = 1000,
  overlap = 200,
): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  if (overlap >= size) {
    throw new Error('overlap must be smaller than size');
  }

  const isSpace = (i: number) => /\s/.test(cleaned[i] ?? '');
  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + size, cleaned.length);

    // Move the end back to the last whitespace (but keep at least 80% of size).
    if (end < cleaned.length) {
      const min = start + Math.floor(size * 0.8);
      let e = end;
      while (e > min && !isSpace(e)) e--;
      if (e > min) end = e;
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= cleaned.length) break;

    // Next chunk starts `overlap` chars back, moved forward to a word start.
    let next = Math.max(end - overlap, start + 1);
    while (next < end && !isSpace(next - 1)) next++;
    start = next;
  }

  return chunks;
}
