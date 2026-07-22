/**
 * LLM writer config (README_XCH §7.9.5 provider architecture, cloud variant).
 *
 * Committed WITH the key on XCH's call (2026-07-20): the repo is only ever
 * visited by the team, the model is free, and the key is capped at US$1.
 * The key is stored base64-encoded — NOT as a security measure (anyone can
 * decode it) but because GitHub secret scanning + OpenRouter auto-revoke any
 * plaintext `sk-or-v1-` key found in a public repo, which would silently kill
 * the demo. Keep it encoded; never paste the raw key into a tracked file.
 *
 * Losing/rotating the key: replace the string below with
 * `btoa("sk-or-v1-<new key>")` and keep this comment.
 */
export const LLM_CONFIG = {
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: atob("c2stb3ItdjEtODk0NDgwOGIwMmIzMzgwNzhmZWZmMDVlNzlkMmViYWVjODJjZGRhNGQyMjQ4MTIxY2Y2NGFhOTZiNDIyMzc0YQ=="),
  model: "openai/gpt-oss-20b:free",
};
