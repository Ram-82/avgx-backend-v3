import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const avgxIndex = pgTable("avgx_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  value: decimal("value", { precision: 18, scale: 8 }).notNull(),
  wfValue: decimal("wf_value", { precision: 18, scale: 8 }).notNull(),
  wcValue: decimal("wc_value", { precision: 18, scale: 8 }).notNull(),
  change24h: decimal("change_24h", { precision: 5, scale: 2 }),
});

export const fiatRates = pgTable("fiat_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currency: varchar("currency", { length: 3 }).notNull(),
  rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
  weight: decimal("weight", { precision: 5, scale: 4 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const cryptoPrices = pgTable("crypto_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }).notNull(),
  weight: decimal("weight", { precision: 5, scale: 4 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AVGX Coin tables
export const avgxCoinTransactions = pgTable("avgx_coin_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  transactionHash: text("transaction_hash").notNull().unique(),
  type: text("type").notNull(), // 'mint', 'redeem', 'transfer'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  avgxPrice: decimal("avgx_price", { precision: 18, scale: 8 }).notNull(),
  chain: text("chain").notNull(), // 'ethereum', 'polygon'
  status: text("status").notNull().default('pending'), // 'pending', 'confirmed', 'failed'
  blockNumber: text("block_number"),
  gasUsed: text("gas_used"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const avgxReserves = pgTable("avgx_reserves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalSupply: decimal("total_supply", { precision: 18, scale: 8 }).notNull().default('0'),
  backingValue: decimal("backing_value", { precision: 18, scale: 8 }).notNull().default('0'),
  collateralRatio: decimal("collateral_ratio", { precision: 5, scale: 4 }).notNull().default('1.0000'),
  fiatReserves: jsonb("fiat_reserves").notNull().default('{}'),
  cryptoReserves: jsonb("crypto_reserves").notNull().default('{}'),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const pegData = pgTable("peg_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  avgxIndex: decimal("avgx_index", { precision: 18, scale: 8 }).notNull(),
  coinPrice: decimal("coin_price", { precision: 18, scale: 8 }).notNull(),
  pegDeviation: decimal("peg_deviation", { precision: 5, scale: 4 }).notNull(), // percentage
  rebalanceNeeded: text("rebalance_needed").notNull().default('false'),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  firstName: true,
  lastName: true,
  email: true,
  subject: true,
  message: true,
});

export const insertAvgxIndexSchema = createInsertSchema(avgxIndex).pick({
  value: true,
  wfValue: true,
  wcValue: true,
  change24h: true,
});

export const insertTransactionSchema = createInsertSchema(avgxCoinTransactions).pick({
  walletAddress: true,
  transactionHash: true,
  type: true,
  amount: true,
  avgxPrice: true,
  chain: true,
  status: true,
  blockNumber: true,
  gasUsed: true,
});

export const insertReservesSchema = createInsertSchema(avgxReserves).pick({
  totalSupply: true,
  backingValue: true,
  collateralRatio: true,
  fiatReserves: true,
  cryptoReserves: true,
});

export const insertPegDataSchema = createInsertSchema(pegData).pick({
  avgxIndex: true,
  coinPrice: true,
  pegDeviation: true,
  rebalanceNeeded: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertAvgxIndex = z.infer<typeof insertAvgxIndexSchema>;
export type AvgxIndex = typeof avgxIndex.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type AvgxTransaction = typeof avgxCoinTransactions.$inferSelect;

export type InsertReserves = z.infer<typeof insertReservesSchema>;
export type AvgxReserves = typeof avgxReserves.$inferSelect;

export type InsertPegData = z.infer<typeof insertPegDataSchema>;
export type PegData = typeof pegData.$inferSelect;

export type FiatRate = typeof fiatRates.$inferSelect;
export type CryptoPrice = typeof cryptoPrices.$inferSelect;
