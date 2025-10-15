import fs from 'fs';
import path from 'path';
import { embedText, cosineSim } from '../services/embeddings';

export interface IndexedDoc {
  id: string;
  text: string;
  embedding: number[];
  meta?: any;
}

const indexPath = path.join(process.cwd(), 'server', 'rag', 'index.json');

export function loadIndex(): IndexedDoc[] {
  if (!fs.existsSync(indexPath)) return [];
  const raw = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(raw) as IndexedDoc[];
}

export async function retrieveTopK(query: string, k = Number(process.env.RAG_TOP_K || 4)) {
  const index = loadIndex();
  if (!index.length) return [];
  const qEmb = await embedText(query);
  const scored = index.map(d => ({
    id: d.id,
    text: d.text,
    meta: d.meta,
    score: cosineSim(qEmb, d.embedding)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, k));
}
