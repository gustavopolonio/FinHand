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

**Status:** In Progress

### Tasks
- [x] Build authenticated browser microphone recording for desktop and mobile with pause, resume, live input-level feedback, playback, discard-and-restart, and an automatic 30-second active-recording limit; do not expose an audio-file picker
- [x] Validate recorded audio format, byte size, actual duration, checksum, and ownership before storing it privately as an `audio` upload
- [x] Transcribe completed recordings asynchronously using the OpenAI file transcription API
- [ ] Extract and normalize one or more transaction candidates from each audio transcript
- [ ] Reuse the candidate review and editing interface and require explicit confirmation or rejection of every candidate
- [ ] Add automated tests for recording validation, ownership, transcription failures, multiple candidates, and replay-safe confirmation

### Acceptance Criteria
- Users can record microphone audio from supported desktop and mobile browsers without selecting an existing audio file.
- Users can pause and resume without paused time consuming the 30-second allowance, and a live input meter makes silence and captured speech visibly distinguishable.
- Recording stops automatically after 30 seconds of captured audio, and the backend independently rejects recordings that exceed the duration or size limits.
- Audio is stored privately in the shared uploads bucket and is scoped to its authenticated owner.
- A completed recording is transcribed without exposing the OpenAI API key to the browser.
- One recording may produce multiple ordered transaction candidates.
- No extracted candidate affects balances until the user explicitly confirms it; candidates from the same recording can be confirmed or rejected independently.

## Milestone 5 — RAG Financial Assistant

**Status:** Not Started

### Tasks
- [ ] Implement document text extraction and chunking
- [ ] Generate and store embeddings using pgvector
- [ ] Implement semantic retrieval
- [ ] Generate source-grounded answers
- [ ] Create AI evaluation datasets

## Milestone 6 — Production Readiness

**Status:** Not Started

### Tasks
- [ ] Configure structured logging
- [ ] Implement application and AI observability
- [ ] Replace document-status polling with server-pushed updates using SSE or WebSockets
- [ ] Define and implement retention cleanup for abandoned database records and S3 objects
- [ ] Migrate private objects, IAM permissions, and configuration from the document-specific development bucket to a shared `finhand-dev-uploads` bucket
- [ ] Replace user-ID-based S3 object key prefixes with opaque random storage namespaces and migrate existing objects
- [ ] Blur document previews by default and let users temporarily reveal or reapply the blur
- [ ] Review and polish UI styles, interaction details, and visual consistency across the application
- [ ] Configure CI/CD
- [ ] Run security and performance checks
- [ ] Deploy the application
