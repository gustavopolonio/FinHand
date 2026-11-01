# FinHand — Development Roadmap

## Milestone 1 — Project Foundation

**Status:** In Progress

### Tasks
- [x] Define the initial database schema
- [x] Set up the monorepo structure
- [x] Configure PostgreSQL using Docker Compose
- [x] Configure Drizzle ORM
- [ ] Create and run the first database migration
- [ ] Set up the Fastify backend
- [ ] Set up the Next.js frontend

### Acceptance Criteria
- PostgreSQL runs locally.
- Database migrations execute successfully.
- Backend health-check endpoint responds.
- Frontend starts successfully.
- Type checking passes.

## Milestone 2 — Financial Core

**Status:** Not Started

### Tasks
- [ ] Implement user authentication
- [ ] Implement accounts and categories
- [ ] Implement transaction CRUD
- [ ] Implement financial summary calculations
- [ ] Build the financial dashboard
- [ ] Add automated tests

## Milestone 3 — AI Document Processing

**Status:** Not Started

### Tasks
- [ ] Implement file uploads using Amazon S3
- [ ] Extract structured financial data from documents
- [ ] Implement transaction confirmation workflow
- [ ] Store confirmed transactions

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
