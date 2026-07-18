/**
 * ReadAlong — EPUB Ingestion Script
 *
 * Parses an EPUB file, extracts ONLY story content (no metadata, page numbers,
 * TOC, copyright, etc.), chunks it into 750-900 word "Cycles", and uploads
 * to Supabase.
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   node ingest-epub.mjs "../george orwell - 1984.epub"
 */

import { EPub } from "epub2";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────
const SUPABASE_URL = "https://wldnobfobedxxmaaikud.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZG5vYmZvYmVkeHhtYWFpa3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE5MjAsImV4cCI6MjA5OTYxNzkyMH0.XUbSZmM_qI4rXrSLzTpKTq531bhWYgVJg-YZCERBLGM";

const MIN_WORDS_PER_CYCLE = 750;
const MAX_WORDS_PER_CYCLE = 900;
const TARGET_WORDS_PER_CYCLE = 825; // sweet spot

// Chapters to skip (metadata, not story content)
const SKIP_PATTERNS = [
  /\btoc\b/i,
  /\bnav\b/i,
  /\bcover\b/i,
  /\btitle[\s-]?page\b/i,
  /\bcopyright\b/i,
  /\bdedication\b/i,
  /\bpreface\b/i,
  /\backnowledg/i,
  /\bappendix\b/i,
  /\bcolophon\b/i,
  /\babout[\s-]?(the[\s-]?)?(author|book)\b/i,
  /\bintroduction\b/i,
  /\bepigraph\b/i,
  /\bfrontmatter\b/i,
  /\bbackmatter\b/i,
  /\bindex\b/i,
  /\bbibliography\b/i,
  /\bnotes?\b/i,
  /\bglossary\b/i,
];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ───────────────────────────────────────────────

function shouldSkipChapter(id, href, title) {
  const testStrings = [id, href, title].filter(Boolean);
  return testStrings.some((s) =>
    SKIP_PATTERNS.some((pattern) => pattern.test(s))
  );
}

