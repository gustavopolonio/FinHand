# FinHand - Financial Planner with AI


## Functional Requirements

- **Document Processing:** Allow users to upload receipt or invoice images and PDF files from their current device, automatically extract structured financial data, review the proposed transaction, and explicitly confirm it before registration.
- **Mobile Receipt Capture:** Allow users on a mobile browser to open the device camera, photograph a receipt, and submit it for document processing.
- **Desktop-to-Mobile Capture:** Allow an authenticated desktop user to create a short-lived QR capture session. Scanning the QR code opens an upload-only mobile page where the user can photograph or select a receipt. The submitted document returns to the initiating desktop session for processing and confirmation.
- **Voice Input:** Allow users to record or upload audio describing financial transactions, automatically extract the relevant information, and register transactions in the application.
- **AI Document Assistant (RAG):** Allow users to ask natural language questions about uploaded financial documents and receive answers grounded in their content.


## Non-Functional Requirements

- Ensure secure storage and access to users' financial data.
- Require user confirmation before registering AI-extracted transactions.
- Store uploaded financial documents privately and validate their file type and size before processing.
- Make QR capture sessions short-lived, single-use, unguessable, and limited to uploading into the initiating user's session. QR tokens must not grant access to financial data or appear in application logs.
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
