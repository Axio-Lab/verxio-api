import { prisma, basePrismaClient } from "../lib/prisma";
import crypto from "crypto";

const db = prisma as any;
const rawDb = basePrismaClient as any;

export async function createKnowledgeBase(userId: string, name: string, description?: string) {
  return db.knowledgeBase.create({
    data: { userId, name, description: description || null },
  });
}

export async function listKnowledgeBases(userId: string) {
  return db.knowledgeBase.findMany({
    where: { userId },
    include: { documents: { select: { id: true, title: true, status: true, chunkCount: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKnowledgeBase(id: string, userId: string) {
  const kb = await db.knowledgeBase.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!kb || kb.userId !== userId) throw new Error("Knowledge base not found");
  return kb;
}

export async function deleteKnowledgeBase(id: string, userId: string) {
  const kb = await db.knowledgeBase.findUnique({ where: { id } });
  if (!kb || kb.userId !== userId) throw new Error("Knowledge base not found");
  return db.knowledgeBase.delete({ where: { id } });
}

export async function addDocument(
  knowledgeBaseId: string,
  userId: string,
  data: { title: string; sourceType: string; sourceUrl?: string; content: string }
) {
  const kb = await db.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
  if (!kb || kb.userId !== userId) throw new Error("Knowledge base not found");

  const doc = await db.knowledgeDocument.create({
    data: {
      knowledgeBaseId,
      title: data.title,
      sourceType: data.sourceType,
      sourceUrl: data.sourceUrl || null,
      content: data.content,
      status: "processing",
    },
  });

  // Process document asynchronously
  processDocument(doc.id, knowledgeBaseId).catch((err) =>
    console.error(`[KnowledgeBase] Failed to process document ${doc.id}:`, err)
  );

  return doc;
}

export async function deleteDocument(docId: string, userId: string) {
  const doc = await db.knowledgeDocument.findUnique({
    where: { id: docId },
    include: { knowledgeBase: { select: { userId: true } } },
  });
  if (!doc || doc.knowledgeBase.userId !== userId) throw new Error("Document not found");

  // Chunks are cascade-deleted via foreign key
  try {
    await rawDb.$executeRawUnsafe(
      `DELETE FROM "knowledge_chunks" WHERE "documentId" = $1`,
      docId
    );
  } catch {
    // table may not exist yet
  }

  return db.knowledgeDocument.delete({ where: { id: docId } });
}

function chunkText(text: string, chunkSize: number = 1500, overlap: number = 200): string[] {
  const cleaned = text ?? "";
  if (!cleaned.length) return [];

  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const safeOverlap = Math.min(Math.max(0, Math.floor(overlap)), safeChunkSize - 1);

  const chunks: string[] = [];
  let start = 0;
  const len = cleaned.length;

  while (start < len) {
    const end = Math.min(start + safeChunkSize, len);
    chunks.push(cleaned.slice(start, end));

    // If we've reached the end of the text, stop to avoid an infinite loop
    if (end === len) {
      break;
    }

    // Move start forward with overlap, ensuring progress
    start = end - safeOverlap;
    if (start <= 0) {
      start = end;
    }
  }

  return chunks;
}

type EmbeddingTaskType =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"
  | "QUESTION_ANSWERING"
  | "FACT_VERIFICATION"
  | "CODE_RETRIEVAL_QUERY";

async function generateEmbedding(text: string, taskType?: EmbeddingTaskType): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No embedding API key configured (GOOGLE_AI_API_KEY)");

  const embeddingModel =
    process.env.GOOGLE_EMBEDDING_MODEL ||
    process.env.GEMINI_EMBEDDING_MODEL ||
    "gemini-embedding-001";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: `models/${embeddingModel}`,
        ...(taskType ? { taskType } : {}),
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${err}`);
  }

  const result = await response.json();
  // API returns either { embedding: { values } } or { embeddings: [{ values }] }
  return result?.embedding?.values || result?.embeddings?.[0]?.values || [];
}

async function processDocument(docId: string, knowledgeBaseId: string) {
  try {
    const doc = await db.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc) return;

    const chunks = chunkText(doc.content);
    let processed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = crypto.randomUUID();
      try {
        const embedding = await generateEmbedding(chunks[i], "RETRIEVAL_DOCUMENT");
        const embeddingStr = `[${embedding.join(",")}]`;

        await rawDb.$executeRawUnsafe(
          `INSERT INTO "knowledge_chunks" ("id", "documentId", "knowledgeBaseId", "content", "chunkIndex", "embedding")
           VALUES ($1, $2, $3, $4, $5, $6::vector)
           ON CONFLICT ("id") DO NOTHING`,
          chunkId,
          docId,
          knowledgeBaseId,
          chunks[i],
          i,
          embeddingStr
        );
        processed++;
      } catch (err) {
        console.error(`[KnowledgeBase] Failed to embed chunk ${i} of doc ${docId}:`, err);
      }
    }

    await db.knowledgeDocument.update({
      where: { id: docId },
      data: { status: "ready", chunkCount: processed },
    });
  } catch (error) {
    console.error(`[KnowledgeBase] Error processing document ${docId}:`, error);
    await db.knowledgeDocument.update({
      where: { id: docId },
      data: { status: "failed" },
    });
  }
}

export async function searchKnowledge(
  knowledgeBaseId: string,
  query: string,
  topK: number = 5
): Promise<Array<{ content: string; chunkIndex: number; score: number }>> {
  const queryEmbedding = await generateEmbedding(query, "RETRIEVAL_QUERY");
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await rawDb.$queryRawUnsafe(
    `SELECT "content", "chunkIndex" as "chunkIndex", 1 - ("embedding" <=> $1::vector) as score
     FROM "knowledge_chunks"
     WHERE "knowledgeBaseId" = $2
     ORDER BY "embedding" <=> $1::vector
     LIMIT $3`,
    embeddingStr,
    knowledgeBaseId,
    topK
  );

  return results as Array<{ content: string; chunkIndex: number; score: number }>;
}
