# FinHand Environments and AWS Production Architecture

## Scope

FinHand V1 uses three execution contexts:

| Context | Lifetime | Purpose |
| --- | --- | --- |
| Local development | Developer-controlled | Build and inspect features using local Node.js and Docker services. |
| Automated test | Ephemeral | Run deterministic unit, component, and PostgreSQL integration tests in CI. |
| Production | Long-lived | Host the personal project on one cost-conscious AWS server. |

A hosted staging environment is intentionally deferred for V1. Automated
integration tests must never connect to production. Production releases must
therefore use manual approval, verified database migrations, rollback controls,
backups, and non-destructive post-deployment smoke checks.

The production topology intentionally favors predictable cost and learning over
high availability. It is appropriate for a personal project with very low
traffic, but it is not the target architecture for a business-critical service.

## AWS Account and Region

- Use the `finhand-prod` AWS account selected for production workloads.
- Use `us-east-1` for the initial production region, matching the existing
  development storage configuration.
- Do not share production database credentials, buckets, OpenAI credentials,
  OAuth clients, or application secrets with local development or CI.
- Manage human access with IAM Identity Center and temporary credentials. Do not
  use the AWS account root user for routine administration.

Whether the production account remains standalone or becomes a member of the
personal AWS Organization is an account-governance decision. It does not change
the application topology described here.

## Resource Naming and Tags

Production resources use the prefix `finhand-prod`. Globally unique resources
append the AWS account ID or another opaque suffix where necessary.

Examples:

```text
finhand-prod-host
finhand-prod-data
finhand-prod-uploads-<account-id>
finhand-prod-backups-<account-id>
finhand-prod-web-ecr
finhand-prod-api-ecr
finhand-prod-instance-role
```

Every supported resource must include these tags:

| Tag | Value |
| --- | --- |
| `Application` | `finhand` |
| `Environment` | `production` |
| `ManagedBy` | `aws-cdk` |
| `DataClassification` | `financial-private` when the resource stores user data |

## Infrastructure as Code

Production AWS resources will be described with AWS CDK using TypeScript.
Manual console changes are permitted only for initial account bootstrap or an
emergency, and any lasting change must be reflected back into CDK.

The infrastructure package should define:

1. the VPC, public subnet, security group, and Elastic IP;
2. one EC2 host and its encrypted EBS volumes;
3. the EC2 instance profile and deployment role;
4. the private S3 uploads and database-backup buckets;
5. ECR repositories;
6. Parameter Store and Secrets Manager values;
7. logging, alarms, backups, and budgets;
8. optional DNS resources after a permanent domain is selected.

The Docker Compose file, Caddy configuration, backup scripts, and deployment
scripts are application infrastructure and must also be version-controlled.

Creating the CDK package and provisioning resources belong to later deployment
tasks. This document defines their required outcome.

## Production Topology

```text
Internet
   |
Free shared subdomain or future permanent domain
   |
Elastic IP: ports 80 and 443 only
   |
Caddy: HTTPS termination and reverse proxy
   |-- web requests --> Next.js container
   `-- API requests --> Fastify API container

Docker Compose on one EC2 instance
   |-- Caddy
   |-- Next.js web
   |-- Fastify API
   |-- asynchronous worker
   `-- PostgreSQL with persistent EBS-backed storage
             |
             +--> private S3 uploads bucket
             `--> OpenAI API

