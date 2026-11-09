import { reciprocalRankFusion, type RankedItem } from './rrf';

function item(id: string, page = 1): RankedItem {
  return { id, page, content: `chunk ${id}` };
}

describe('reciprocalRankFusion', () => {
  it('scores with 1 / (60 + rank) and returns top limit', () => {
    const vector = [item('a'), item('b'), item('c')];
    const keyword = [item('b'), item('d'), item('a')];

    const result = reciprocalRankFusion([vector, keyword], 60, 5);

    // a: 1/(60+1) + 1/(60+3) = 1/61 + 1/63
    // b: 1/(60+2) + 1/(60+1) = 1/62 + 1/61  (highest)
    // c: 1/63
    // d: 1/62
    expect(result.map((r) => r.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(result[0]!.score).toBeCloseTo(1 / 61 + 1 / 62);
    expect(result).toHaveLength(4);
  });

  it('respects limit', () => {
    const list = [item('a'), item('b'), item('c'), item('d')];
    const result = reciprocalRankFusion([list], 60, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('handles empty lists', () => {
    expect(reciprocalRankFusion([], 60, 5)).toEqual([]);
    expect(reciprocalRankFusion([[], []], 60, 5)).toEqual([]);
  });
});
