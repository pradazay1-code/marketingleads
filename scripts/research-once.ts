// Manual deep-research worker tick.
// Usage: npm run research:once
import { runDeepResearchCycle } from "../lib/pipeline";

(async () => {
  console.log("→ running one deep-research tick");
  const result = await runDeepResearchCycle();
  console.log("✓ done", result);
  process.exit(0);
})().catch((err) => {
  console.error("✗ failed", err);
  process.exit(1);
});
