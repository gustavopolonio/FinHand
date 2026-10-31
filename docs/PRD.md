# FinHand - Financial Planner with AI


## Functional Requirements

- **Document Processing:** Allow users to upload invoice screenshots and PDF files, automatically extract relevant financial data, and register transactions in the application.
- **Voice Input:** Allow users to record or upload audio describing financial transactions, automatically extract the relevant information, and register transactions in the application.
- **AI Document Assistant (RAG):** Allow users to ask natural language questions about uploaded financial documents and receive answers grounded in their content.


## Non-Functional Requirements

- Ensure secure storage and access to users' financial data.
- Require user confirmation before registering AI-extracted transactions.
- Monitor application errors and AI usage.


## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- Fastify
- TypeScript
- Drizzle ORM

### Database & Storage
- PostgreSQL
- pgvector
- Amazon S3

### AI Engineering
- OpenAI API
- RAG
- Tool Calling
- Structured Outputs

### Observability
- Pino — Structured Logging
- Sentry — Error Monitoring
- Langfuse — LLM Tracing & Evaluation

### Infrastructure & DevOps
- Docker
- GitHub Actions

### Testing
- Vitest
- AI Evaluation Datasets