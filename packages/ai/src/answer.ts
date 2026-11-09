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

  return `És um assistente que responde apenas com base nos excertos do documento.

Regras:
- Usa só a informação dos excertos abaixo.
- Cita as fontes com [n] (ex.: [1], [2]).
- Se a resposta não estiver nos excertos, diz exactamente: "não encontrei no documento".

Excertos:
${excerpts}

Pergunta: ${question}`;
}

export async function answer(
  question: string,
  chunks: AnswerChunk[],
): Promise<string> {
  const response = await getAi().models.generateContent({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    contents: buildPrompt(question, chunks),
  });

  return response.text ?? 'não encontrei no documento';
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
