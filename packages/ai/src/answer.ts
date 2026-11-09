import { GoogleGenAI } from '@google/genai';

export type AnswerChunk = {
  page: number | null;
  content: string;
};

let ai: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

function buildPrompt(question: string, chunks: AnswerChunk[]): string {
  const excerpts = chunks
    .map((chunk, i) => {
      const n = i + 1;
      const page = chunk.page ?? '?';
      return `[${n}] (p. ${page}) ${chunk.content}`;
    })
    .join('\n\n');

  return `You are an assistant that answers questions using only the excerpts from a document provided below.

Rules:
- Use only the information in the excerpts. Do not use outside knowledge.
- Cite your sources inline with [n] (e.g. [1], [2]).
- Always answer in the same language as the question, even if the document is in another language.
- If the answer is not in the excerpts, say briefly (in the language of the question) that you could not find it in the document.

Excerpts:
${excerpts}

Question: ${question}`;
}

export async function answer(
  question: string,
  chunks: AnswerChunk[],
): Promise<string> {
  const response = await getAi().models.generateContent({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    contents: buildPrompt(question, chunks),
  });

  return response.text ?? '';
}

export async function* answerStream(
  question: string,
  chunks: AnswerChunk[],
): AsyncGenerator<string> {
  const stream = await getAi().models.generateContentStream({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    contents: buildPrompt(question, chunks),
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
