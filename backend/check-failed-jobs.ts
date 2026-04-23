import { getDb } from "./db";
import * as schema from "../shared/drizzle/schema";
import { desc } from "drizzle-orm";

async function check() {
  const db = await getDb();
  if (!db) {
    console.log("DB not available");
    return;
  }
  const jobs = await db.select().from(schema.ttsJobs).orderBy(desc(schema.ttsJobs.updatedAt)).limit(10);
  console.log(jobs.map((j: any) => ({ id: j.id, status: j.status, error: j.error, updatedAt: j.updatedAt })));
}

check();
