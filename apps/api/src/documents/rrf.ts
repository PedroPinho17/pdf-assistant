export type RankedItem = {
    id: string;
    page: number | null;
    content: string;
    score?: number;
  };
  
  export type RrfResult = {
    id: string;
    page: number | null;
    content: string;
    score: number;
  };
  
  export function reciprocalRankFusion(
    lists: RankedItem[][],
    k = 60,
    limit = 5,
  ): RrfResult[] {
    const scores = new Map<string, { item: RankedItem; score: number }>();
  
    for (const list of lists) {
      list.forEach((item, index) => {
        const rank = index + 1; // posição 1-based
        const add = 1 / (k + rank);
        const prev = scores.get(item.id);
        if (prev) {
          prev.score += add;
        } else {
          scores.set(item.id, { item, score: add });
        }
      });
    }
  
    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item, score }) => ({
        id: item.id,
        page: item.page,
        content: item.content,
        score,
      }));
  }