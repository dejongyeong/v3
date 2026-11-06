# CI/CD and Google Cloud Workload Identity Federation

This guide documents the GitHub Actions automation architecture, production API deployment pipelines, semantic release structures, and Google Cloud Workload Identity Federation (WIF) setup.

## A. Workflow Infrastructure

The repository orchestrates automation using two primary GitHub Actions workflow files located in `.github/workflows/`.

- **Continuous Integration** (`ci.yml`)
  - **Triggers**: Automatically executes on pull requests targeting the `main` branch.
  - **Capability**: Exposes a reusable `workflow_call` hook, allowing deployment pipelines to enforce code validation gates before shipping code.
  - **Security**: Generates an isolated, ephemeral Ed25519 asymmetric key pair at runtime to validate the server-to-server request-signing layer.
- **Production Deployment** (`deploy-api.yml`)
  - **Triggers**: Executes on direct pushes or merged pull requests to the `main` branch when changes are detected in the API application layer, shared `packages/`, build scripts, or workflow configurations.
  - **Execution Flow**: Invokes the reusable `ci.yml` pipeline first. The API deployment phase initializes _only_ after all core validation blocks pass.
  - **Release Lifecycle**: Executes the automated **Semantic Release** sequence only after both the CI validation and Google Cloud Run deployment stages complete successfully.

> [!NOTE]
> To maintain deterministic execution trees, this repository does not use the unpredictable `workflow_run` trigger hook. Instead, deployment and release jobs live inside a single unified workflow file orchestrated via explicit GitHub ACtions `needs` dependency declarations.

## B. CI Checklist

The automated pipeline is split into two consecutive, isolated phases: a static validation phase (`verify`) followed by a runtime environment validation phase (`integration`).

### Phase 1: Static Code Verification

The initial test runner check code health sequentially:

1. Checkout: Pulls the target commit reference.
2. Runtime Initialization: Sets up the specific Node.js runtime environment and activates the `pnpm` package manager.
3. Lockfile Integrity: Fetches external node modules cleanly using `pnpm install --frozen-lockfile`.
4. Formatting and Linting: Validates syntax standards across the monorepo workspace via Biome by invoking `pnpm lint`.
5. Workspace Compilation: Compiles all internal packages and applications using the `pnpm build`.
6. Static Type Validation: Checks for structural TypeScript compiler alignment via `pnpm check-types`.
7. Test Suite Execution: Runs isolated NestJS API package unit tests followed by comprehensive end-to-end integration tests.

### Phase 2: Runtime Integration Check

The integration phase executes immediately after the static verification phase passes, confirming that the client-to-server authentication mechanics function as expected.

```text
[GitHub Actions Runner Sandbox]
├── 1. Generates Ephemeral Key Pair in `RUNNER_TEMP`
├── 2. Boots NestJS API Container
│   └── Loaded with temporary Public Key String
├── 3. Tests Security Perimeter
│   └── Asserts unauthenticated call returns 401 Unauthorized
└── 4. Boots Next.js Server (Dev Mode)
    ├── Loaded with matching Private Key String
    ├── Dispatches signed server-to-server HTTP request
    └── Asserts response payload matches "Hello World!"
```

1. **Ephemeral Key Lifecycle:** Generates a temporary test-scoped Ed25519 key pair straight into the runner's isolated `RUNNER_TEMP` environment path.
2. **API Verification:** Starts the local NestJS API application server using the public verification key. It queries the secure endpoint, verifying that an unauthenticated network request yields a strict 401 Unauthorized block.
3. **Frontend Signature Matching:** Boots the Next.js framework in active development mode (`next dev`) while injecting the corresponding asymmetric private key string and local endpoint parameters.
4. **End-to-End Assertion**: Targets the application page view and verifies that the output successfully yields a "Hello World!" string. This confirms that the server-to-server request handshake was a signed correctly and accepted by the NestJS endpoint guard.
5. **Environment Teardown:** Terminates both background node loops and completely wipes the temporary PEM text fragments from disk space.

> [!IMPORTANT]
> Ephemeral test keys generated during runtime checks are strictly scoped to the transient `RUNNER_TEMP` execution thread. They are never read from GitHub secrets, never exposed to external variables, and never published to pipeline job artifact stores.

### Current Architectural Guardrails & Caveats