function cleanHtml(html) {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("nav, header, footer, aside").remove();
  $("[class*='pagenum'], [class*='page-number'], [id*='pagenum']").remove();
  $("[class*='footnote'], [class*='endnote']").remove();
  $("sup").remove();
  $("figure, figcaption, img, svg, table").remove();
  $("style, script, link").remove();

  // Extract paragraphs properly — each <p> becomes its own paragraph
  const paragraphs = [];

  // Process all block-level text elements
  $("p, h1, h2, h3, h4, h5, h6").each((_, el) => {
    const pText = $(el)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (pText.length > 0) {
      paragraphs.push(pText);
    }
  });

  // If no <p> tags found, try <div> children
  if (paragraphs.length === 0) {
    $("div").each((_, el) => {
      const divText = $(el)
        .children()
        .toArray()
        .map((child) => $(child).text().replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0);

      if (divText.length === 0) {
        const fallback = $(el).text().replace(/\s+/g, " ").trim();
        if (fallback.length > 0) paragraphs.push(fallback);
      } else {
        paragraphs.push(...divText);
      }
    });
  }

  // Final fallback — split body text by sentences if still one big block
  if (paragraphs.length <= 1 && paragraphs[0]?.length > 2000) {
    const bigText = paragraphs[0];
    // Split into ~200 word chunks by finding sentence boundaries
    const sentences = bigText.match(/[^.!?]+[.!?]+\s*/g) || [bigText];
    const newParagraphs = [];
    let current = "";

    for (const sentence of sentences) {
      if (countWords(current + sentence) > 150 && current.length > 0) {
        newParagraphs.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim().length > 0) newParagraphs.push(current.trim());
    return newParagraphs.join("\n\n");
  }

  let text = paragraphs.join("\n\n");

  // Remove page numbers (standalone numbers on a line)
  text = text.replace(/^\d{1,4}$/gm, "").trim();

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function countWords(text) {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function chunkText(allText, minWords, maxWords, targetWords) {
  // Split into paragraphs
  const paragraphs = allText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const cycles = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = countWords(para);

    // If adding this paragraph would exceed max, finalize current chunk
    if (
      currentWordCount + paraWords > maxWords &&
      currentWordCount >= minWords
    ) {
      cycles.push({
        content: currentChunk.join("\n\n"),
        word_count: currentWordCount,
      });
      currentChunk = [para];
      currentWordCount = paraWords;
    } else if (currentWordCount + paraWords > maxWords * 1.2) {
      // Way too long — force split even if under min
      if (currentChunk.length > 0) {
        cycles.push({
          content: currentChunk.join("\n\n"),
          word_count: currentWordCount,
        });
      }
      currentChunk = [para];
      currentWordCount = paraWords;
    } else {
      currentChunk.push(para);
      currentWordCount += paraWords;
    }

    // If we've reached the target, consider finalizing
    if (currentWordCount >= targetWords && currentWordCount <= maxWords) {
      cycles.push({
        content: currentChunk.join("\n\n"),
        word_count: currentWordCount,
      });
      currentChunk = [];
      currentWordCount = 0;
    }
  }

  // Don't lose the last chunk
  if (currentChunk.length > 0 && currentWordCount > 50) {
    // If the last chunk is too small, merge with previous
    if (currentWordCount < minWords / 2 && cycles.length > 0) {
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

// ── Main ──────────────────────────────────────────────────

async function main() {
  const epubPath = process.argv[2];
  if (!epubPath) {
    console.error(
      '❌ Usage: node ingest-epub.mjs "<path-to-epub>"'
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(epubPath);
  console.log(`📖 Parsing: ${resolvedPath}`);

  // Parse EPUB
  const epub = await EPub.createAsync(resolvedPath);

  console.log(`📚 Title: ${epub.metadata.title}`);
  console.log(`✍️  Author: ${epub.metadata.creator}`);
  console.log(`📑 Chapters in spine: ${epub.flow.length}`);

  // Extract clean text from each chapter
  let allStoryText = "";
  let chaptersUsed = 0;
  let chaptersSkipped = 0;

  for (const chapter of epub.flow) {
    const id = chapter.id || "";
    const href = chapter.href || "";
    const title = chapter.title || "";

    if (shouldSkipChapter(id, href, title)) {
      console.log(`  ⏭ Skipping: ${id} (${href}) — metadata`);
      chaptersSkipped++;
      continue;
    }

    try {
      const html = await epub.getChapterAsync(chapter.id);
      const cleanText = cleanHtml(html);
      const wordCount = countWords(cleanText);

      if (wordCount < 50) {
        console.log(
          `  ⏭ Skipping: ${id} — too short (${wordCount} words)`
        );
        chaptersSkipped++;
        continue;
      }

      console.log(`  ✅ Chapter: ${id} — ${wordCount} words`);
      allStoryText += cleanText + "\n\n";
      chaptersUsed++;
    } catch (err) {
      console.log(`  ⚠️ Error reading ${id}: ${err.message}`);
      chaptersSkipped++;
    }
  }

  const totalWords = countWords(allStoryText);
  console.log(`\n📊 Total story text: ${totalWords} words`);
  console.log(`   Chapters used: ${chaptersUsed}, skipped: ${chaptersSkipped}`);

  // Chunk into cycles
  const cycles = chunkText(
    allStoryText,
    MIN_WORDS_PER_CYCLE,
    MAX_WORDS_PER_CYCLE,
    TARGET_WORDS_PER_CYCLE
  );

  console.log(`\n🔄 Created ${cycles.length} cycles`);
  cycles.forEach((c, i) => {
    console.log(`   Cycle ${i + 1}: ${c.word_count} words`);
  });

  // Upload to Supabase
  console.log(`\n⬆️  Uploading to Supabase...`);

  // 1. Create the book
  const { data: book, error: bookError } = await supabase
    .from("books")
    .insert({
      title: epub.metadata.title || "1984",
      author: epub.metadata.creator || "George Orwell",
      total_cycles: cycles.length,
    })
    .select()
    .single();

  if (bookError) {
    console.error(`❌ Failed to create book: ${bookError.message}`);
    process.exit(1);
  }

  console.log(`   ✅ Book created: ${book.id}`);

  // 2. Insert all cycles
  const cycleRows = cycles.map((c, i) => ({
    book_id: book.id,
    cycle_index: i,
    content: c.content,
    word_count: c.word_count,
    chapter_title: `Cycle ${i + 1}`,
  }));

  const { error: cycleError } = await supabase
    .from("cycles")
    .insert(cycleRows);

  if (cycleError) {
    console.error(`❌ Failed to insert cycles: ${cycleError.message}`);
    process.exit(1);
  }

  console.log(`   ✅ ${cycles.length} cycles inserted`);

  // 3. Create reading pair (Ishaan + Dhriti)
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("name", ["Ishaan", "Dhriti"]);

  if (!users || users.length < 2) {
    console.error("❌ Users not found. Did you run the migration?");
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

  console.log(`   ✅ Reading pair created: ${pair.id}`);

  // 4. Create initial progress for both users
  const { error: progressError } = await supabase
    .from("user_progress")
    .insert([
      {
        reading_pair_id: pair.id,
        user_id: ishaan.id,
        current_cycle_index: 0,
        completed_cycle_index: -1,
      },
      {
        reading_pair_id: pair.id,
        user_id: dhriti.id,
        current_cycle_index: 0,
        completed_cycle_index: -1,
      },
    ]);

  if (progressError) {
    console.error(
      `❌ Failed to create progress: ${progressError.message}`
    );
    process.exit(1);
  }

  console.log(`   ✅ Progress initialized for both users`);

  console.log(`\n🎉 Done! ${cycles.length} cycles ready for reading.`);
  console.log(`   Book: "${epub.metadata.title}" by ${epub.metadata.creator}`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
