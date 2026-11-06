# Portfolio v3

A TypeScript monorepo for a portfolio frontend and API. The repository uses `urborepo` and `pnpm`, with a Next.js app in `apps/web`, a NestJS API in `apps/api`, and shared packages under `packages/`

## Architecture

- `web`: Next.js App router, deployed to Vercel.
- `api`: NestJS, containerized with Docker and deployed to Google Cloud Run.
- **API version**: `/api/v1`
- **Web-to-API authentication**: The Next.js server signs short-lived EdDSA service tokens. NestJS verifies them with the public key. The signing private key must remain server-side and must never be exposed to browser code.

## Repository layout

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Reusable CI workflow
│       └── deploy-api.yml         # API deployment and semantic release workflow
├── apps/
│   ├── api/                       # NestJS API and Dockerfile
│   └── web/                       # Next.js frontend
├── docs/
│   ├── ci.md                      # GitHub Actions, WIF, deployment, and releases
│   ├── docker.md                  # Docker Desktop and API container guide
│   ├── gcloud.md                  # Cloud Run, load-balancer, and cost guide
│   └── postmortem.md              # (TODO) Deployment and troubleshooting history
├── packages/
│   ├── tailwind-config/           # Shared Tailwind configuration
│   ├── typescript-config/         # Shared TypeScript configuration
│   ├── ui/                        # Shared React components and styles
│   └── validators/                # Shared Zod environment validators
└── README.md                      # Root entry point documentation
```

## Prerequisites

Ensure you have the following tools installed before setting up the project

| Tool                 | Required Version | Purpose                                            |
| -------------------- | ---------------- | -------------------------------------------------- |
| **Node.js**          | `^26.11.1`       | JavaScript runtime environment                     |
| **pnpm**             | `12.10.1`        | Package manager and monorepo workspace coordinator |
| **Docker Desktop**   | latest           | Containerised local API development                |
| **Google Cloud CLI** | latest           | `gcloud` management for Google Cloud deployment    |
| **OpenSSL**          | latest           | Local Ed25519 signing key pair generation          |
| **Git**              | latest           | Version control                                    |

## Getting Started

### 1. Install Package Manager

If **pnpm** is not yet installed on your system, install it globally using `npm`:

```powershell
npm install --global pnpm@12.10.1
```

### 2. Verify Installations

Run the following commands in your terminal to confirm that your local environment matches the workspace criteria:

```powershell
node --version
pnpm --version
docker --version
gcloud --version
```

### 3. Install Dependencies

Run the package installer from the root of your repository workspace to securely fetch your node modules:

```powershell
pnpm install --frozen-lockfile
```

To update workspace dependencies to their newest minor and patch versions according to the constraints defined in your `package.json`, use the interactive update utility:

```powershell
pnpm update --recursive --interactive
```

### 4. Generate Local Ed25519 Key Pair

Run the following commands from the repository root using the OpenSSL Command Prompt. The generated PEM files are automatically ignored by Git and Docker and must remain local to your machine.

```powershell
# generate the private key
openssl genpkey -algorithm Ed25519 -out nest-api-private.pem

