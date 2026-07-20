/**
 * LLM writer config (README_XCH §7.9.5 provider architecture, cloud variant).
 * Copy this file to `llm-config.js` (same directory) and fill in a real API key
 * to enable the LLM-drafted report on your machine. `llm-config.js` is
 * gitignored on purpose: the repo is public and OpenRouter revokes any key it
 * finds on GitHub. Without it, ST7 falls back to the rules-based template —
 * the product never depends on the LLM being reachable.
 */
export const LLM_CONFIG = {
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "sk-or-v1-REPLACE_ME",
  model: "openai/gpt-oss-20b:free",
};
