# FinHand — Development Roadmap

## Milestone 1 — Project Foundation

**Status:** Completed

### Tasks
- [x] Define the initial database schema
- [x] Set up the monorepo structure
- [x] Configure PostgreSQL using Docker Compose
- [x] Configure Drizzle ORM
- [x] Create and run the first database migration
- [x] Set up the Fastify backend
- [x] Set up the Next.js frontend

### Acceptance Criteria
- PostgreSQL runs locally.
- Database migrations execute successfully.
- Backend health-check endpoint responds.
- Frontend starts successfully.
- Type checking passes.

## Milestone 2 — Financial Core

**Status:** Completed

### Tasks
- [x] Implement user authentication
- [x] Implement accounts
- [x] Implement categories
- [x] Implement transaction CRUD
- [x] Implement financial summary calculations
- [x] Build the financial dashboard
- [x] Add automated tests

## Milestone 3 — AI Document Processing

**Status:** Completed

### Tasks
- [x] Design and migrate the data model for uploads, document capture sessions, and transaction candidates
- [x] Implement secure private image and PDF uploads using Amazon S3
- [x] Validate supported file types, file sizes, checksums, and ownership
- [x] Implement upload processing state transition rules
- [x] Build the direct document upload flow for desktop and mobile browsers
- [x] Build the mobile receipt camera capture flow
- [x] Implement short-lived, single-use QR capture sessions for desktop-to-mobile handoff
- [x] Implement periodic cleanup to mark expired pending document capture sessions as `expired`
- [x] Synchronize capture and processing status between the mobile capture page and initiating desktop session
- [x] Extract structured transaction candidates from receipt images and PDF files
- [x] Validate and normalize extracted amounts, currency, dates, descriptions, and counterparties
- [x] Build the transaction candidate review and editing interface
- [x] Display private source documents during candidate review using short-lived S3 presigned URLs
- [x] Require explicit user confirmation before creating an authoritative transaction
- [x] Store confirmed transactions with `document` origin and preserve their source-candidate relationship
- [x] Let users discard pending transaction candidates by marking them as `rejected`
- [x] Implement manual retry for retryable failed document processing
- [x] Recover uploads stuck after interrupted worker processing
- [x] Show original source documents on document-origin transaction details
- [x] Build a persistent, dismissible import-issues section for unresolved failures
- [x] Add automated tests for uploads, ownership, QR expiration and replay prevention, extraction, and confirmation

### Acceptance Criteria
- Users can upload supported receipt images and PDF files directly from desktop or mobile.
- Mobile users can open the device camera from FinHand and submit a receipt photo.
- Desktop users can display a QR code, scan it with a phone, and submit a receipt to the same capture session.
- QR capture tokens are unguessable, expire quickly, work only once, and grant upload access only.
- The initiating desktop session displays capture, upload, processing, failure, and ready-for-review states without requiring a page reload.
- AI extraction produces a reviewable transaction candidate and never changes balances before confirmation.
- Users can correct extracted fields, select an account and category, confirm the transaction, or reject the candidate.
- Confirming a candidate creates exactly one transaction and cannot be replayed to create duplicates.
- Uploaded documents remain private and every upload, candidate, and resulting transaction is scoped to its owning user.

## Milestone 4 — Voice Input

**Status:** Completed

### Tasks
- [x] Build authenticated browser microphone recording for desktop and mobile with pause, resume, live input-level feedback, playback, discard-and-restart, and an automatic 30-second active-recording limit; do not expose an audio-file picker
- [x] Validate recorded audio format, byte size, actual duration, checksum, and ownership before storing it privately as an `audio` upload
- [x] Transcribe completed recordings asynchronously using the OpenAI file transcription API
- [x] Extract and normalize one or more ordered transaction candidates from each audio transcript in the same asynchronous audio worker
- [x] Reuse the candidate review and editing interface for voice recordings, provide private recording playback, and require explicit confirmation or rejection of every candidate
- [x] Add automated tests for recording validation, ownership, transcription failures, multiple candidates, and replay-safe confirmation

