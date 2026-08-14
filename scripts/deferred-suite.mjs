const suite = process.argv[2];
const reasons = {
  "test:e2e": "No player-facing game flow exists before the interface phases.",
};

if (!suite || !(suite in reasons)) {
  console.error("A known deferred suite name is required.");
  process.exit(1);
}

console.log(`[${suite}] DEFERRED: ${reasons[suite]}`);