| Caveats                        | Details                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linting Discrepancies          | Root workspace scans (`pnpm lint`) run using the performance optimized Biome.js engine. Individual API su-packages utilize Oxlint inside their standalone lint scripts. Note that the active CI workflow does not invoke `pnpm --filter api lint` inside the remote cloud runner.                                                                                |
| Runtime Integration Scope      | The integration stage is a live request-response (non-static render) verification wrapper using `next dev`. It does not function as a pre-rendered static analysis check.                                                                                                                                                                                        |
| Caching Strategy Controls      | The underlying data layer presently calls `connection()` and initiates network fetches with explicit `cache: "no-store"` settings. If these requirements shift toward cacheable or statically compiled layout files, the pipeline configuration must be updated to invoke a static render check against a local simulation source before executing `pnpm build`. |
| Perimeter Dependency Isolation | Under no circumstances should target GitHub Actions CI runners attempt to poll live production API gateways or parse live Google Cloud Secret Manager signing components during testing procedures. Keep execution scopes completely self-contained.                                                                                                             |
| Testing                        | The API end-to-end (E2E) test suite runs automatically in the CI pipeline. All test cases must align with the current `/api/v1` routes and validate both authorized and unauthorized auth-guard behaviors.                                                                                                                                                       |

## C. API Deployment Workflow

The `deploy-api.yml` pipeline automates the build, test, and deployment process for the API service.

### Trigger Conditions

The workflow triggers on pushes to the main branch when changes occur in any of the following paths:

- API source code
- Shared packages
- Monorepo lockfiles
- Turborepo configuration (`turbo.json`)
- Docker build context files
- CI/CD workflow and release configurations

### Pipeline Execution Steps

1. **Validate:** Runs the core test and lint suites by calling `ci.yml` as a reusable workflow.
2. **Authenticate:** Connects to Google Cloud Platform (GCP) using Workload Identity Federation (WIF) via `google-github-actions/auth`.
3. **Build and Push:** Compiles the container image from the monorepo root using Docker Buildx and pushes it to the registry.
4. **Deploy:** Deploys the new image to Google Cloud Run, binding it to the designated runtime service account and injecting the public signing key via Secret Manager.
5. **Release:** Executes `semantic-release` to tag and version the codebase only after both the CI and deployment jobs complete successfully.

> [!TIP]
> **Production Ingress Configuration**
>
> To prevent configuration drift, explicitly include the `--ingress all` flag in the Cloud Run deployment command. While the service may currently persist this setting implicitly, defining it in the workflow guarantees a predictable production network architecture.

## D. GitHub Deployment Environment Configuration

Follow these steps to establish a dedicated `production` environment for managing deployments safely and mapping the necessary configuration parameters.

### 1. Create the Environment

- In your GitHub repository, navigate to the **Settings** tab.
- From the left sidebar menu, select **Environments**.
- Click **New Environment**, enter the name `production`, and confirm by clicking **Configure Environment**.
- _(Optional)_ Establish safeguards by enforcing `Required reviewers` or applying `Deployment branch rules` to restrict which branches can deploy to this environment.

### 2. Define Environment Variables

Add the non-sensitive configuration values listed below directly as environment variables. The deployment job automatically expose these keys to the runner via the `vars` context.

| Variable                         | Value Format / Example                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `<GCP_PROJECT_ID>`                                                                                   |
| `GCP_REGION`                     | `europe-west1`                                                                                       |
| `GCP_ARTIFACT_REPOSITORY`        | `<GCP_ARTIFACT_REPOSITORY>`                                                                          |
| `GCP_CLOUD_RUN_SERVICE`          | `<GCP_CLOUD_RUN_SERVICE>`                                                                            |
| `GCP_RUNTIME_SERVICE_ACCOUNT`    | `<RUNTIME_SERVICE_ACCOUNT_EMAIL>`                                                                    |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/WorkloadIdentityPools/<POOL_ID>/providers/<PROVIDER_ID>` |

#### 2.1 `GCP_ARTIFACT_REPOSITORY`

To find the exact name of your **Artifact Registry** repository, list all repositories across your project within the selected region:

```powershell
gcloud artifacts repositories list `
  --project=<GCP_PROJECT_ID> `
  --location=<GCP_REGION> `
  --format="table(name,format,location)"
```