### Acceptance Criteria
- Users can record microphone audio from supported desktop and mobile browsers without selecting an existing audio file.
- Users can pause and resume without paused time consuming the 30-second allowance, and a live input meter makes silence and captured speech visibly distinguishable.
- Recording stops automatically after 30 seconds of captured audio, and the backend independently rejects recordings that exceed the duration or size limits.
- Audio is stored privately in the shared uploads bucket and is scoped to its authenticated owner.
- A completed recording is transcribed without exposing the OpenAI API key to the browser.
- One recording may produce multiple ordered transaction candidates.
- No extracted candidate affects balances until the user explicitly confirms it; candidates from the same recording can be confirmed or rejected independently.

## Milestone 5 — Production Readiness

**Status:** In Progress

### Tasks
- [x] Configure CI quality gates for backend and frontend tests, linting, type checking, production builds, and migration validation
- [x] Add an isolated PostgreSQL integration-test database and cover worker lease expiry, recovery, `FOR UPDATE SKIP LOCKED`, and stale-lease rejection using concurrent connections
- [x] Define and provision the cost-conscious AWS production environment on one EC2 host, including Docker Compose, secrets, OAuth, PostgreSQL, S3, OpenAI configuration, backups, and a least-privilege instance role; defer staging until operational risk justifies it
- [x] Configure structured logging with request and job correlation IDs, safe error serialization, and sensitive-data redaction
- [x] Implement application, worker, infrastructure, and AI observability with actionable alerts:
  - [x] Define retained CloudWatch log groups, least-privilege log publishing, and production container log shipping
  - [x] Collect infrastructure and container-health metrics
  - [x] Derive minimal unexpected API and worker failure signals from structured logs
  - [x] Add a minimal safe AI provider-failure signal and use the production OpenAI project dashboard for usage and cost
  - [x] Configure actionable alarms, SNS email notifications, and a compact production dashboard
- [x] Replace the hardcoded production AMI ID with an explicitly controlled refresh strategy before the next EC2 replacement or operating-system upgrade
- [x] Introduce opaque random storage namespaces for new uploads while retaining backward-compatible access to existing object keys
- [x] Provision a correctly named shared development uploads bucket, update development IAM and configuration, discard disposable pre-V1 upload data without migration, and retire the document-specific bucket; retain the existing production uploads bucket
- [ ] Replace document- and audio-status polling with server-pushed updates using SSE or WebSockets
- [ ] Harden public endpoints with production CORS, security headers, rate limits, request limits, and abuse protection
- [ ] Define safe same-host PostgreSQL migration, connection-pool, encrypted backup, restore, and worker deployment procedures
- [ ] Blur document previews by default and let users temporarily reveal or reapply the blur
- [ ] Review and polish responsive behavior, accessibility, UI styles, interaction details, and visual consistency across the application
- [ ] Configure a manually approved production deployment pipeline that publishes immutable images and updates the EC2 Docker Compose application through AWS Systems Manager
- [ ] Run pre-deployment restore drills, security checks, and representative performance/load tests; resolve release-blocking findings
- [ ] Deploy the production application and verify health checks, workers, OAuth, uploads, AI processing, alerts, and rollback procedures

### Acceptance Criteria
- Every change passes automated quality gates before deployment.
- Production uses dedicated credentials and least-privilege access that are isolated from local development and CI.
- Logs, traces, metrics, and alerts diagnose API, worker, database, storage, and AI failures without exposing financial data or credentials.
- Upload storage uses the shared bucket and opaque object keys.
- Database migrations, backups, restores, worker deployment, and application rollback have verified procedures.
- Security, accessibility, and representative load checks have no unresolved release-blocking findings.
- The production deployment passes non-destructive end-to-end smoke tests for authentication, financial CRUD, document processing, QR capture, and voice input.

## Backlog — Post-V1

Backlog items are intentionally excluded from the V1 release scope and are not
required to complete Production Readiness.

### Storage Lifecycle

- [ ] Define and implement retention cleanup for abandoned database records, transcripts, and S3 objects without deleting active user data

### RAG Financial Assistant

- [ ] Define privacy, consent, retention, and source-citation requirements for document knowledge
- [ ] Implement document text extraction and chunking
- [ ] Generate and store embeddings using pgvector
- [ ] Implement user-scoped semantic retrieval
- [ ] Generate source-grounded answers with citations
- [ ] Create retrieval and answer-quality evaluation datasets