Container logs --> CloudWatch Logs with finite retention
Images         --> Amazon ECR
Secrets        --> Parameter Store and Secrets Manager
Administration --> AWS Systems Manager Session Manager
```

CloudFront is optional. Its generated HTTPS hostname may be introduced later
when CDN caching, edge controls, or a stable AWS-owned public hostname provides
enough value to justify the extra configuration. It is not required for the
initial single-server deployment.

### Proxy trust and request origins

Only Caddy publishes production ports. The API container remains private and
trusts exactly one forwarding hop, configured with
`API_TRUST_PROXY_HOPS=1`. This lets Fastify derive the original client address
from Caddy's forwarding headers without trusting an arbitrary header supplied
directly by a client. If another public proxy or load balancer is introduced,
review the complete path before changing this value.

Local development uses zero trusted hops for direct browser-to-API requests.
The version-controlled ngrok flow has two local forwarding hops—the ngrok agent
and the FinHand development proxy—so the API must be restarted with
`API_TRUST_PROXY_HOPS=2` while testing through that tunnel. Proxy trust affects
client-IP attribution and future IP rate limits; OAuth and CORS still depend on
the matching `BETTER_AUTH_URL`, `WEB_URL`, and `NEXT_PUBLIC_API_URL` values.

Browser access uses exact-origin credentialed CORS. In addition, a
cookie-bearing `POST`, `PUT`, `PATCH`, or `DELETE` request to a normal
application route must carry the configured web origin. Better Auth retains its
own trusted-origin validation, and the mobile capture upload remains
capture-token authenticated rather than session-cookie authenticated.

| Endpoint group | Authentication and origin policy |
| --- | --- |
| `/health` | Public read-only health check; no origin requirement |
| `/api/auth/*` | Better Auth and Google OAuth with Better Auth trusted origins |
| `/api/document-capture-session/*` | Short-lived capture bearer token and exact browser CORS |
| `/api/events` | Authenticated read-only SSE with exact browser CORS |
| Other authenticated reads | Session authentication and exact browser CORS |
| Other state-changing routes | Session authentication, exact browser CORS, and exact origin validation when a cookie is present |

### Realtime upload status

The Transactions page opens one authenticated Server-Sent Events connection to
`GET /api/events`. This connection carries only small change notifications for
the current user; it does not carry document contents, extracted financial
values, or authoritative transaction data.

The asynchronous document and audio workers publish a PostgreSQL `NOTIFY` only
after the corresponding database change commits. Each API process keeps one
dedicated `LISTEN` connection, validates every notification, and forwards it
only to the in-memory SSE subscribers belonging to that upload owner. The API
removes the internal user ID before writing the browser event.

An SSE event is only an invalidation signal. After receiving one, the browser
reads the normal authenticated review and capture-session endpoints again. The
same reads run when the stream opens or reconnects, so a notification missed
during a temporary disconnection cannot leave the interface permanently stale.
The API sends a heartbeat every 25 seconds and rotates each connection after 15
minutes; the browser's native `EventSource` reconnect behavior then opens a new
stream. Caddy streams the `text/event-stream` response through the existing
same-origin `/api/*` reverse proxy.

This design consumes one long-lived HTTP connection for each open Transactions
page and one PostgreSQL listener connection per API process, not one database
connection per user. If the API is replicated later, every replica must retain
its own PostgreSQL listener so its local browser subscribers receive the same
notifications.

## EC2 Host

Start with one ARM-based `t4g.small` instance:

- 2 vCPUs;
- 2 GiB memory;
- Amazon Linux 2023;
- a 16 GiB encrypted gp3 root volume for the operating system, Docker images,
  and host logs;
- a separate 20 GiB encrypted gp3 volume retained for PostgreSQL data;
- one stable Elastic IP;
- IMDSv2 required;
- an instance-metadata response hop limit that permits the API and worker
  containers to retrieve temporary instance-role credentials;
- detailed monitoring disabled initially unless an operational need justifies
  its additional cost;
- no direct SSH access from the internet;
- administration through Systems Manager Session Manager.

Build Linux ARM64 container images in CI and pull them on the host. Do not build
Next.js or application images on the production server. The official Node.js,
PostgreSQL, and supporting images selected by the project must support ARM64.

The 2 GiB instance is an initial cost-conscious size, not a promise that every
workload will fit indefinitely. Configure container memory limits, Docker log
rotation, and a small encrypted swap file for brief memory spikes. Monitor
memory before moving to a larger instance; swap must not be treated as normal
application memory.

### Controlled host AMI refresh

The production host AMI is selected through the standard `String` parameter
`/finhand/production/infrastructure/host-ami-id`. CDK pins an explicit version
of this parameter in `packages/infra/lib/production-ami.ts`; it must never
follow AWS's `ami-amazon-linux-latest` parameter directly. Consequently,
publishing a new parameter version does not change the host until the pinned
version is deliberately updated and deployed.

Seed version 1 with the AMI already used by the production host:

```bash
aws ssm put-parameter \
  --profile finhand-prod-admin \
  --region us-east-1 \
  --name /finhand/production/infrastructure/host-ami-id \
  --description "Approved Amazon Linux 2023 ARM64 AMI for FinHand production" \
  --type String \
  --value ami-00b0d691a87846f99
```

Refreshing the host operating system is an intentional maintenance operation:

1. Read AWS's current Amazon Linux 2023 ARM64 recommendation from
   `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64`.
2. Verify that the candidate is owned by Amazon, is available in `us-east-1`,
   uses the `arm64` architecture, and is compatible with the bootstrap and
   production containers.
3. Create a new version of the FinHand parameter with `put-parameter
   --overwrite`; do not alter the pinned CDK version yet.
4. Take and verify a current database backup, then increment
   `PRODUCTION_HOST_AMI_PARAMETER_VERSION` to the new Parameter Store version.
5. Run the infrastructure tests and `cdk diff`. An AMI change replaces the EC2
   host, so perform the deployment in an announced maintenance window and
   confirm that the retained database volume and Elastic IP reattach correctly.
6. Re-run the host bootstrap, application deployment, health checks, OAuth,
   upload, worker, metrics, and alarm verification before closing the change.

Do not delete this parameter or publish enough revisions for a version still
referenced by a deployed stack to age out of Parameter Store history. Rollback
means restoring the previously pinned version and redeploying; the retained
PostgreSQL volume remains the authoritative database storage.

### Host bootstrap

Prepare the existing host with a version-controlled Systems Manager command
document and State Manager association. Do not depend on EC2 user data for this
step: user data is not reapplied reliably to an already-running instance when
the bootstrap definition changes.

The bootstrap must be safe to run repeatedly and must:

- install and enable the Amazon Linux 2023 Docker package;
- install and configure the CloudWatch Agent to publish one-minute memory and
  filesystem metrics;
- install a pinned ARM64 Docker Compose CLI plugin only after verifying its
  SHA-256 checksum;
- configure bounded local Docker logs without discarding unrelated daemon
  settings;
- locate the retained database disk by EBS volume ID rather than assuming that
  the CloudFormation `/dev/sdf` name is preserved by the Nitro NVMe device
  mapping;
- create an ext4 filesystem only when the database disk contains no filesystem
  or other recognized signature;
- refuse to replace an unknown or unsupported existing filesystem;
- mount the database disk by UUID at `/srv/finhand/postgres` and persist that
  mount in `/etc/fstab`;
- create root-owned deployment directories under `/opt/finhand`, with runtime
  configuration inaccessible to ordinary users;
- create a 1 GiB swap file on the encrypted root disk with mode `0600` and low
  swappiness for brief memory spikes;
- install a persistent systemd timer that reports the aggregate health of the
  five long-running production containers once per minute.

CloudFormation waits for the association to report success. The association is
also marked non-compliant when a later application of the desired host state
fails. This bootstrap prepares the operating system only; it does not start
PostgreSQL, Caddy, or any FinHand application container.

## Networking and TLS

- Place the EC2 host in a public subnet with an internet gateway. Do not create
  an Application Load Balancer or NAT Gateway for V1.
- Associate one Elastic IP so DNS and OAuth configuration do not change after
  instance replacement or restart.
- Allow inbound TCP 80 and 443 from the internet.
- Do not expose the Next.js, Fastify, worker, or PostgreSQL container ports on
  the public host interface.
- Do not expose TCP 22. Use Systems Manager Session Manager for administration.
- Restrict outbound traffic where practical, while retaining the HTTPS access
  required for Google OAuth, OpenAI, AWS APIs, image pulls, and system updates.
- Use Caddy as the only public reverse proxy and TLS endpoint.
- Use an initial free shared subdomain with automated Let's Encrypt HTTPS, or a
  permanent custom domain when one is purchased.

The application may initially use separate web and API hostnames, or route API
requests under one hostname. The selected URLs must be stable before the
production Google OAuth client and frontend build are finalized.

## Docker Compose Services

Use one production Compose project containing:

| Service | Image or role | Public inbound traffic |
| --- | --- | --- |
| `proxy` | Caddy | Ports 80 and 443 |
| `web` | Immutable web image from ECR | Only from `proxy` on the Compose network |
| `api` | Immutable API image from ECR | Only from `proxy` on the Compose network |
| `worker` | API image with the worker command | None |
| `postgres` | Pinned PostgreSQL image | None |

Requirements:

- pin production images to immutable Git commit SHA tags;
- use restart policies and health checks;
- use separate internal networks where they materially reduce access;
- mount PostgreSQL data from the dedicated persistent EBS volume;
- never mount the Docker socket into application containers;
- never bake secrets into images or commit them in the Compose file;
- set CPU and memory limits so one process cannot trivially exhaust the host;
- configure bounded logging for every container. Production services use the
  non-blocking CloudWatch logging driver, while the Docker daemon retains a
  rotated local default for administrative or one-off containers that do not
  override it.

The API and worker share an image but run different commands. They are isolated
processes, but not separate failure domains because they share one host.

Build that shared API/worker image from the repository root using
`apps/api/Dockerfile`. The image uses a digest-pinned Node.js 22 slim base,
compiles TypeScript in a separate build stage, contains only the API workspace's
production dependency tree, and runs as the non-root `node` user. CI must build
it for `linux/arm64`; Compose starts `dist/server.js` for the API and overrides
the command with `dist/worker.js` for the worker.

Build the web image from `apps/web/Dockerfile`. Its separate build stage receives
the same-origin web URL through `NEXT_PUBLIC_API_URL` and produces Next.js
standalone output. The final ARM64 image contains the traced server runtime and
static assets, runs as the non-root `node` user, and does not contain source
files or development dependencies.

The version-controlled production runtime configuration lives under
`deploy/production`. `compose.yaml` connects the five services without
publishing application or database ports. On the web hostname, `Caddyfile`
routes `/api/*` to the private API service and all other paths to the private
web service. The separate API hostname remains available for operational use,
but browser traffic uses the web origin so authentication cookies are
first-party. Start Compose with an
explicit protected deployment environment file:

```bash
docker compose \
  --env-file /opt/finhand/config/deployment.env \
  --file /opt/finhand/current/compose.yaml \
  up --detach
```

`deploy/production/environment.example` documents only public deployment
settings. The referenced API, worker, and PostgreSQL environment files are
created on the host with mode `0600`; they are never committed or copied into
container images. The API and worker image values must use the same immutable
Git commit SHA tag that passed CI.

The application runtime renderer and CloudFormation stack use the following
exact Parameter Store contract under `/finhand/production`. Standard `String`
and `SecureString` parameters avoid a recurring Secrets Manager or
customer-managed KMS-key charge for this V1 environment.

| Relative parameter name | Type | Consumer or purpose |
| --- | --- | --- |
| `deployment/web-image` | `String` | Immutable web ECR image tagged with the full Git SHA |
| `deployment/api-image` | `String` | Immutable API/worker ECR image tagged with the same full Git SHA |
| `deployment/web-domain` | `String` | Lowercase public web hostname, without a scheme |
| `deployment/api-domain` | `String` | Lowercase public API hostname, without a scheme |
| `deployment/acme-email` | `String` | Caddy certificate account contact |
| `database/user` | `String` | Restricted application database role |
| `database/password` | `SecureString` | 32-128 high-entropy URL-safe characters |
| `database/name` | `String` | Production database name |
| `application/log-level` | `String` | One supported application log level |
| `application/better-auth-secret` | `SecureString` | Independent value with at least 32 characters |
| `application/google-client-id` | `String` | Production Google OAuth client ID |
| `application/google-client-secret` | `SecureString` | Production Google OAuth client secret |
| `application/openai-api-key` | `SecureString` | Restricted production OpenAI project key |
| `application/openai-document-model` | `String` | Approved document and fallback audio extraction model |
| `monitoring/alert-email` | `String` | CloudFormation-resolved SNS alarm recipient; not written to application runtime files |

Create every parameter before invoking the renderer. Use standard-tier
parameters and the default `alias/aws/ssm` key for `SecureString` values; do
not pass plaintext secrets through CloudFormation parameters or command-line
arguments. The deployment operator can run the renderer without supplying any
secret values to the command itself:

```bash
aws ssm send-command \
  --profile <production-administrator-profile> \
  --region us-east-1 \
  --document-name finhand-prod-render-runtime-config \
  --targets Key=InstanceIds,Values=<production-instance-id>
```

The command fails before replacing existing files if any required parameter is
missing, has the wrong `String`/`SecureString` type, or violates its validation
rule. Its output contains parameter names and validation errors only, never
parameter values.

The EC2 role can decrypt and read only this parameter path. The renderer uses
the stack region and uploads bucket directly, derives the HTTPS web and API
origins from the validated domains, and installs `deployment.env`, `api.env`,
`worker.env`, `migration.env`, and `postgres.env` only after validating the
complete parameter set. The migration file contains only the internal database
URL. The renderer does not print parameter values, place them in command
arguments, or give the API or migration container the OpenAI key.

## PostgreSQL

Run PostgreSQL as a private Docker Compose service backed by an encrypted gp3
EBS data volume. Only the API, worker, and one-off migration container may
connect to it over the internal Compose network.

Requirements:

- pin a supported PostgreSQL major version;
- use a strong independent production password;
- use a named database and restricted application role rather than the default
  PostgreSQL superuser for normal application queries;
- cap API and worker connection pools for the 2 GiB host;
- add container and disk-health checks;
- keep PostgreSQL data outside the container writable layer;
- support the schema and the `pgvector` extension planned for the post-V1 RAG
  backlog, without enabling that backlog feature now.

This design does not provide RDS point-in-time recovery or Multi-AZ failover.
The entire application and database are unavailable when the host is stopped or
fails. That limitation is accepted for V1 because FinHand is a personal project.

## Database Backups and Restore

Backups are mandatory because the database shares the application host.

- Run an authenticated `pg_dump` on a schedule and upload the compressed dump
  to a private, encrypted S3 backup prefix.
- Do not reuse a live database file copy as the logical backup.
- Keep backup objects inaccessible to browser-facing presigned URL flows.
- Retain deployment backups for 30 days and noncurrent object versions for 7
  days; revisit the window when real recovery requirements justify it.
- Create encrypted EBS snapshots as a secondary server-volume recovery layer.
- Alert when the most recent logical backup is missing or too old.
- Test restoring a dump into an isolated temporary PostgreSQL container before
  the first release and periodically afterward.

An untested backup does not satisfy the production-readiness requirement.

## Private Upload Storage

Use one production S3 bucket named similarly to:

```text
finhand-prod-uploads-<account-id>
```

Requirements:

- S3 Block Public Access enabled at the account and bucket levels;
- server-side encryption enabled;
- bucket policy denies non-TLS requests;
- object access granted only through the scoped EC2 instance role;
- CORS omitted unless a future direct-browser upload flow requires it;
- no development or test objects;
- opaque `documents/<random-storage-id>` and `audio/<random-storage-id>` keys
  for new objects, without user IDs or upload-row IDs;
- no migration of disposable pre-V1 user-prefixed objects; development cuts
  over to a correctly named shared uploads bucket, while production keeps its
  existing shared uploads bucket;
- retention and deletion rules added only after the retention task defines
  their safe behavior.

The application must not receive `AWS_ACCESS_KEY_ID` or
`AWS_SECRET_ACCESS_KEY`. The AWS SDK will use temporary credentials from the
EC2 instance profile.

## Secrets and Configuration

Store ordinary non-sensitive configuration in version-controlled deployment
configuration or Systems Manager Parameter Store. Store sensitive values as
SecureString parameters or Secrets Manager secrets when rotation or secret
lifecycle features justify the additional charge.

At deployment or boot, a root-owned script retrieves the approved values using
the EC2 instance role and writes separate service-specific runtime environment
files with mode `0600`. Each container receives only the values it consumes. The
script must not print values, pass them through command arguments visible to
other users, or persist them in Docker images, Git, CI logs, or shell history.

### Shared conventions

- Use `NODE_ENV=production` in every deployed application service.
- Introduce `APP_ENV=production` when application-level environment selection
  is needed; do not use `NODE_ENV=staging` or another non-standard value.
- Rotate a secret by updating its managed value and redeploying the affected
  containers.
- Keep local, CI, and production values separate.

### Configuration matrix

| Variable | Consumers | Source | Sensitive | Production value or rule |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | API, worker, web | Compose environment | No | `production` |
| `API_HOST` | API | Compose environment | No | `0.0.0.0` inside the container |
| `API_PORT` | API | Compose environment | No | Internal container port |
| `API_TRUST_PROXY_HOPS` | API | Compose environment | No | `1`; only Caddy can reach the private API container |
| `LOG_LEVEL` | API, worker | Parameter Store or Compose | No | Start with `info` |
| `DATABASE_URL` | API, worker, migration | SecureString | Yes | Internal Compose hostname and restricted database role |
| `BETTER_AUTH_SECRET` | API | SecureString | Yes | Independent production secret, at least 32 characters |
| `BETTER_AUTH_URL` | API | Parameter Store or Compose | No | Final public web origin; Caddy routes `/api/*` to the API |
| `GOOGLE_CLIENT_ID` | API | Parameter Store | No | Production Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | API | SecureString | Yes | Production Google OAuth secret |
| `WEB_URL` | API | Parameter Store or Compose | No | Final public web origin |
| `NEXT_PUBLIC_API_URL` | Web image build | CI build configuration | Public | Final public web origin for same-origin API requests |
| `AWS_REGION` | API, worker, backup job | Compose environment | No | `us-east-1` |
| `S3_UPLOAD_BUCKET` | API, worker | Parameter Store or Compose | No | Production uploads bucket name |
| `OPENAI_API_KEY` | Worker | SecureString | Yes | Restricted production OpenAI project key |
| `OPENAI_DOCUMENT_MODEL` | Worker | Parameter Store or Compose | No | Approved extraction model |
| `OPENAI_AUDIO_TRANSCRIPTION_MODEL` | Worker | Parameter Store or Compose | No | Approved transcription model |
| `OPENAI_AUDIO_EXTRACTION_MODEL` | Worker | Parameter Store or Compose | No | Approved extraction model or omitted for fallback |
| Processing interval and lease variables | Worker | Parameter Store or Compose | No | Preserve verified defaults initially |

Local-only variables such as `POSTGRES_PORT`, `POSTGRES_TEST_PORT`,
`TEST_DATABASE_URL`, and `NGROK_URL` must not be present in production.

## Google OAuth

Create a production-only Google OAuth client. Do not reuse the local or ngrok
client credentials.

The final configuration uses the web origin for browser API and OAuth traffic:

```text
Authorized JavaScript origin: <production web origin>
Authorized redirect URI:      <production web origin>/api/auth/callback/google
```

The separate API hostname may remain available for health checks and direct
operational access, but it must not initiate the browser OAuth flow. Free
shared-domain providers such as DuckDNS are public suffixes, so sibling
hostnames cannot safely share authentication cookies.

The chosen free or permanent hostname must use HTTPS and remain stable. Changing
it later requires updating Google OAuth, Better Auth, cookies, deployment
parameters, and the frontend public API URL.

## OpenAI

Create a production-specific OpenAI project and API key.

Requirements:

- expose the key only to the worker container;
- configure an explicit monthly OpenAI usage budget and alerts;
- monitor production separately from local development;
- never write request or response contents to ordinary application logs;
- treat model changes as deployment configuration changes.

Because every container shares a host administrator, host compromise can expose
all runtime secrets. Container-level secret isolation reduces accidental access
but is not a security boundary equivalent to separate hosts or ECS task roles.

## IAM Boundaries

### EC2 instance role

Attach one narrowly scoped instance profile to the EC2 host. It is the union of
permissions required by the services on that host:

- pull images from only the FinHand ECR repositories;
- read only the approved Parameter Store and Secrets Manager paths;
- write application logs and backup-health metrics to the intended CloudWatch
  resources;
- use Systems Manager as a managed instance;
- upload database backups to only the approved backup prefix;
- perform the required upload-object operations only in the production uploads
  bucket.

The upload permissions initially include:

```text
s3:PutObject
s3:GetObject
s3:DeleteObject
s3:AbortMultipartUpload
s3:ListMultipartUploadParts
```

Do not grant bucket administration, wildcard access to unrelated buckets, IAM
administration, or infrastructure deployment permissions.

Running all containers on one host means they ultimately share the instance
role security boundary. This is a documented cost-driven tradeoff. A future
multi-service deployment should restore separate API and worker roles.

### GitHub Actions deployment role

GitHub Actions should assume a production deployment role through GitHub OIDC;
do not store permanent AWS access keys or SSH private keys in GitHub secrets.
Scope the role to:

- publish images to the two FinHand ECR repositories;
- invoke only the approved Systems Manager deployment document or command on
  the tagged FinHand host;
- read deployment status;
- update only deployment-related parameters when explicitly required.

The deployment role must not receive database credentials, application secrets,
or broad EC2 and IAM administration permissions.

## Release Safety Without Staging

Every production release must follow this sequence:

1. Pass unit, component, PostgreSQL integration, lint, type-check, build, and
   migration-drift checks in CI.
2. Build Linux ARM64 web and API images tagged with the Git commit SHA.
3. Push immutable images to ECR.
4. Require explicit manual approval for production deployment.
5. Invoke a version-controlled deployment script through Systems Manager.
6. Refresh the protected runtime environment file and pull the approved images.
7. Create and verify a pre-migration logical database backup.
8. Run backward-compatible migrations in a one-off Compose container.
9. Update the web, API, and worker containers with `docker compose up -d`.
10. Run non-destructive production smoke checks with a controlled test user.
11. Monitor application health, worker progress, database health, disk space,
    memory, backup freshness, and AI failures.
12. Roll back to the previous image SHA when release health fails. Database
    migrations require the separate forward-compatible migration and recovery
    procedure.

The `finhand-prod-deploy-application` Systems Manager document performs steps
5-9 on the EC2 host. It prevents concurrent deployments, embeds the reviewed
Compose and Caddy configuration, pulls only the image URIs already validated by
the runtime renderer, starts PostgreSQL, creates and validates a custom-format
`pg_dump`, uploads it under `database/` in the private retained backup bucket,
runs the one-off migration container, and waits for every long-running service
to become healthy. If container health checks fail, it restores the previous
release symlink and attempts to restart the previous containers; applied
database migrations are not automatically reversed.

After updating image parameters and successfully running
`finhand-prod-render-runtime-config`, invoke the deployment without supplying
credentials or secrets as command arguments:

```bash
aws ssm send-command \
  --profile <production-administrator-profile> \
  --region us-east-1 \
  --document-name finhand-prod-deploy-application \
  --targets Key=InstanceIds,Values=<production-instance-id>
```

The single host does not provide a rolling multi-instance deployment. Brief
application interruptions during deployment are acceptable for V1 and must be
reported clearly if they become user-visible.

Destructive integration tests run only against the ephemeral `finhand_test`
database. They must never run against production PostgreSQL.

Skipping staging increases release risk. A staging environment should be added
when release frequency, team size, data-migration complexity, or operational
risk makes production-only validation insufficient.

## Observability and Host Safety

- API and worker processes write newline-delimited JSON logs to standard output.
  Application records identify their service, environment, severity, event,
  and time.
- API completion and failure records share a server-generated request ID, which
  is also returned in the `x-request-id` response header. Raw URLs, queries,
  headers, and request bodies are not included in request logs.
- Worker records use the upload ID as the job correlation ID. Successful and
  failed processing, lease recovery, cleanup, startup, and shutdown use stable
  event names; idle polling is emitted only at `debug` level.
- Two deliberately narrow CloudWatch metric filters convert only unexpected
  application failures into custom metrics. `ApiUnhandledErrorCount` matches
  unhandled API errors, while `WorkerUnexpectedErrorCount` matches worker-loop,
  recovery, and capture-cleanup exceptions. Expected user-document rejection,
  normal processing outcomes, latency, and success volume remain logs rather
  than V1 custom metrics.
- `AiProviderFailureCount` is the only V1 AI-specific custom metric. It matches
  safe worker `event`, `status`, and `failureCode` fields for OpenAI
  authentication, network, rate-limit, service-availability, and timeout
  failures. User-document validation outcomes do not increment it. Prompts,
  documents, transcripts, extracted values, upload identifiers, and token data
  are not part of the filter or metric.
- Review token usage and cost in the restricted production OpenAI project
  dashboard instead of duplicating detailed usage in CloudWatch. Whole-job
  duration and outcomes remain available in redacted structured worker logs.
- Error serialization retains the error type, safe code, and stack frames while
  omitting the error message. Logger redaction provides a second boundary for
  credentials, OAuth data, cookies, request bodies, file names, financial
  values, document content, prompts, and transcripts.
- CDK provisions a retained CloudWatch log group for each production Compose
  service with a 30-day event-retention period. Docker sends output directly to
  those groups in non-blocking mode, and the EC2 role can create streams and
  publish events only inside the pre-created FinHand groups.
- The host publishes custom metrics only to the `FinHand/Production` namespace.
  The CloudWatch Agent reports `mem_used_percent` plus `disk_used_percent` for
  `/` and `/srv/finhand/postgres` every 60 seconds, while standard EC2 metrics
  continue to provide CPU, network, and instance-status data without enabling
  paid detailed monitoring.
- A host-level systemd timer evaluates the Compose health checks for Caddy,
  Next.js, Fastify, the asynchronous worker, and PostgreSQL. It publishes
  `HealthyContainerCount` and `UnhealthyOrMissingContainerCount` every minute;
  the one-off migration container is deliberately excluded.
- The instance role may call `cloudwatch:PutMetricData` only when the target
  namespace is `FinHand/Production`. Metric collection never reads application
  environment files or includes credentials, document contents, or financial
  values.
- One `finhand-production-alerts` SNS topic sends alarm-state notifications to
  the email resolved from `/finhand/production/monitoring/alert-email`. The
  recipient must confirm the AWS subscription email before notifications are
  delivered; the address is not committed to the repository.
- V1 alarms cover EC2 status, missing or sustained high memory/disk metrics,
  missing or unhealthy containers, unexpected API/worker failures, and three
  technical AI provider failures within 15 minutes. Resource and container
  alarms require consecutive bad datapoints to avoid transient notifications;
  log-derived metrics treat missing data as non-breaching.
- The `finhand-production` CloudWatch dashboard shows alarm state, CPU, memory,
  root and PostgreSQL disk usage, container health, and critical application
  failure counts. Alarm messages and dashboard metrics contain no document,
  transcript, credential, or financial content.
- Keep sensitive financial data, document contents, transcripts, OAuth tokens,
  API keys, and database credentials out of logs.
- Monitor instance status, CPU, memory, disk space, container health, unexpected
  application failures, and repeated technical AI provider failures. Queue-age
  and backup-freshness signals are deferred until usage and backup automation
  justify their V1 operational cost.
- Alert before disk exhaustion and before the host remains unhealthy long enough
  to interrupt worker leases.
- Enable automatic operating-system security updates where safe and define a
  regular reboot/update procedure.
- Restrict Session Manager access to explicitly authorized administrators and
  retain an audit trail of administrative sessions.

## Availability and Scaling Limitations

The V1 deployment deliberately has these limitations:

- one host is a single point of failure;
- PostgreSQL has no synchronous standby or automatic failover;
- web, API, worker, and database compete for the same CPU, memory, and disk;
- deployments may briefly interrupt requests;
- vertical instance replacement is the first scaling option;
- the EC2 instance role cannot provide per-container IAM isolation.

If usage or reliability requirements grow, separate the database first, then
separate the public application and worker workloads. Reconsider RDS, ECS,
multiple availability zones, and service-specific IAM roles only when those
benefits justify their recurring cost.

## Cost Controls

The initial monthly AWS estimate before promotional credits and OpenAI usage is:

| Resource | Expected monthly cost |
| --- | ---: |
| `t4g.small` EC2 compute | Approximately $12 |
| 36 GiB total gp3 EBS storage | Approximately $2.88 |
| One public IPv4 address | Approximately $3.65 |
| Snapshots, S3, ECR, parameters, and low-volume logs | Approximately $2-$6 |
| **Expected AWS total** | **Approximately $21-$26** |

Actual pricing and taxes must be checked before provisioning. OpenAI is billed
separately. A free shared subdomain and Let's Encrypt certificate add no domain
registration cost.

Before provisioning application resources:

- enable AWS Budgets with email alerts;
- use a monthly production budget around $30, with earlier alerts near $15,
  $24, and $30;
- enable cost-allocation tags;
- configure log and snapshot retention;
- avoid idle duplicate instances and unattached EBS volumes or Elastic IPs;
- review Cost Explorer after the first complete billing week.

## Pending Decisions Before Provisioning

- final production account and AWS Organizations membership;
- initial free shared subdomain or permanent domain;
- one public hostname with path routing or separate web and API hostnames;
- PostgreSQL major version;
- logical backup and snapshot retention;
- CloudWatch alarm recipients;
- exact SecureString versus Secrets Manager placement;
- exact instance-role and GitHub OIDC deployment-role policies;
- whether CloudFront provides enough benefit to add after the initial release.

## References

- [Amazon EC2 instance profiles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html)
- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [AWS Systems Manager State Manager associations](https://docs.aws.amazon.com/systems-manager/latest/userguide/state-manager-associations-creating.html)
- [Amazon EBS encryption](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html)
- [Amazon S3 security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [Install the Docker Compose plugin](https://docs.docker.com/compose/install/linux/)
- [GitHub Actions OIDC in AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
