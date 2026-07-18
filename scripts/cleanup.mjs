/**
 * Cleanup script — deletes all data from the database so we can re-ingest
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wldnobfobedxxmaaikud.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZG5vYmZvYmVkeHhtYWFpa3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE5MjAsImV4cCI6MjA5OTYxNzkyMH0.XUbSZmM_qI4rXrSLzTpKTq531bhWYgVJg-YZCERBLGM";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanup() {
  console.log("🧹 Cleaning up old data...");
  
  // Delete in order of dependencies
  await supabase.from("cycle_responses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("user_progress").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("reading_pairs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("cycles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("books").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  
  console.log("✅ Cleanup complete");
}

cleanup().catch(console.error);