# extract the public key
openssl pkey -in nest-api-private.pem -pubout -out nest-api-public.pem
```

> [!WARNING]
>
> #### Critical Security Rules:
>
> - **NestJS API** requires the **public key** to verify signatures.
> - **Next.js Web Server** requires the **private key** to sign payloads.
>   Never expose either key in a `NEXT_PUBLIC_` environment variable or commit them to version control.

The shared Zod environment validator expects escaped newline sequences (`\n`). In your local configuration files, flatten the multiline PEM text into a single line, replacing literal line breaks with `\n`.

### 5. Configure Local Environment Files

Initialize your local environment settings by copying the workspace templates:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Open the newly created files and replace the placeholders with your single-line escaped PEM keys:

<ul style="padding-left: 0; margin-left: 0; list-style-position: inside;">
  <li><strong>File:</strong> <code>apps/api/.env</code></li>
</ul>

```dotenv
NODE_ENV=development
PORT=3001
NEST_API_SIGNING_PUBLIC_KEY=<LOCAL_PUBLIC_PEM_WITH_ESCAPED_NEWLINES>
```

<ul style="padding-left: 0; margin-left: 0; list-style-position: inside;">
  <li><strong>File:</strong> <code>apps/web/.env.local</code></li>
</ul>

```dotenv
NODE_ENV=development
NEST_API_BASE_URL=http://127.0.0.1:3001
NEST_API_SIGNING_PRIVATE_KEY=<LOCAL_PRIVATE_PEM_WITH_ESCAPED_NEWLINES>
```

### 6. Start Local Development Instances

Launch the target microservices in separate terminal windows from the repository root.

**Terminal 1: NestJS API Gateway**

```powershell
pnpm --filter api dev
```

<ul style="padding-left: 0; margin-left: 0; list-style-position: inside;">
  <li><strong>Local Endpoint:</strong> <code>http://127.0.0.1:3001/api/v1</code></li>
  <li><strong>Note:</strong> The API is guarded by default. Unauthenticated requests automatically return a <code>401 Unauthorized</code> status.
</ul>

**Terminal 2: Next.js Frontend**

```powershell
pnpm --filter web dev
```

<ul style="padding-left: 0; margin-left: 0; list-style-position: inside;">
  <li><strong>Local Endpoint:</strong> <code>http://127.0.0.1:3000</code></li>
  <li><strong>Note:</strong> The frontend application server handles API request signing completely server-side. The underlying private key is never transmitted to the client browser.
</ul>

## Workspace Commands

Execute these common utility commands from the repository root to maintain project health:

| Command                      | Purpose                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build`                 | Compiles all backend applications, frontend modules, and internal dependencies.                                                                  |
| `pnpm lint`                  | Executes workspace-wide quick validation using [**Biome**](https://biomejs.dev/).                                                                |
| `pnpm check-types`           | Validates TypeScript syntax across all workspace packages.                                                                                       |
| `pnpm --filter api test`     | Runs the NestJS application unit test suits.                                                                                                     |
| `pnpm --filter api test:e2e` | Runs the NestJS application end-to-end integration tests.                                                                                        |
| `pnpm --filter api lint`     | Lins the API module with [**Oxlint**](https://oxc.rs/docs/guide/usage/linter) _(Note: This specific check is local only and not yet part of CI)_ |

## Deployment Architecture

### Web (Next.js)

Point your Vercel project configuration to the `apps/web` root directory. Populate your production `NEST_API_BASE_URL` and `NEST_API_SIGNING_PRIVATE_KEY` variables strictly within the server-side environment manager before deploying. For automated deployment pipelines, see [docs/ci.md](docs/ci.md).

### API (NestJS)

To build the API microservice container, execute the build sequence from the monorepo root window so the engine can capture global package contexts. Built images are pushed to **Google Artifact Registry** and hosted on **Google Cloud Run**. The production-grade verification public key resides inside **Google Secret Manager**. For configuration settings, see [docs/docker.md](docs/docker.md) and [docs/gcloud.md](docs/gcloud.md)

### Networking & CI/CD Pipelines

- <strong>Ingress Management:</strong> To minimize unnecessary project upkeep costs, infrastructure routes directly to the raw Cloud Run <code>run.app</code> endpoint with public ingress set to <code>all</code>. Perimeter security relies entirely on the NestJS authenticated service token guard.

- **Continuous Integration**: GitHub Actions authenticates straight into Google Cloud Platform environments via **Workload Identify Federation (WIF)**, eliminating the risk of leakable, long-lived service account JSON secret keys.

## Security Hardening Notes

- **Secret Isolation:** Never commit `.env` overrides, runtime private keys, structural cloud service keys, or ephemeral production CI credentials to version control.
- **Asymmetric Key Lifecycle**: Keep vercel environment signatures entirely server-side. Public validation strings must stay inside Secret Manager.
- **Perimeter Security**: Setting network ingress to `all` means the Cloud Run endpoint layer accepts public network packets. The NestJS security guard is solely responsible for parsing incoming headers and dropping unauthenticated requests.
- **Identity Contexts**: Service tokens uniquely authenticate the automated application server instance itself, not an end-user or operational manager. Introduce distinct administrative roles before exposing destructive methods.
- **Edge Routing Safety**: Restrict sensitive administrative database payloads or protected state mutations from entering public page cache engines.

## Further Reading

Follow these guides in order to replicate the application:

| File                                     | Context                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| [README.md](README.md)                   | Understand the architecture, prerequisites, local environment, and development commands. |
| [docs/docker.md](docs/docker.md)         | Local container architecture, engine patterns, and multi-stage configurations.           |
| [docs/gcloud.md](docs/gcloud.md)         | Google Cloud Run deployment topologies, costs, and architecture mappings.                |
| [docs/ci.md](docs/ci.md)                 | GitHub Action pipelines and Workload Identity Federation workflows.                      |
| [docs/postmortem.md](docs/postmortem.md) | System incident historical documentation, lessons learned, and failure points            |
