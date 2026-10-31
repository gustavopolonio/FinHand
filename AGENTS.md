# FinHand — Agent Instructions

## Project Overview

FinHand is an AI-powered personal financial planner built with TypeScript.

Read `docs/PRD.md` for product requirements and `docs/ROADMAP.md` for development milestones.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js, Fastify, TypeScript
- Database: PostgreSQL, Drizzle ORM, pgvector
- Storage: Amazon S3
- AI: OpenAI API, RAG, Tool Calling, Structured Outputs
- Testing: Vitest

## Development Guidelines

- Use TypeScript for all application code.
- Follow existing project conventions and architecture.
- Prefer simple, maintainable solutions over unnecessary abstractions.
- Do not introduce new frameworks or dependencies without justification.
- Keep business logic separate from HTTP route handlers.
- Validate external inputs before processing them.
- Never use floating-point arithmetic for financial calculations.
- Never expose credentials or sensitive financial data in logs.

## Development Workflow

1. Read the relevant requirements and roadmap milestone before implementation.
2. Explain the proposed approach before making significant architectural changes.
3. Implement one focused task at a time.
4. Add or update tests for business logic.
5. Run relevant tests, linting, and type checking.
6. Update roadmap progress only after verifying the implementation.
7. Do not start the next milestone automatically.
8. Do not create commits or deploy without explicit approval.
9. Use atomic commits.

## Documentation

- `docs/PRD.md` is the source of truth for product requirements.
- `docs/ROADMAP.md` tracks milestones and progress.
- `docs/DATA_MODEL.md` documents the database design.
- Keep documentation synchronized with approved implementation changes.