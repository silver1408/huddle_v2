-- Migration: 002_interactive_features.sql
-- Description: Adds tables for highlights and paragraph-level notes.

CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_pair_id UUID REFERENCES reading_pairs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cycle_index INTEGER NOT NULL,
    paragraph_index INTEGER NOT NULL,
    start_char INTEGER NOT NULL,
    end_char INTEGER NOT NULL,
    text_snippet TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast retrieval per cycle
CREATE INDEX IF NOT EXISTS idx_highlights_cycle ON highlights(reading_pair_id, cycle_index);

CREATE TABLE IF NOT EXISTS paragraph_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_pair_id UUID REFERENCES reading_pairs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cycle_index INTEGER NOT NULL,
    paragraph_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast retrieval per cycle
CREATE INDEX IF NOT EXISTS idx_paragraph_notes_cycle ON paragraph_notes(reading_pair_id, cycle_index);
