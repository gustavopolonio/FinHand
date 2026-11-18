# FinHand - Financial Planner with AI


## Functional Requirements

- **Document Processing:** Allow users to upload receipt or invoice images and PDF files from their current device, automatically extract structured financial data, review the proposed transaction, and explicitly confirm it before registration.
- **Mobile Receipt Capture:** Allow users on a mobile browser to open the device camera, photograph a receipt, and submit it for document processing.
- **Desktop-to-Mobile Capture:** Allow an authenticated desktop user to create a short-lived QR capture session. Scanning the QR code opens an upload-only mobile page where the user can photograph or select a receipt. The submitted document returns to the initiating desktop session for processing and confirmation.
- **Voice Input:** Allow users on desktop and mobile browsers to record up to 30 seconds of microphone audio describing one or more financial transactions. Users can pause, resume, and see a live microphone input-level meter before reviewing the recording. FinHand does not provide an audio-file picker. It privately stores the recording, transcribes it, extracts one or more transaction candidates, and requires the user to review and explicitly confirm each candidate before registration.


## Non-Functional Requirements

- Ensure secure storage and access to users' financial data.
- Require user confirmation before registering AI-extracted transactions.
- Store financial documents and voice recordings privately in the shared Amazon S3 uploads bucket. Validate document type and size, and accept only WebM, MP4, or Ogg browser recordings up to 5 MB and 30 seconds before processing.
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
- pgvector — planned for the post-V1 RAG backlog
- Amazon S3

### AI Engineering
- OpenAI API
- RAG — post-V1 backlog
- Tool Calling
- Structured Outputs

### Observability
- Pino — Structured Logging
- Sentry — Error Monitoring
- Langfuse — LLM Tracing & Evaluation

### Infrastructure & DevOps
- Docker
- Docker Compose
- GitHub Actions
- AWS CDK with TypeScript
- Amazon EC2 with an IAM instance profile
- Amazon EBS
- Amazon ECR
- AWS Systems Manager Parameter Store and Secrets Manager
- Amazon CloudWatch
- Caddy with automated HTTPS
- Amazon CloudFront and Route 53 — optional when their capabilities are needed

### Testing
- Vitest
- AI evaluation datasets — post-V1 RAG backlog


## Post-V1 Backlog

- **AI Document Assistant (RAG):** Allow users to ask natural language questions about uploaded financial documents and receive answers grounded in their content. This capability is explicitly excluded from the V1 release scope.
