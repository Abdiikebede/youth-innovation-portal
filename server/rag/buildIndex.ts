import fs from 'fs';
import path from 'path';
import { embedText } from '../services/embeddings';

const faqsPath = path.join(process.cwd(), 'server', 'rag', 'faqs.json');
const indexPath = path.join(process.cwd(), 'server', 'rag', 'index.json');

export async function ensureIndex() {
  if (fs.existsSync(indexPath)) {
    return; // already built
  }
  await buildIndex();
}

export async function buildIndex() {
  if (!fs.existsSync(faqsPath)) throw new Error('faqs.json not found');
  const faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf-8')) as Array<any>;
  const docs = [] as any[];

  for (const f of faqs) {
    const text = `${f.question}\n\n${f.answer}`.trim();
    const embedding = await embedText(text);
    docs.push({ id: f.id, text, embedding, meta: { category: f.category, tags: f.tags } });
  }

  fs.writeFileSync(indexPath, JSON.stringify(docs), 'utf-8');
  console.log(`🧭 RAG index built with ${docs.length} docs -> ${indexPath}`);
}
