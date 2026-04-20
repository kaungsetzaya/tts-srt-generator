import { relations } from "drizzle-orm";
import { users, subscriptions, ttsConversions, errorLogs, settings, creditTransactions, ttsJobs } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  ttsConversions: many(ttsConversions),
  errorLogs: many(errorLogs),
  creditTransactions: many(creditTransactions),
  ttsJobs: many(ttsJobs),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const ttsConversionsRelations = relations(ttsConversions, ({ one }) => ({
  user: one(users, {
    fields: [ttsConversions.userId],
    references: [users.id],
  }),
}));

export const errorLogsRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id],
  }),
}));

export const settingsRelations = relations(settings, ({}) => ({}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
}));

export const ttsJobsRelations = relations(ttsJobs, ({ one }) => ({
  user: one(users, {
    fields: [ttsJobs.userId],
    references: [users.id],
  }),
}));
