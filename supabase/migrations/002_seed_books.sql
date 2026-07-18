-- ReadAlong v2 — Seed Books
-- Run AFTER 001_v2_schema.sql
-- Inserts metadata only. No content is stored — text is fetched from Gutenberg at runtime.

insert into public.books (slug, title, author, gutenberg_id, total_cycles, description, cover_url) values

('nineteen-eighty-four',
 'Nineteen Eighty-Four',
 'George Orwell',
 null,  -- loaded from local file (included in repo)
 112,
 'In a totalitarian future, Winston Smith risks everything to rebel against the Party and its omniscient leader, Big Brother.',
 null),

('pride-and-prejudice',
 'Pride and Prejudice',
 'Jane Austen',
 1342,
 118,
 'Elizabeth Bennet navigates love, class, and societal expectations in Regency-era England, clashing with the proud Mr. Darcy.',
 null),

('sherlock-holmes',
 'The Adventures of Sherlock Holmes',
 'Arthur Conan Doyle',
 1661,
 48,
 'Twelve classic short stories following the world''s greatest detective and his faithful companion Dr. Watson.',
 null),

('dracula',
 'Dracula',
 'Bram Stoker',
 345,
 163,
 'Told through journal entries and letters, Jonathan Harker''s encounter with Count Dracula sets off a terrifying gothic chase across Europe.',
 null),

('frankenstein',
 'Frankenstein',
 'Mary Shelley',
 84,
 57,
 'Victor Frankenstein''s obsession with creating life leads to tragedy — for himself and the creature he abandons.',
 null),

('great-gatsby',
 'The Great Gatsby',
 'F. Scott Fitzgerald',
 64317,
 39,
 'Nick Carraway narrates the rise and fall of the mysterious Jay Gatsby amidst the excess and disillusionment of the Jazz Age.',
 null);
