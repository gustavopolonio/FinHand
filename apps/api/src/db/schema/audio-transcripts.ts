import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { uploads } from "./uploads.js";
import { users } from "./users.js";

export interface AudioTranscriptMetadata {
  languageCodes?: string[];
  usage?: {
    type: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    seconds?: number;
  };
}

export const audioTranscripts = pgTable(
  "audio_transcripts",
  {
    uploadId: uuid("upload_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    metadata: jsonb("metadata").$type<AudioTranscriptMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "audio_transcripts_text_not_blank_check",
      sql`length(btrim(${table.text})) > 0`,
    ),
    check(
      "audio_transcripts_model_not_blank_check",
      sql`length(btrim(${table.model})) > 0`,
    ),
    foreignKey({
      name: "audio_transcripts_upload_owner_fk",
      columns: [table.userId, table.uploadId],
      foreignColumns: [uploads.userId, uploads.id],
    }).onDelete("restrict"),
    index("audio_transcripts_user_id_created_at_index").on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);
