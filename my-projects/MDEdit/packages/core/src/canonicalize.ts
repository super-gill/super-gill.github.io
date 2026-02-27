import { CanonicalRules, DEFAULT_RULES } from "./rules";

export type CanonWarning = { code: string; message: string };

export function canonicalizeMarkdown(
  input: string,
  rules: CanonicalRules = DEFAULT_RULES
): { markdown: string; warnings: CanonWarning[] } {
  const warnings: CanonWarning[] = [];

  let md = input ?? "";

  if (rules.normalizeLineEndings) {
    md = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  // Trim trailing whitespace on each line
  md = md.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n");

  // Ensure file ends with a single newline
  md = md.replace(/\s*$/g, "") + "\n";

  // v0: we are not yet doing full AST canonicalization.
  // We'll replace this with remark/unified-based normalization in v0.2.
  warnings.push({
    code: "CANON_V0_SIMPLE",
    message: "Canonicalization is running in v0 simple mode (AST normalization not yet enabled).",
  });

  return { markdown: md, warnings };
}