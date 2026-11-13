import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  documentCaptureSessions,
  documentCaptureSessionStatuses,
} from "./document-capture-sessions.js";
import {
  transactionCandidates,
  transactionCandidateStatuses,
} from "./transaction-candidates.js";
import { transactions } from "./transactions.js";
import {
  uploadKinds,
  uploads,
  uploadSources,
  uploadStatuses,
} from "./uploads.js";

function names(table: PgTable) {
  const config = getTableConfig(table);

  return {
    checks: config.checks.map((constraint) => constraint.name),
    columns: config.columns.map((column) => column.name),
    foreignKeys: config.foreignKeys.map((foreignKey) => foreignKey.getName()),
    indexes: config.indexes.map((index) => index.config.name),
    table: config.name,
    uniqueConstraints: config.uniqueConstraints.map(
      (constraint) => constraint.name,
    ),
  };
}

describe("Milestone 3 document-processing schema", () => {
  it("defines the supported upload lifecycle", () => {
    expect(uploadKinds).toEqual(["document", "audio"]);
    expect(uploadSources).toEqual(["direct", "qr_capture"]);
    expect(uploadStatuses).toEqual([
      "pending",
      "uploaded",
      "processing",
      "processed",
      "failed",
    ]);

    expect(names(uploads)).toEqual({
      checks: expect.arrayContaining([
        "uploads_kind_check",
        "uploads_source_check",
        "uploads_qr_source_document_only_check",
        "uploads_status_check",
        "uploads_byte_size_positive_check",
        "uploads_checksum_sha256_format_check",
        "uploads_failure_state_check",
        "uploads_processing_attempts_non_negative_check",
        "uploads_processing_lease_state_check",
      ]),
      columns: expect.arrayContaining([
        "user_id",
        "s3_object_key",
        "checksum_sha256",
        "failure_code",
        "processing_attempts",
        "processing_lease_id",
        "processing_lease_expires_at",
      ]),
      foreignKeys: expect.arrayContaining(["uploads_user_id_users_id_fk"]),
      indexes: expect.arrayContaining([
        "uploads_s3_object_key_unique",
        "uploads_user_id_created_at_index",
        "uploads_user_id_status_index",
        "uploads_status_created_at_id_index",
        "uploads_processing_lease_expiration_index",
      ]),
      table: "uploads",
      uniqueConstraints: expect.arrayContaining(["uploads_user_id_id_unique"]),
    });
  });

  it("enforces one expiring upload per QR capture session", () => {
    expect(documentCaptureSessionStatuses).toEqual([
      "pending",
      "consumed",
      "expired",
      "cancelled",
    ]);

    expect(names(documentCaptureSessions)).toEqual({
      checks: expect.arrayContaining([
        "document_capture_sessions_status_check",
        "document_capture_sessions_token_hash_format_check",
        "document_capture_sessions_expiration_check",
        "document_capture_sessions_consumption_state_check",
      ]),
      columns: expect.arrayContaining([
        "user_id",
        "token_hash",
        "upload_id",
        "expires_at",
        "consumed_at",
      ]),
      foreignKeys: expect.arrayContaining([
        "document_capture_sessions_user_id_users_id_fk",
        "document_capture_sessions_upload_owner_fk",
      ]),
      indexes: expect.arrayContaining([
        "document_capture_sessions_token_hash_unique",
        "document_capture_sessions_user_id_status_index",
        "document_capture_sessions_expires_at_index",
      ]),
      table: "document_capture_sessions",
      uniqueConstraints: expect.arrayContaining([
        "document_capture_sessions_upload_id_unique",
      ]),
    });
  });

  it("keeps candidates reviewable and ownership-safe before confirmation", () => {
    expect(transactionCandidateStatuses).toEqual([
      "pending",
      "confirmed",
      "rejected",
    ]);

    expect(transactionCandidates.accountId.notNull).toBe(false);
    expect(transactionCandidates.amountMinor.notNull).toBe(false);
    expect(transactionCandidates.description.notNull).toBe(false);

    expect(names(transactionCandidates)).toEqual({
      checks: expect.arrayContaining([
        "transaction_candidates_status_check",
        "transaction_candidates_amount_minor_positive_check",
        "transaction_candidates_review_state_check",
        "transaction_candidates_confirmed_fields_check",
      ]),
      columns: expect.arrayContaining([
        "upload_id",
        "position",
        "account_id",
        "category_id",
        "amount_minor",
        "extraction_metadata",
        "transaction_id",
      ]),
      foreignKeys: expect.arrayContaining([
        "transaction_candidates_user_id_users_id_fk",
        "transaction_candidates_upload_owner_fk",
        "transaction_candidates_account_owner_currency_fk",
        "transaction_candidates_category_owner_type_fk",
        "transaction_candidates_transaction_owner_fk",
      ]),
      indexes: expect.arrayContaining([
        "transaction_candidates_user_id_status_created_at_index",
        "transaction_candidates_upload_id_index",
      ]),
      table: "transaction_candidates",
      uniqueConstraints: expect.arrayContaining([
        "transaction_candidates_upload_id_position_unique",
        "transaction_candidates_transaction_id_unique",
      ]),
    });
  });

  it("exposes an ownership-safe transaction reference for confirmed candidates", () => {
    expect(names(transactions).uniqueConstraints).toContain(
      "transactions_user_id_id_unique",
    );
  });
});
