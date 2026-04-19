import "dotenv/config";
import { getDb } from "../db";
import { users, subscriptions, creditTransactions } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

async function run() {
  console.log("==========================================");
  console.log("   RETROACTIVE TRIAL CREDITS FIXER");
  console.log("==========================================\n");

  const db = await getDb();
  if (!db) {
    console.error("[ERROR] Failed to connect to database. Make sure your .env has DATABASE_URL.");
    process.exit(1);
  }

  console.log("[INFO] Connected to Database successfully.");

  // Fetch all users
  const allUsers = await db.select().from(users);
  console.log(`[INFO] Checked ${allUsers.length} total users in DB.`);

  let fixedCount = 0;
  let skippedHasTrial = 0;
  let skippedHasCredits = 0;

  for (const user of allUsers) {
    // Check if user already has a trial subscription history
    const userSubs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    const hasTrial = userSubs.some((s: typeof userSubs[0]) => s.plan === "trial");

    if (hasTrial) {
      skippedHasTrial++;
      continue;
    }

    // Check if user already got credits manually or from some other source
    // We only retro-fix users who joined and got stuck at 0 or null credits
    const currentCredits = user.credits ?? 0;
    if (currentCredits > 0) {
      skippedHasCredits++;
      continue;
    }

    console.log(`[Action] Fixing user: @${user.telegramUsername || user.id} (${user.telegramFirstName})`);
       
    // 1. Give Trial Subscription (10 years / 3650 days)
    await db.insert(subscriptions).values({
      id: randomUUID(),
      userId: user.id,
      plan: "trial",
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 3650 * 86400000), 
      note: "Retroactive Bug Fix Trial",
      paymentMethod: "free"
    });

    // 2. Add 15 Credits
    await db.update(users).set({ credits: currentCredits + 15 }).where(eq(users.id, user.id));

    // 3. Log Credit Transaction
    await db.insert(creditTransactions).values({
      id: randomUUID(),
      userId: user.id,
      amount: 15,
      type: "subscription",
      description: "Retroactive 15 free credits (Bug Fix)"
    });

    fixedCount++;
  }

  console.log("\n==========================================");
  console.log("   EXECUTION COMPLETE");
  console.log(`   Fixed Users: ${fixedCount}`);
  console.log(`   Skipped (Already had trial): ${skippedHasTrial}`);
  console.log(`   Skipped (Has >0 credits via other means): ${skippedHasCredits}`);
  console.log("==========================================");
  
  process.exit(0);
}

run().catch((err) => {
  console.error("[CRITICAL ERROR]", err);
  process.exit(1);
});
