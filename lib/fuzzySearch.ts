/**
 * Lightweight, zero-dependency fuzzy search and typo tolerance engine
 */

export interface FuzzyOption {
  value: string;
  label?: string;
  aliases?: string[];
  description?: string;
}

export interface FuzzyMatchResult<T extends string | FuzzyOption> {
  item: T;
  score: number;
  isTypoSuggestion: boolean;
  canonicalValue: string;
}

/**
 * Calculates Damerau-Levenshtein Distance between two strings
 * Handles insertions, deletions, substitutions, and adjacent character transpositions
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];

  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        min = Math.min(min, matrix[i - 2][j - 2] + cost);
      }

      matrix[i][j] = min;
    }
  }

  return matrix[al][bl];
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Evaluates how well a query string matches a candidate string
 * Returns score (0 - 100) and whether it counts as a fuzzy typo suggestion
 */
function scoreMatch(
  rawQuery: string,
  rawTarget: string
): { score: number; isTypo: boolean } {
  const query = rawQuery.trim().toLowerCase();
  const target = rawTarget.trim().toLowerCase();

  if (!query) return { score: 100, isTypo: false };
  if (query === target) return { score: 100, isTypo: false };

  const cleanQ = cleanString(query);
  const cleanT = cleanString(target);

  if (cleanQ === cleanT) return { score: 98, isTypo: false };

  // Exact prefix match
  if (target.startsWith(query) || cleanT.startsWith(cleanQ)) {
    const ratio = cleanQ.length / Math.max(cleanT.length, 1);
    return { score: 90 + Math.round(ratio * 8), isTypo: false };
  }

  // Word boundary prefix match (e.g. "Suzuki" in "Maruti Suzuki", or "Benz" in "Mercedes-Benz")
  const targetWords = target.split(/[\s-_]+/);
  for (const word of targetWords) {
    if (word === query || cleanString(word) === cleanQ) {
      return { score: 88, isTypo: false };
    }
    if (word.startsWith(query) || cleanString(word).startsWith(cleanQ)) {
      return { score: 85, isTypo: false };
    }
  }

  // Substring match
  if (target.includes(query) || cleanT.includes(cleanQ)) {
    const ratio = cleanQ.length / Math.max(cleanT.length, 1);
    return { score: 80 + Math.round(ratio * 5), isTypo: false };
  }

  // Check each word in target for typo tolerance
  let bestWordScore = 0;
  for (const word of targetWords) {
    const cleanW = cleanString(word);
    if (cleanW.length >= 3 && cleanQ.length >= 3) {
      const dist = damerauLevenshteinDistance(cleanQ, cleanW);
      const maxL = Math.max(cleanQ.length, cleanW.length);
      const maxAllowedDist = maxL <= 4 ? 1 : maxL <= 8 ? 2 : 3;

      if (dist <= maxAllowedDist) {
        const similarity = 1 - dist / maxL;
        if (similarity >= 0.6) {
          const s = 65 + Math.round(similarity * 20);
          if (s > bestWordScore) bestWordScore = s;
        }
      }
    }
  }
  if (bestWordScore > 0) {
    return { score: bestWordScore, isTypo: true };
  }

  // Whole string typo distance
  if (cleanQ.length >= 3 && cleanT.length >= 3) {
    const dist = damerauLevenshteinDistance(cleanQ, cleanT);
    const maxL = Math.max(cleanQ.length, cleanT.length);
    const maxAllowedDist = maxL <= 4 ? 1 : maxL <= 7 ? 2 : 3;

    if (dist <= maxAllowedDist) {
      const similarity = 1 - dist / maxL;
      if (similarity >= 0.6) {
        return { score: 60 + Math.round(similarity * 20), isTypo: true };
      }
    }
  }

  // Subsequence match
  let qIdx = 0;
  for (let tIdx = 0; tIdx < cleanT.length && qIdx < cleanQ.length; tIdx++) {
    if (cleanT[tIdx] === cleanQ[qIdx]) {
      qIdx++;
    }
  }
  if (qIdx === cleanQ.length && cleanQ.length >= 3) {
    const ratio = cleanQ.length / cleanT.length;
    if (ratio >= 0.45) {
      return { score: 45 + Math.round(ratio * 15), isTypo: true };
    }
  }

  return { score: 0, isTypo: false };
}

/**
 * Filter and sort items based on fuzzy query matching
 */
export function fuzzyFilter<T extends string | FuzzyOption>(
  items: T[],
  query: string,
  minScore = 45
): FuzzyMatchResult<T>[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return items.map((item) => {
      const canonical = typeof item === "string" ? item : item.value;
      return {
        item,
        score: 100,
        isTypoSuggestion: false,
        canonicalValue: canonical,
      };
    });
  }

  const results: FuzzyMatchResult<T>[] = [];

  for (const item of items) {
    let canonical = "";
    let label = "";
    let aliases: string[] = [];

    if (typeof item === "string") {
      canonical = item;
      label = item;
    } else {
      canonical = item.value;
      label = item.label || item.value;
      aliases = item.aliases || [];
    }

    // Score against label / canonical value
    let best = scoreMatch(trimmed, label);
    if (label !== canonical) {
      const canonScore = scoreMatch(trimmed, canonical);
      if (canonScore.score > best.score) {
        best = canonScore;
      }
    }

    // Score against aliases
    for (const alias of aliases) {
      const aliasScore = scoreMatch(trimmed, alias);
      if (aliasScore.score > best.score) {
        best = {
          score: Math.min(aliasScore.score, 92),
          isTypo: aliasScore.isTypo,
        };
      }
    }

    if (best.score >= minScore) {
      results.push({
        item,
        score: best.score,
        isTypoSuggestion: best.isTypo,
        canonicalValue: canonical,
      });
    }
  }

  // Sort results by score descending, then alphabetically by canonical value
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.canonicalValue.localeCompare(b.canonicalValue);
  });

  return results;
}
