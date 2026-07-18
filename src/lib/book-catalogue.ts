export interface BookMeta {
  id: string           // slug used as DB id lookup
  slug: string
  title: string
  author: string
  gutenbergId: number | null
  totalCycles: number
  description: string
  /** Tailwind gradient classes for the book card */
  gradient: string
  /** Approximate reading level label */
  era: string
}

export const BOOKS: BookMeta[] = [
  {
    id: "nineteen-eighty-four",
    slug: "nineteen-eighty-four",
    title: "Nineteen Eighty-Four",
    author: "George Orwell",
    gutenbergId: null, // local file
    totalCycles: 112,
    description:
      "In a totalitarian future, Winston Smith risks everything to rebel against the Party and its omniscient leader, Big Brother.",
    gradient: "from-stone-900 to-stone-700",
    era: "1949 · Dystopia",
  },
  {
    id: "pride-and-prejudice",
    slug: "pride-and-prejudice",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    gutenbergId: 1342,
    totalCycles: 118,
    description:
      "Elizabeth Bennet navigates love, class, and societal expectations in Regency-era England, clashing with the proud Mr. Darcy.",
    gradient: "from-rose-900 to-rose-700",
    era: "1813 · Romance",
  },
  {
    id: "sherlock-holmes",
    slug: "sherlock-holmes",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    gutenbergId: 1661,
    totalCycles: 48,
    description:
      "Twelve classic short stories following the world's greatest detective and his faithful companion Dr. Watson.",
    gradient: "from-amber-900 to-amber-700",
    era: "1892 · Mystery",
  },
  {
    id: "dracula",
    slug: "dracula",
    title: "Dracula",
    author: "Bram Stoker",
    gutenbergId: 345,
    totalCycles: 163,
    description:
      "Told through journal entries and letters, Jonathan Harker's encounter with Count Dracula sets off a terrifying gothic chase across Europe.",
    gradient: "from-zinc-900 to-red-950",
    era: "1897 · Gothic Horror",
  },
  {
    id: "frankenstein",
    slug: "frankenstein",
    title: "Frankenstein",
    author: "Mary Shelley",
    gutenbergId: 84,
    totalCycles: 57,
    description:
      "Victor Frankenstein's obsession with creating life leads to tragedy — for himself and the creature he abandons.",
    gradient: "from-slate-900 to-slate-700",
    era: "1818 · Gothic",
  },
  {
    id: "great-gatsby",
    slug: "great-gatsby",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    gutenbergId: 64317,
    totalCycles: 39,
    description:
      "Nick Carraway narrates the rise and fall of the mysterious Jay Gatsby amidst the excess and disillusionment of the Jazz Age.",
    gradient: "from-emerald-900 to-teal-800",
    era: "1925 · Literary Fiction",
  },
]

export function getBookBySlug(slug: string): BookMeta | undefined {
  return BOOKS.find((b) => b.slug === slug)
}