Look at the `REPOSITORY` or `NAME` column. Use the short identifier rather than the full path.

#### 2.2 `GCP_CLOUD_RUN_SERVICE` or `PROVIDER_ID`

To see the names of your deployed **Cloud Run** services, run:

```powershell
gcloud run services list `
  --project=<GCP_PROJECT_ID> `
  --location=<GCP_REGION> `
  --format="table(metadata.name,status.url)"
```

Look at the `NAME` column for the identifier that matches your API application.

#### 2.3 `GCP_RUNTIME_SERVICE_ACCOUNT`

To fetch the email addresses of the **Identity and Access Management (IAM) service accounts** within your project:

```powershell
gcloud iam service-accounts list
```

Locate the runtime service account created for your deployment. The value you need will be the full email address format found under the `EMAIL` column (e.g., `account-name@<GCP_PROJECT_ID>.iam.gserviceaccount.com`)

#### 2.3 `GCP_WORKLOAD_IDENTITY_PROVIDER`

Unlike the simple names above, this variable requires the **fully qualified resource URI** of your OIDC provider.

First, list you workload identity pools to find your pool ID:

```powershell
gcloud iam workload-identity-pools list --location=global --format="value(name)"
```

This command will return one or more full resource paths that look like this:

<code>projects/1234567890/locations/global/workloadIdentityPools/<b>my-github-pool</b></code>

In this example, your **Project Number** is `1234567890` and `Pool ID` is <code><b>my-github-pool</b></code>. You will use the Pool ID whenever a command specifically asks for `--workload-identity-pool="<POOL_ID>"`

Next, use the pool ID to list the providers and display their full resource path:

```pwsh
gcloud iam workload-identity-pools providers list `
  --workload-identity-pool=<POOL_ID> `
  --location=global `
  --format="value(name)"
```

This command will print the exact string format required by GitHub Actions: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/providers/<GCP_CLOUD_RUN_SERVICE>`

> [!WARNING]
> These entries must only contain public identifiers, not active credentials. Do **not** upload a Google Cloud service account JSON key here.
>
> - Store the **Cloud Run public verification key** securely within **Google Secret Manager**.
> - Store the **Vercel private signing key** as a server-side **Production environment variable** inside vercel.

### 3. Workflow Permissions

The automation depends on the default `GITHUB_TOKEN` provided by the runner to orchestrate semantic releases.

- Ensure the release job explicitly scopes permissions to `contents: write`.
- No `pull_request: write` are required, as the pipeline does not append comments or apply labels to pull requests.

## E. Configure Google Cloud Workload Identity Federation (WIF)

Implement identity federation to allow GitHub Actions to securely authenticate with Google Cloud without using long-lived service account keys. The following PowerShell instructions establish a dedicated, highly restricted identity pool and OIDC provider.

### Prerequisites: Retrieve Required Identifiers

Before running the main script, use the commands below to gather your unique Google Cloud and GitHub identifiers.

#### Find Existing Google Cloud Pool, Provider IDs, and Artifact Repository

If you have already created your Workload Identity architecture and need to find their short string IDs, run:

```pwsh
# List available Pools to find your $POOL_ID
gcloud iam workload-identity-pools list `
  --location=global
  --format="table(name.basename():label=POOL_ID, displayName)"

# List Providers under a specific pool to find your $PROVIDER_ID
gcloud iam workload-identity-pools providers list `
  --workload-identity-pool="<YOUR_POOL_ID>" `
  --location=global `
  --format="table(name.basename():label=PROVIDER_ID, displayName)"

# List Artifact Repository
gcloud artifacts repositories list `
  --project=<GCP_PROJECT_ID> `
  --location=<GCP_REGION> `
  --format="table(name,format,location)"
```

#### Retrieve GitHub Context, Repository ID, and Owner ID

Replace `<OWNER>/<REPO>` with your actual repository path (e.g., `dejongyeong/v3`). If you have the GitHub CLI `gh` installed, run these commands to instantly extract your short repository name and required numeric metadata IDs:

```pwsh
# Get standard Repository name path
$REPOSITORY = (gh repo view "<OWNER>/<REPO>" --json nameWithOwner --jq .nameWithOwner)

# Get the numeric Repository ID
$REPOSITORY_ID = (gh repo view $REPOSITORY --json id --jq .id)

# Get the numeric Owner/Organization ID
$OWNER_ID = (gh repo view $REPOSITORY --json owner --jq .owner.id)

# Verify the retrieved GitHub Values
Write-Host "Repository: $REPOSITORY | Repo ID: $REPOSITORY_ID | Owner ID: $OWNER_ID"
```

