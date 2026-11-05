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

**Status:** In Progress

### Tasks
- [ ] Design and migrate the data model for uploads, document capture sessions, and transaction candidates
- [ ] Implement secure private image and PDF uploads using Amazon S3
- [ ] Validate supported file types, file sizes, checksums, ownership, and processing state transitions
- [ ] Build the direct document upload flow for desktop and mobile browsers
- [ ] Build the mobile receipt camera capture flow
- [ ] Implement short-lived, single-use QR capture sessions for desktop-to-mobile handoff
- [ ] Synchronize capture and processing status between the mobile capture page and initiating desktop session
- [ ] Extract structured transaction candidates from receipt images and PDF files
- [ ] Validate and normalize extracted amounts, currency, dates, descriptions, and counterparties
- [ ] Build the transaction candidate review and editing interface
- [ ] Require explicit user confirmation before creating an authoritative transaction
- [ ] Store confirmed transactions with `document` origin and preserve their source-candidate relationship
- [ ] Implement retry, rejection, expiration, and abandoned-upload cleanup flows
- [ ] Add automated tests for uploads, ownership, QR expiration and replay prevention, extraction, and confirmation

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

**Status:** Not Started

### Tasks
- [ ] Implement audio upload or recording
- [ ] Transcribe audio using OpenAI API
- [ ] Extract structured transaction data
- [ ] Implement transaction confirmation workflow

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
- [ ] Configure CI/CD
- [ ] Run security and performance checks
- [ ] Deploy the application
