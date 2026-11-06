# Docker Desktop and API Container Setup

This guide covers setting up Docker Desktop on Windows, building the NestJS API container from the monorepo root, running it locally, and preparing the image for Google Artifact Registry.

The API utilizes a multi-stage Dockerfile located at `apps/api/Dockerfile`. It prunes the monorepo workspace to isolate the API and its respective dependencies, compiles the source code, and outputs a minimal production image running under an unprivileged `node` user.

## A. Install Docker Desktop on Windows

The Windows Subsystem for Linux (WSL 2) backend is required to run Linux containers efficiently on windows.

### Step 1: Update WSL 2

Open an elevated PowerShell windows (Run as Administrator) and run:

```powershell
wsl --version
wsl --update
```

### Step 2: Install Docker Desktop

<ul style="padding-left: 0; margin-left: 0; list-style-position: inside;">
  <li>Download the install from the <a href="https://docs.docker.com/desktop/setup/install/windows-install/">Official Docker Windows Download Page.</a></li>
  <li>Run the executable. Ensure the <strong>WSL 2 configuration option</strong> is enable during installation.
  <li>Launch Docker Desktop and accept the service agreement.
</ul>

### Step 3: Verify Installation

Verify that Docker, Buildx, and the engine daemon are responsive:

```powershell
docker version
docker buildx version
docker info
```

If Docker commands cannot connect to the daemon, start Docker Desktop and confirm it is using Linux containers.

## B. Prepare Local Asymmetric Verification Keys