> [!TIP]
> If you do not have the `gh` CLI, you can find your numeric IDs by making an unauthenticated web request to `https://github.com/<OWNER>/<REPO>` in your browser and searching for the `id` and `owner: { "id": ... }` keys.

### Step 1: Initialize Environment Variables

Define your project configuration parameters in PowerShell. Replace the bracketed placeholders (`<...>`) with your actual deployment values.

```pwsh
# Core Project Configuration
$PROJECT_ID = "<GCP_PROJECT_ID>"
$PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format "value(projectNumber)").Trim()

# Workload Identity Constants (discovered above or defined fresh)
$POOL_ID = "<YOUR_POOL_ID>"
$PROVIDER_ID = "<YOUR_PROVIDER_ID>"

# GitHub Context (populated automatically from prerequisites, or entered manually)
$REPOSITORY = if ($REPOSITORY) { $REPOSITORY } else { "<GITHUB_OWNER>/<GITHUB_REPOSITORY>" }
$REPOSITORY_ID = if ($REPOSITORY_ID) { $REPOSITORY_ID } else { "<NUMERIC_GITHUB_REPOSITORY_ID>" }
$OWNER_ID = if ($OWNER_ID) { $OWNER_ID } else { "<NUMERIC_GITHUB_OWNER_ID>" }

# Runtime and Infrastructure Targets
$REGION = "<YOUR_PROJECT_REGION>" # europe-west1
$ARTIFACT_REPOSITORY = "<YOUR_ARTIFACT_REPOSITORY>"
$RUNTIME_SERVICE_ACCOUNT = "<YOUR_RUNTIME_SERVICE_ACCOUNT>"

# Set the active gcloud CLI context
gcloud config set project $PROJECT_ID
```

### Step 2: Enable Google Cloud APIs

Activate the core infrastructure services required for secure token exchange, identity management, and application hosting:

```pwsh
gcloud services enable `
  iam.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com `
  run.googleapis.com `
  artifactregistry.googleapis.com `
  --project=$PROJECT_ID
```

### Step 3: Create the Workload Identity Pool

Establish a dedicated logical container to manage your external GitHub identities:

```pwsh
gcloud iam workload-identity-pools create \$POOL_ID `
  --project \$PROJECT_ID `
  --location=global
  --display-name="GitHub Actions"
```

### Step 4: Provision the OIDC Provider with Security Conditions

Deploy an OpenID Connect (OIDC) provider inside the pool. This configuration maps incoming GitHub tokens to Google Cloud Identity attributes and strictly locks down access so that only deployment originating from your specific repository ID, owner ID, main branch, and GitHub production environment are permitted.

```pwsh
gcloud iam workload-identity-pools providers create-oidc \$PROVIDER_ID `
  --project=$PROJECT_ID `
  --location=global `
  --workload-identity-pool=$POOL_ID `
  --display-name="Portfolio GitHub Actions (or any names)" `
  --issuer-uri="https://token.actions.githubusercontent.com" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.environment=assertion.environment" `
  --attribute-condition="attribute.repository_id == '$REPOSITORY_ID' && attribute.repository_owner_id == '$OWNER_ID' && attribute.ref == 'refs/heads/main' && attribute.environment == 'production'"
```

The deployment job's `environment: production` setting is required for the environment claim in this condition. Google requires mapping the attributed referenced by a provider condition. [Google provider attribute conditions](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines#gcloud)

### Step 5: Grant the Federated Identity Only Deployment Permissions

The current workflow uses direct WIF credentials rather than impersonating a Google service account. Grant permissions to the repository principal set. Apply only the roles required by the workflow:

Build the principle-set member:

```pwsh
$WIF_MEMBER = "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository_id/$REPOSITORY_ID"
```

Grant write access to the specific Artifact Registry repository:

```pwsh
# Replace <GCP_ARTIFACT_REPOSITORY> with the values discovered above
gcloud artifacts repositories add-iam-policy-binding $ARTIFACT_REPOSITORY `
  --project=$PROJECT_ID `
  --location=$REGION `
  --member=$WIF_MEMBER
  --role="roles/artifactregistry.writer"
```

