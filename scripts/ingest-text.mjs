/**
 * ReadAlong — Plain Text Ingestion Script
 *
 * Parses the plain-text version of 1984 from Project Gutenberg Australia,
 * strips metadata headers/footers, and chunks into 750-900 word cycles.
 *
 * Usage:
 *   cd scripts
 *   node ingest-text.mjs "../1984_english.txt"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────
const SUPABASE_URL = "https://wldnobfobedxxmaaikud.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZG5vYmZvYmVkeHhtYWFpa3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE5MjAsImV4cCI6MjA5OTYxNzkyMH0.XUbSZmM_qI4rXrSLzTpKTq531bhWYgVJg-YZCERBLGM";

const MIN_WORDS = 750;
const MAX_WORDS = 900;
const TARGET_WORDS = 825;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function countWords(text) {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function extractStoryContent(rawText) {
  const lines = rawText.split(/\r?\n/);

  // Find the start of actual story content — "PART ONE" or "Chapter 1"
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^PART\s+ONE\s*$/i.test(lines[i].trim())) {
      startIdx = i;
      break;
    }
  }

  // Find the end — "THE END"
  let endIdx = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^THE\s+END\s*$/i.test(lines[i].trim())) {
      endIdx = i;
      break;
    }
  }

  const storyLines = lines.slice(startIdx, endIdx);

  // Join into paragraphs — paragraphs are separated by blank lines
  const paragraphs = [];
  let current = [];

  for (const line of storyLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (current.length > 0) {
        paragraphs.push(current.join(" ").trim());
        current = [];
      }
    } else {
      current.push(trimmed);
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(" ").trim());
  }

  // Filter out chapter headers that are just "Chapter X" or "PART X" (keep them as metadata)
  // But keep them in the flow for context
  const cleanParagraphs = paragraphs.filter((p) => {
    // Skip very short lines that are just section markers
    if (/^(PART\s+(ONE|TWO|THREE|FOUR|FIVE))\s*$/i.test(p)) return false;
    if (/^Chapter\s+\d+\s*$/i.test(p)) return false;
    if (p.length === 0) return false;
    return true;
  });

  return cleanParagraphs;
}

function chunkParagraphs(paragraphs, minWords, maxWords, targetWords) {
  const cycles = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = countWords(para);

    // If adding this would exceed max AND we already have enough, finalize
    if (currentWordCount + paraWords > maxWords && currentWordCount >= minWords) {
      cycles.push({
        content: currentChunk.join("\n\n"),
        word_count: currentWordCount,
      });
      currentChunk = [para];
      currentWordCount = paraWords;
    } else {
      currentChunk.push(para);
      currentWordCount += paraWords;
    }

    // If we've hit the sweet spot, finalize
    if (currentWordCount >= targetWords && currentWordCount <= maxWords) {
      cycles.push({
        content: currentChunk.join("\n\n"),
        word_count: currentWordCount,
      });
      currentChunk = [];
      currentWordCount = 0;
    }
  }

  // Handle remaining text
  if (currentChunk.length > 0 && currentWordCount > 50) {
    if (currentWordCount < minWords / 2 && cycles.length > 0) {
      // Merge with previous
      const last = cycles[cycles.length - 1];
      last.content += "\n\n" + currentChunk.join("\n\n");
      last.word_count += currentWordCount;
    } else {
      cycles.push({
        content: currentChunk.join("\n\n"),
        word_count: currentWordCount,
      });
    }
  }

  return cycles;
}

async function main() {
  const textPath = process.argv[2];
  if (!textPath) {
    console.error('❌ Usage: node ingest-text.mjs "<path-to-text-file>"');
    process.exit(1);
  }

  const resolvedPath = path.resolve(textPath);
  console.log(`📖 Reading: ${resolvedPath}`);

  const rawText = readFileSync(resolvedPath, "utf-8");
  console.log(`📄 Raw text: ${rawText.length} characters`);

  // Extract story content only
  const paragraphs = extractStoryContent(rawText);
  const totalWords = paragraphs.reduce((sum, p) => sum + countWords(p), 0);
  console.log(`📊 Story paragraphs: ${paragraphs.length}`);
  console.log(`📊 Total words: ${totalWords}`);

  // Preview first paragraph
  console.log(`\n📖 First paragraph preview:`);
  console.log(`   "${paragraphs[0].substring(0, 100)}..."`);

  // Chunk into cycles
  const cycles = chunkParagraphs(paragraphs, MIN_WORDS, MAX_WORDS, TARGET_WORDS);

  console.log(`\n🔄 Created ${cycles.length} cycles`);
  
  // Show stats
  const wordCounts = cycles.map((c) => c.word_count);
  const avg = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
  const min = Math.min(...wordCounts);
  const max = Math.max(...wordCounts);
  console.log(`   Average: ${avg} words | Min: ${min} | Max: ${max}`);

  // Show first few and last few
  cycles.slice(0, 3).forEach((c, i) => {
    console.log(`   Cycle ${i + 1}: ${c.word_count} words — "${c.content.substring(0, 60)}..."`);
  });
  console.log(`   ...`);
  cycles.slice(-2).forEach((c, i) => {
    const idx = cycles.length - 2 + i;
    console.log(`   Cycle ${idx + 1}: ${c.word_count} words`);
  });

  // ── Upload to Supabase ──
  console.log(`\n🧹 Cleaning old data...`);
  await supabase.from("cycle_responses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("user_progress").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("reading_pairs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("cycles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("books").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // Don't delete users — they have passwords set
  console.log(`   ✅ Old data cleaned`);

  console.log(`\n⬆️  Uploading to Supabase...`);

  // 1. Create the book
  const { data: book, error: bookError } = await supabase
    .from("books")
    .insert({
      title: "Nineteen Eighty-Four",
      author: "George Orwell",
      total_cycles: cycles.length,
    })
    .select()
    .single();

  if (bookError) {
    console.error(`❌ Failed to create book: ${bookError.message}`);
    process.exit(1);
  }
  console.log(`   ✅ Book created: ${book.id}`);

  // 2. Insert cycles (in batches to avoid payload limits)
  const BATCH_SIZE = 20;
  for (let i = 0; i < cycles.length; i += BATCH_SIZE) {
    const batch = cycles.slice(i, i + BATCH_SIZE).map((c, j) => ({
      book_id: book.id,
      cycle_index: i + j,
      content: c.content,
      word_count: c.word_count,
      chapter_title: `Cycle ${i + j + 1}`,
    }));

    const { error } = await supabase.from("cycles").insert(batch);
    if (error) {
      console.error(`❌ Batch ${i}-${i + BATCH_SIZE} failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`   ✅ Cycles ${i + 1}-${Math.min(i + BATCH_SIZE, cycles.length)} inserted`);
  }

  // 3. Create reading pair
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("name", ["Ishaan", "Dhriti"]);

  if (!users || users.length < 2) {
    console.error("❌ Users not found!");
    process.exit(1);
  }

  const ishaan = users.find((u) => u.name === "Ishaan");
  const dhriti = users.find((u) => u.name === "Dhriti");

  const { data: pair, error: pairError } = await supabase
    .from("reading_pairs")
    .insert({
      book_id: book.id,
      user_a: ishaan.id,
      user_b: dhriti.id,
      status: "active",
    })
    .select()
    .single();

  if (pairError) {
    console.error(`❌ Failed to create reading pair: ${pairError.message}`);
    process.exit(1);
  }
  console.log(`   ✅ Reading pair created`);

  // 4. Initialize progress
  const { error: progressError } = await supabase.from("user_progress").insert([
    { reading_pair_id: pair.id, user_id: ishaan.id, current_cycle_index: 0, completed_cycle_index: -1 },
    { reading_pair_id: pair.id, user_id: dhriti.id, current_cycle_index: 0, completed_cycle_index: -1 },
  ]);

  if (progressError) {
    console.error(`❌ Failed to init progress: ${progressError.message}`);
    process.exit(1);
  }
  console.log(`   ✅ Progress initialized`);

  console.log(`\n🎉 Done! ${cycles.length} cycles of English text ready.`);
  console.log(`   "It was a bright cold day in April, and the clocks were striking thirteen."`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