> [!NOTE]
> If you already generated these keys while completing the **Getting Started** section of the [README.md](../README.md#4-generate-local-ed25519-key-pair) guide, you can skip this step and proceed directly to Section 3.

The NestJS API requires the public key of an Ed25519 pair of verify signatures. The private key must stay exclusive to the web frontend and must never enter the API image context.

Run the following commands from the repository root:

```powershell
# generate the private key
openssl genpkey -algorithm Ed25519 -out nest-api-private.pem

# extract the public key
openssl pkey -in nest-api-private.pem -pubout -out nest-api-public.pem
```

> [!WARNING]
>
> #### Critical Security Hardening
>
> - Both `.gitignore` and `.dockerignore` are configured to exclude `**/*.pem` files. Ensure these files are never committed to version control or provided as raw Docker build arguments.
> - Environment file schemas expect inline newline symbols represented as literal `\n` character strings on a single line. For example, represent each PEM line break as `\n` in the one-line variable value.

## C. Build the API Image Locally

Execute the compilation from the absolute **repository root**. THe terminating dot (`.`) is mandatory to establish the entire workspace folder as the Docker build context.

```powershell
# Build the Docker image for the NestJS API
# --platform: Forces the build architecture to 64-bit Linux (essential for cross-platform deployment)
# --tag: Tags the resulting local image with a recognizable name and version
# --load: binds the resulting build artifact directly into your machine's local Docker image daemon.
docker buildx build --platform linux/amd64 --file apps/api/Dockerfile --tag portfolio-api:local --load .
```

`.dockerignore` sanitizes the context by completely dropping absolute environment modules (`.env`), private PEM targets, and local build caches.

Verify the local image creation:

```powershell
docker image inspect portfolio-api:local
```

## D. Run and Test the Container Locally

The container exposes a standard port and parses network calls dynamically using an environmental `PORT` key. Set this value to you local validation port (e.g., `3001`).

### Step 1: Start Container with Environment File

Spin up the container instance from the repository root by injecting your local environment file directly using the `--env-file` flag:

```powershell
# --rm: Automatically removes the container and cleans up its anonymous volumes when it exits.
# --env-file: Safely passes all configured variables (including your single-line public verification key) into the container environment without leaking secrets in your shell history.
# -p 3001:3001: Maps port 3001 of the container to port 3001 on your local host engine.
docker run --rm --env-file apps/api/.env -p 3001:3001 portfolio-api:local
```

### Step 2: Validate the Route Security

Open a separate terminal window and dispatch an unauthenticated request to the local API endpoint:

```powershell
curl -i http://127.0.0.1:8080/api/v1
```

- **Expected Output**: The network call should immediately be dropped by the NestJS application token guard, returning a `401 Unauthorized` header.
- **Teardown**: Press `Ctrl + C` in the running container terminal. The `--rm` parameter automatically drops ephemeral storage and cleans up the container runtime.

## E. Connect the Next.js Frontend

To verify full integration, configure your local frontend server to communicate directly with your running API container.

### Step 1: Configure Environment Variables

Create or edit `apps/web/.env.local` to point to the active container:

```dotenv
NODE_ENV=development
NEST_API_BASE_URL=http://127.0.0.1:3001
NEST_API_SIGNING_PRIVATE_KEY=<LOCAL_PRIVATE_PEM_WITH_ESCAPED_NEWLINES>
```

### Step 2: Run the Web Server

Launch your Next.js workspace server from a separate terminal instance at the repository root:

```powershell
pnpm --filter web dev
```

Navigate to [http://localhost:3000](http://localhost:3000). The Next.js server signs the request server-side using the local private key, safely fetching data from your API container without exposing secrets to the browser.

## F. Distribute Image to Artifact Registry

Follow this progression to manually build and stage your application image to Google Cloud Platform.

### Step 1: Initialize Shell Target Variables

```powershell
$PROJECT_ID = "<GCP_PROJECT_ID>"      # gcloud projects list to get the project ID
$REGION = "europe-west1"              # use the region available nearest to you
$REPOSITORY = "portfolio-images"
$IMAGE_NAME = "portfolio-api"

# fetch the short 12-character Git commit hash dynamically
$TAG = (git rev-parse --short=12 HEAD).Trim()

# compile variables into a qualified image target URI
# the '`' treat the colon (:) as literal text rather than part of the variable name
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME`:$TAG"
```

### Step 2: Authenticate Cloud SDK and Docker Daemons

```powershell
gcloud auth login
gcloud config set project $PROJECT_ID
gcloud auth configure-docker "$REGION-docker.pkg.dev"
```

### Step 3: Multi-Platform Build and Push

Compile and push the production container layers straight to the secure Google repository:

```powershell
docker buildx build `
  --progress=plain `
  --platform linux/amd64 `
  --file apps/api/Dockerfile `
  --tag $IMAGE `
  --push .
```

> [!NOTE]
> In automated environments, the CI pipeline automatically overrides the `$TAG` variable with the real-time compilation hash (`${{ github.sha }}`).

## G. Cloud Run Deployment Overview

Production-grade deployments require an externalized architecture profile. Comprehensive guidelines covering IAM service accounts, networking parameters, and load balancers are available in [docs/gcloud.md](docs/gcloud.md).

- **Secret Isolation**: The runtime container must resolve its verification key string via **Google Secret Manager**. Keys must never be baked directly into application layers or hardcoded inside workspace trees.
- **Interface Binding**: Google Cloud Run dynamically routes incoming traffic to your service through a custom runtime `PORT` variable. The NestJS application server must explicitly bind to interface address `0.0.0.0` to process cloud infrastructure traffic.

## H. Troubleshooting Guide

### Docker Daemon Connectivity Errors

If commands fail to reach the engine, ensure Docker Desktop is running and configured for Linux containers.

```pwsh
# Check engine system diagnostics
docker info
```

### Failed Workspace Content Resolution during Build

- **Symptom**: Docker cannot locate parent packages or files listed inside target manifests.
- **Resolution**: Ensure `docker buildx build` is called from the repository root directory with a trailing dot context (`.`). Do not attempt execution from inside the standalone `apps/api` folder.

### Cloud Run Instance Fails Container Port Binding Check

- **Symptom**: Cloud logs indicate that the app did not bind or listen on the system `PORT` within the allocation timeframe.
- **Root Cause**: This is typically a secondary symptom. A NestJS bootstrap dependency validation crash or missing secret key error often halts initialization before `app.listen()` fires.
- **Checklist:**
  - [ ] Confirm `PORT` values are parsed directly from the cloud environment block.
  - [ ] Verify that the application engine explicitly listens on target address `0.0.0.0`.
  - [ ] Ensure the production Docker execution layer starts the engine with `node dist/main.js`.
  - [ ] Validate that `NEST_API_SIGNING_PUBLIC_KEY` is completely populated and structurally valid within Secret Manager.

### Direct API Endpoint Queries Return 401 Unauthorized

- **Analysis**: This behavior is correct and expected. The API gateway drop rule functions precisely to block unsigned traffic.
- **Validation Method**: Test the full connection workflow via the Next.js server tier, which holds the asymmetric private signing key necessary for authenticating requests.
