// Manual one-time run: fetches, dedupes, researches, scores, notifies.
// Usage: npm run generate:once
import { runLeadGenerationCycle } from "../lib/pipeline";

(async () => {
  console.log("→ starting one-shot generation cycle");
  const result = await runLeadGenerationCycle();
  console.log("✓ done", result);
  process.exit(0);
})().catch((err) => {
  console.error("✗ failed", err);
  process.exit(1);
});
