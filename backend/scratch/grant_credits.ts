
import { addCredits } from "../routers/credits";

async function main() {
  const userId = "la214cax85";
  const amount = 100;
  console.log(`[Granting] Adding ${amount} credits to user ${userId}...`);
  
  const success = await addCredits(userId, amount, "admin_grant", "Manual grant for testing dubbing fixes");
  
  if (success) {
    console.log("[Success] Credits granted successfully!");
  } else {
    console.error("[Error] Failed to grant credits.");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
