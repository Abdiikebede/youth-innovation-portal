import { pipeline, env } from '@xenova/transformers';

// Cache singleton embedder
let embedderPromise: Promise<any> | null = null;

export async function getLocalEmbedder() {
  if (!embedderPromise) {
    // Use small sentence-transformer for speed
    env.allowLocalModels = true;
    // NOTE: On cold servers (e.g., Render free tier), remote model fetch can timeout.
    // Wrap in try/catch and allow a graceful fallback.
    embedderPromise = (async () => {
      try {
        return await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch (err) {
        console.error('⚠️  Embedding model load failed, using fallback embeddings. Error:', err);
        // Return a shim that mimics the extractor interface
        return async (text: string, _opts?: any) => {
          const vec = fallbackEmbedding(text);
          return { data: Float32Array.from(vec) };
        };
      }
    })();
  }
  return embedderPromise;
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const extractor = await getLocalEmbedder();
    // Mean pool over token embeddings
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is Float32Array
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.error('⚠️  embedText failed, using fallback embeddings. Error:', err);
    return fallbackEmbedding(text);
  }
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// --- Fallback deterministic embedding ---
// Produces a fixed-size vector by hashing tokens. Not semantic, but stable and cheap.
function fallbackEmbedding(text: string, dim = 384): number[] {
  const vec = new Float32Array(dim);
  const tokens = (text || '').toLowerCase().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const h = murmurhash3_32_gc(t, 0x9747b28c);
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return Array.from(vec);
}

// Lightweight JS murmurhash3 (32-bit) implementation
// Source adapted to be self-contained.
function murmurhash3_32_gc(key: string, seed: number): number {
  let remainder = key.length & 3; // key.length % 4
  let bytes = key.length - remainder;
  let h1 = seed;
  let c1 = 0xcc9e2d51;
  let c2 = 0x1b873593;
  let i = 0;

  while (i < bytes) {
    let k1 = (key.charCodeAt(i) & 0xff) |
             ((key.charCodeAt(++i) & 0xff) << 8) |
             ((key.charCodeAt(++i) & 0xff) << 16) |
             ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    const h1b = (((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
    h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16)) & 0xffffffff;
  }

  let k1 = 0;

  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    // fallthrough
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    // fallthrough
    case 1:
      k1 ^= (key.charCodeAt(i) & 0xff);
      k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;

  h1 ^= h1 >>> 16;
  h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 | 0;
}
