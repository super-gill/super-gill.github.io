export type CanonicalRules = {
  normalizeLineEndings: boolean;
  unorderedListMarker: "-" | "*" | "+";
  headingStyle: "atx";
  fence: "```";
};

export const DEFAULT_RULES: CanonicalRules = {
  normalizeLineEndings: true,
  unorderedListMarker: "-",
  headingStyle: "atx",
  fence: "```",
};