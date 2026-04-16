const fs = require('fs');
const filePath = 'frontend/src/pages/TTSGenerator.tsx';

try {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Fix the disabled state on the button
  code = code.replace(
    /dubFileMutation\.isPending \|\| dubLinkMutation\.isPending \|\| dubPreviewUrl === 'loading' \|\| dubPreviewMutation\.isPending/g,
    "startDubMutation.isPending || activeJobId !== null || dubPreviewUrl === 'loading'"
  );

  // 2. Fix the loading text inside the button AND the animated loading card
  code = code.replace(
    /\(dubFileMutation\.isPending \|\| dubLinkMutation\.isPending\)/g,
    "(startDubMutation.isPending || activeJobId !== null)"
  );

  fs.writeFileSync(filePath, code);
  console.log("✅ Success! Button and loading states are now synced to the background job.");
} catch (err) {
  console.error("❌ Error applying fix:", err.message);
}
