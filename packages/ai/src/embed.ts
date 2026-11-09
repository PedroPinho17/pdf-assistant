import {
    pipeline,
    type FeatureExtractionPipeline,
  } from '@huggingface/transformers';
  
  let extractor: FeatureExtractionPipeline | null = null;
  
  async function getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!extractor) {
      extractor = await pipeline(
        'feature-extraction',
        'Xenova/multilingual-e5-small',
      );
    }
    return extractor;
  }
  
  export async function embedPassages(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
  
    const model = await getExtractor();
    const prefixed = texts.map((text) => `passage: ${text}`);
    const output = await model(prefixed, {
      pooling: 'mean',
      normalize: true,
    });
    return output.tolist() as number[][];
  }
  
  export async function embedQuery(text: string): Promise<number[]> {
    const model = await getExtractor();
    const output = await model(`query: ${text}`, {
      pooling: 'mean',
      normalize: true,
    });
    const rows = output.tolist() as number[][];
    return rows[0] ?? [];
  }