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
4. the private S3 uploads bucket;
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

### Host bootstrap

Prepare the existing host with a version-controlled Systems Manager command
document and State Manager association. Do not depend on EC2 user data for this
step: user data is not reapplied reliably to an already-running instance when
the bootstrap definition changes.

The bootstrap must be safe to run repeatedly and must:

- install and enable the Amazon Linux 2023 Docker package;
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
  swappiness for brief memory spikes.

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
- rotate local Docker logs even when logs are also forwarded to CloudWatch.

The API and worker share an image but run different commands. They are isolated
processes, but not separate failure domains because they share one host.

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
- Define a finite retention policy after the retention task establishes the
  required recovery window.
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
- opaque object keys after the storage-namespace migration task;
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
| `LOG_LEVEL` | API, worker | Parameter Store or Compose | No | Start with `info` |
| `DATABASE_URL` | API, worker, migration | SecureString | Yes | Internal Compose hostname and restricted database role |
| `BETTER_AUTH_SECRET` | API | SecureString | Yes | Independent production secret, at least 32 characters |
| `BETTER_AUTH_URL` | API | Parameter Store or Compose | No | Final public API origin |
| `GOOGLE_CLIENT_ID` | API | Parameter Store | No | Production Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | API | SecureString | Yes | Production Google OAuth secret |
| `WEB_URL` | API | Parameter Store or Compose | No | Final public web origin |
| `NEXT_PUBLIC_API_URL` | Web image build | CI build configuration | Public | Final public API origin |
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

The final configuration requires:

```text
Authorized JavaScript origin: <production web origin>
Authorized redirect URI:      <production API origin>/api/auth/callback/google
```

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

The single host does not provide a rolling multi-instance deployment. Brief
application interruptions during deployment are acceptable for V1 and must be
reported clearly if they become user-visible.

Destructive integration tests run only against the ephemeral `finhand_test`
database. They must never run against production PostgreSQL.

Skipping staging increases release risk. A staging environment should be added
when release frequency, team size, data-migration complexity, or operational
risk makes production-only validation insufficient.

## Observability and Host Safety

- Forward structured API and worker logs to CloudWatch Logs with finite
  retention.
- Keep sensitive financial data, document contents, transcripts, OAuth tokens,
  API keys, and database credentials out of logs.
- Monitor instance status, CPU, memory, disk space, container health, PostgreSQL
  health, worker queue age, failed processing, and backup freshness.
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
- CloudWatch log retention and alarm recipients;
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