Grant Cloud Run deployment access:

```pwsh
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member=$WIF_MEMBER `
  --role="roles/run.developer"
```

`roles/run.developer` is project-scoped in this example. For tighter isolation, use a dedicated project or evaluate a custom role and narrower resource scope.

Allow this identity to deploy with the existing Cloud Run runtime service account:

```pwsh
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SERVICE_ACCOUNT `
  --project=$PROJECT_ID `
  --member=$WIF_MEMBER `
  --role="roles/iam.serviceAccountUser"
```

The Cloud Run runtime service account separately needs Secret Manager access to the API public verification key; GitHub's federated identity does not need to read that secret.

```pwsh
# Retrieve the Secret Names
gcloud secrets list --format="value(name)"
```

```pwsh
# Replace <PUBLIC_SECRET_NAME> with the discovered secret name
gcloud secrets add-iam-policy-binding "<PUBLIC_SECRET_NAME>" `
  --project=$PROJECT_ID `
  --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" `
  --role="roles/secretmanager.secretAccessor"
```

If you choose service-account impersonation instead of direct WIF, configure the provider principal with `roles/iam.workloadIdentityUser` on that deployer service account and update the auth action to pass `service_account`. Do not mix the two models accidentally.

### Step 6: Add the GitHub Production Environment Variables

Get the provider's full resource name for `GCP_WORKLOAD_IDENTITY_PROVIDER`

```pwsh
gcloud iam workload-identity-pools providers describe $PROVIDER_ID `
  --project=$PROJECT_ID `
  --location=global `
  --workload-identity-pool=$POOL_ID `
  --format="value(name)"
```

It has this form:

`projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/<POOL_ID>/providers/<PROVIDER_ID>`

## E. CI/CD Architecture & Security Properties

GitHub Actions workflows enforce strict security boundaries, preventing credential exposure and unauthorized access during the Continuous Integration (CI) and Continuous Deployment (CD) life-cycles.

### Credential & Secret Management

- **Zero Production Secrets in CI:** Pull request workflows execute completely isolated from production variables and require no production scale.
- **Ephemeral Integration Testing:** Signed API and web integration tests utilize dynamically generated, short-lived keys instead of static credentials.
- **No Hardcoded Keys:** Long-lived Google Cloud service account JSON keys are strictly prohibited from being stored in GitHub Secrets.

### Identity & Access Control via Workload Identity Federation (WIF)

- **Short-Lived Tokens:** The `id-token: write` permission is exclusively assigned to the production deployment job to request temporary OpenID Connect (OIDC) tokens.
- **Strict OIF Conditions:** The Google Cloud WIF provider enforces rigid attribute conditions. Access is restricted solely to the designated repository, repository owner, `main` branch, and the `production` environment.
- **Principle of Least Privilege:**: GitHub token permissions are explicitly scoped down to the minimum required access for the deployed job.

### Workflow Isolation

- **Exploit Prevention:** The `workflow_run` trigger is barred from our automation pipelines to prevent untrusted pull request code from escalating permissions or hijacking downstream jobs.

## F. Semantic Release & Automated Publishing

We use automated semantic release to handle versioning, changelog generation, and tag creation based on standard commit conventions.

### Execution Order & Dependency

The release job executes sequentially and **must wait for both the CI and deployment jobs to complete successfully** before starting:

```yaml
needs: [ci, deploy]
```

### Execution Steps

1. **Repository Checkout:** Fetches the full Git history and all tags.
2. **Dependency Installation:** Resolves and install project dependencies.
3. **Release Execution:** Triggers the semantic release process via the local package manager:

```pwsh
pnpm exec semantic-release
```

### Configuration & Commit Conventions

- **Target Branch:** Releases are triggered exclusively from the `main` branch.
- **Tag Format:** Standardize as `v<version>` (e.g., `v1.0.0`).
- **Commit Conventions:** Developers must adhere to the project's configured commit message conventions. `semantic-release` analyzes these messages to automatically determine the next version bump (major, minor, or patch).

### Job-Level Permissions

To maintain a tight security profile, repository write access is strictly limited to the release phase. The CI and deploy jobs do not receive write access to repository contents.

```yaml
permissions:
  contents: write
```
