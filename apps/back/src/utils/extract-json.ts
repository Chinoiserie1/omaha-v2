/**
 * Extracts and parses JSON from an LLM response that may be wrapped
 * in markdown code fences with optional trailing text.
 */
export function extractJson(raw: string): unknown {
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const jsonStr = fenceMatch ? fenceMatch[1]! : raw;
  return JSON.parse(jsonStr.trim());
}
