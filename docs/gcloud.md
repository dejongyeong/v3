# Google Cloud Run API Deployment and Networking

This guide outlines two distinct networking architectures for deploying and exposing the NestJS portfolio API and Google Cloud Run.

### A. Authentication Architecture

The API is secured using a **NestJS service-token guard**.

- **Mechanism:** The Next.js frontend signs a service token and passes it directly to the NestJS API for verification.
- **Security:** This token is handled strictly server-to-server and is **never** exposed to the user's browser.

> [!WARNING]
> Validate all placeholder values (project IDs, service names, regions, service accounts, secrets, and container images) before executing commands. **Never** hardcode or log private signing keys, credentials, or secrets in configuration files, commands, or version control.

## B. Deployment Options

Select the deployment model that best fits your budget, security, and routing requirements.

### Option A: Direct Cloud Run Exposure (Cost-Optimized)

This approach routes traffic directly to the default Google-provided endpoint. It minimizes infrastructure complexity and removes load-balancing costs.

- **Routing:** Public traffic accesses the API directly via the default `*.run.app` URL.
- **Ingress Configuration:**: Set to `Allow all` (`--ingress=all`) to accept public internet traffic.

### Option B: Global External Application Load Balancer (Enterprise/Production)

This approach introduces a dedicated routing layer. It allows for custom domains, advanced traffic management, and tightened network security.

- **Routing:** Public traffic hits a custom API domain pointing to a **Global External Application Load Balancer (ALB)**. The load balancer then forwards requests to the backend Cloud Run service.
- **Ingress Configuration:** Restricted to `Internal and Cloud Load Balancing` (`--ingress=internal-and-cloud-load-balancing`). This blocks all direct public access to the underlying `*.run.app` URL, ensuring traffic only flows through the load balancer.

#### Direct Comparison

| Feature              | Option A: Direct               | Option B: Load Balancer (ALB)                                                                            |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Cost**             | Minimal (Cloud Run usage only) | Higher (Base hourly cost for ALB + data processing)                                                      |
| **URL Type**         | Default `*.run.app`            | Custom domain (e.g., `://yourdomain.com`)                                                                |
| **Network Security** | Open to the public internet    | Restricted ingress; protects backend from direct scans                                                   |
| **Traffic Control**  | Basic Cloud Run scaling        | Advanced routing, Content Delivery Network (CDN) caching, and Web Application Firewall (WAF) integration |

## C. Prerequisites

### Project Creation

> [!NOTE]
> Skip this if you already have a project created.

Key rules for Project IDs:

- Must be **globally unique** across all of Google Cloud.
- Must be between **6 and 30** characters long.
- Can only contain **lowercase letters, numbers, and hyphens** (must start with a letter)

```pwsh
gcloud projects create "your-unique-project-id" --name="Your Project Name"
```

### Deployment Service Account Creation

> [!IMPORTANT]
> Do **not** reuse the Cloud Run runtime service account (`$RUNTIME_SA`) for your CI/CD pipelines or deployment engines. Separating your operationally identity (the runtime) from your deployment identity reduces the blast radius if credentials are compromised.

> [!NOTE]
> If you have already provisioned this service account, skip this step. You can check if it exists by running `gcloud iam service-accounts list --project=$PROJECT_ID`

Run the following command to provision a dedicated deployment service account specifically for automated infrastructure delivery, such as GitHub Actions.

_Note: Ensure you replace the `<YOUR_DEPLOYER_SA>` (e.g., web-api-runtime), `$PROJECT_ID`, and `<DISPLAY_NAME>` (e.g., Web API Runtime) variables prior to execution._

```pwsh
gcloud iam service-accounts create "<YOUR_DEPLOYER_SA>" `
  --project=$PROJECT_ID `
  --display-name="<DISPLAY_NAME>"
```

## D. Environment Initialization & Authentication

This section covers configuring your **Windows PowerShell** session variables and authenticating with the **Google Cloud SDK (gcloud CLI)**.

> [!CAUTION]
> Do **not** use project deletion (`gcloud projects delete`) as a teardown or cleanup method. Doing so will permanently destroy unrelated infrastructure, active storage buckets, and shared configurations hosted within the same project tenancy.

### 1. PowerShell Environment Variables

Ensure you have already created the dedicated deployment service account. Review and update all placeholders, including the deployment values and your specific container build version, prior to execution.

```pwsh
# Core Google Cloud Infrastructure Parameters
$PROJECT_ID = "<YOUR_PROJECT_ID>"
$REGION = "europe-west1"
$SERVICE = "<YOUR_SERVICE_NAME>"                    # e.g., web-api
$RUNTIME_SA = "<YOUR_DEPLOYER_SA>@<YOUR_PROJECT_ID>.iam.gserviceaccount.com"

# Artifact Registry & Container Configuration
$REPOSITORY = "<YOUR_REPOSITORY_NAME>"              # e.g., web-images
$IMAGE_NAME = "<YOUR_IMAGE_NAME>"                   # e.g., web-api
$TAG = (git rev-parse --short=12 HEAD).Trim()
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME`:$TAG"

# Networking Parameters
$API_DOMAIN = "api.<YOUR_DOMAIN>.com"
```

### 2. Authentication & Project Initialization

Run the following sequential commands to authenticate your terminal session, pin the active workspace context to the `$PROJECT_ID` variable, and verify configuration state.

#### Step 1: Authenticate with Google Cloud

Initialize a fresh OAuth2 token workflow through your web browser:

```pwsh
gcloud auth login
```

#### Step 2: Set Active Project Scope

Bind your active CLI profile to the specified deployment target:

```pwsh
gcloud config set project $PROJECT_ID
```

#### Step 3: Verify Active Context

Confirm that the workspace project and active account match your intended architecture parameters:

```pwsh
# 1. Output the explicitly targeted project ID
gcloud config get-value project

# 2. List all authorized account and identify the active profile mark (*)
gcloud auth list
```

### 3. API Deployment to Cloud Run

This section details how to prepare your Google Cloud Run environment, build and push your API container image, and deploy it directly to Cloud Run.

#### 3.1: Enable Google Cloud APIs

Activate the required services within your project scope.

> [!NOTE]
> Enabling APIs opens access to features but does not generate charges on its own. Billable usage only begins when active resources like container instances or secrets are provisioned.

Execute the following to enable the base required services:

```pwsh
gcloud services enable `
  run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com `
  --project=$PROJECT_ID
```

If you plan to implement the **Global External Application Load Balancer** architecture later, enable the Compute Engine API as well:

```pwsh
gcloud services enable compute.googleapis.com --project=$PROJECT_ID
```

### 3.2 Provision Artifact Registry & Push Container Image

#### Step 1: Verify or Create the Repository

Check if your target repository exists in the specified region:

```pwsh
gcloud artifacts repositories list --location=$REGION --project=$PROJECT_ID
```

If the repository does not exist, provision it using Docker format:

```pwsh
gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION `
  --description="a-description-of-your-container-repository" `
  --project=$PROJECT_ID
```

#### Step 2: Build and Push the Container

Authenticate your local Docker daemon with the remote registry, then build the target image for an `amd64` architecture. Run these commands from the root directory of your monorepo:

```pwsh
# Authenticate Docker CLI with Google Artifact Registry
gcloud auth configure-docker "\$REGION-docker.pkg.dev"

# Build, tag, and push the multi-platform container image
docker buildx build `
  --progress=plain `
  --platform linux/amd64 `
  --file apps/api/Dockerfile `
  --tag \$IMAGE `
  --push `
  .
```

> [!IMPORTANT]
> Ensure that the Cloud Run Runtime Service Account (`$RUNTIME_SA`) retains its configured read/pull access permissions to this Artifact Registry repository.

### 3.3 Deploy with Direct Cloud Run Ingress (Cost-Optimized)

For architectures omitting a load balancer, configure ingress to accept all external requests. This approach leaves the endpoint public to the internet, relying on the application layer (**NestJS Service-Token Guard**) for authorization.

#### Step 1: Provision the Runtime Service Account

Create the dedicated identity that the Cloud Run container will assume at runtime to interact with downstream Google Cloud resources.

> [!NOTE]
> If you already created this identity during the early environment setup stage, skip this specific command.

```pwsh
gcloud iam service-accounts create "runtime-service-account-name (e.g., web-api)" `
  --display-name="Web API Runtime" `
  --project=$PROJECT_ID
```

#### Step 2: Create the Secret and Upload the Public Key PEM

> [!IMPORTANT]
> **Asymmetric Key Security Best Practice**
>
> - **Public Key Only:** Only provision the public key (`nest-api-public.pem`) to Google Cloud.
> - **Private Key Isolation:** The matching **private key** must remain strictly on your Next.js frontend server. **Never** upload the private key to Google Cloud or bundle it with the API container.
> - **Why Secret Manager?** While public keys are not strictly confidential, storing them in Secret Manager provides a clean way to manage multiline PEM blocks and control cryptographic key relations via explicit versioning.

Initialize a new container in Secret Manager and seed it with your local multiline public key file.

```pwsh
# 1. Initialize the secret resource
gcloud secrets create "your-secret-key-public-name" `
  --replication-policy=automatic `
  --project=$PROJECT_ID

# 2. Add the local PEM file as Version 1
gcloud secrets versions add "your-secret-key-public-name" `
  --data-file="your-local-multiline-public-key-file.pem" `
  --project=$PROJECT_ID
```

#### Step 3: Grant Access Permissions (IAM Binding)

Authorize your Cloud Run runtime service account to read the secret data payload. Without this explicit role binding, your container instance will crash on startup with a permission error.

```pwsh
gcloud secrets add-iam-policy-binding "your-secret-key-public-name" `
  --project=$PROJECT_ID `
  --member="serviceAccount:$RUNTIME_SA" `
  --role="roles/secretmanager.secretAccessor"
```

> [!NOTE]
> Cloud Run resolves secret values securely during instance startup. Always pin your development to an explicit secret version (e.g., `:1`). Avoid using `:latest` in production to prevent unintended runtime configuration shifts when rotating keys.

#### Step 4: Define Secret Architecture Variables

Map the application layer to the exact identifier and version of the signing key stored in the Secret Manager:

```pwsh
$PUBLIC_KEY_SECRET = "secret-key-public-name"
$PUBLIC_KEY_VERSION = "1"
```

#### Step 5: Execute Cloud Run Deployment

```pwsh
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --port 8080 `
  --service-account $RUNTIME_SA `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets "NEST_API_SIGNING_PUBLIC_KEY=$PUBLIC_KEY_SECRET`:\$PUBLIC_KEY_VERSION" `
  --allow-unauthenticated `
  --project $PROJECT_ID
```

### Security & Authentication Considerations

- **The Purpose of `--allow-unauthenticated`:** This flag allows raw internet traffic to reach your NestJS instance without requiring native Google IAM credentials. It **does not** mean your application is open. It offloads routing verification entirely to your NestJS service-token guard.
- **External Integration Restraints:** If you omit `--allow-unauthenticated`, external hosting providers, such as Vercel, cannot communicate with your API using standard JWTs alone. They would be forced to authenticate through a complex Google Identity Token OAuth flow.
- **Verify Current IAM Policies:** If you need to inspect the current access control layer on your deployed service, execute:

  ```pwsh
  gcloud run services get-iam-policy $SERVICE `
    --region $REGION `
    --project $PROJECT_ID
  ```

- **Defense in Depth:** Granting unauthenticated public access automatically adds the `allUsers` entity to the Cloud Run Invoker role. To keep your application secure, ensure your NestJS codebase maintains strict input validation, active rate limiting, and robust guard middleware.

## Option A: Use Cloud Run Directly, Without a Load Balancer

This setup is ideal for low-traffic portfolio sites, minimizing cloud spending by routing traffic directly to the native Cloud Run endpoint without an upstream load balancer.

### Configure Ingress Controls

Modify the networking layer to accept public requests. This command updates the network interface of an existing deployment without rebuilding or redeploying the underlying container image.

> [!NOTE]
> The `ingress all` flag opens the Cloud Run service endpoint to the public internet. It changes network routing only. It does not alter your Google IAM access policies or bypass the NestJS application-level authentication guard.

```pwsh
gcloud run services update $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --ingress all
```

### Retrieve Endpoint & Configure Frontend Environment

#### Step 1: Extract the Canonical URL

Query the Google Cloud API to extract the unique, system-generated URL for your service:

```pwsh
# Fetch and print the active service url
$API_URL = gcloud run services describe $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --format "value(status.url)"

$API_URL
```

#### Step 2: Bind Endpoint to Frontend (Vercel)

Update your production environment variables to bridge your frontend and backend infrastructure:

1. Navigate to your frontend project dashboard: **Settings → Environment Variables**.
2. Provision a new variable scoped strictly to the **Production** environment:
   1. **Key:** `NEST_API_BASE_URL`
   2. **Value:** `https://<your-cloud-run-service-url>.run.app`
3. **Critical Security Isolation:** Ensure the token-signing private key remains locked in a server-side environment variable. **Do not** apply a `NEXT_PUBLIC_` prefix, which exposes strings to the client browser bundle.
4. **Trigger a Redeployment:** Re-build your frontend project. Environment variable updates take effect only on new compilation pipelines.

### Validate Service Configuration & Connection Endpoints

Execute runtime integration checks to verify both network ingress settings and application security layers.

#### Step 1: Inspect Deployment metadata

Verify the active networking annotations and manifest configurations:

```pwsh
gcloud run services describe $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --format "yaml(status.url,metadata.annotations,spec.template.metadata.annotations)"
```

_Confirm that the service ingress annotation reads `all`._

#### Step 2: Test network & Guard Responses

Send an unauthenticated test request to a protected API endpoint using curl:

```pwsh
curl.exe -i "$API_URL/api/v1"
```

**Expected Response Codes**

- **`401 Unauthorized` (Expected):** The network path is open, and the application-layer NestJS guard successfully intercepted and rejected the unauthenticated request.
- **`401 Forbidden` (Error State):** The request was blocked before reaching NestJS. This indicates that the Cloud Run IAM policy is misconfigured and still requires native Google Identity authentication.

#### Step 3: Monitor Server Logs

If frontend queries fail after updating variables, read the latest container `stdout/stderr` streams to diagnose the failure:

```pwsh
gcloud run services logs read $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --limit 100
```

### Vercel-Managed DNS Adjustments

When leveraging the direct `run.app` endpoint, the frontend bypasses custom domain routing for API paths. If you are migrating away from a load-balanced architecture, clean up your DNS zone records carefully:

- Update the `NEST_API_BASE_URL` in Vercel and complete a production deployment **before** altering DNS settings.
- Once the site is verified, navigate to your DNS dashboard and safely remove the specific `api` record pointing to the load balancer IP.
- **Do not alter or delete** the apex (`@`) or `www` records powering your primary portfolio domain.

### Security, Reliability, and Cost Safeguards

Before this architecture leaves the backend network endpoint public, implement a defense-in-depth strategy:

#### Cryptographic Isolation

- Enforce signed service-token checks on every private API route.
- Restrict the private signing key exclusively to server-side frontend runtimes. Verify issuer, audience, signatures, and expirations strictly on the backend via the Secret Manager-backed public key.

#### Application Hardening

- Validate all incoming request schemas aggressively.
- Suppress detailed language stack traces or internal environment variables in production error payloads.

#### Cost & Scaling Control

- **Scale-to-Zero:** Set your minimum instance count (`--min-instances`) to `0` to eliminate compute charges during idle windows if cold starts are acceptable.
- **Concurrency Ceilings:** Set a conservative maximum instance count (`--max-instance`) to protect your wallet against unexpected traffic spikes or denial-of-wallet loops.
- **Proactive Alerts:** Implement Google Cloud Budget Alerts. Note that budget notifications act as monitoring alerts. They do not place a hard freeze on resource consumption.

## Option B: Recreate the Google Cloud Load Balancer

Choose this architecture if your deployment requires a custom API domain, Google Cloud Armor security policies, or private network controls that restrict direct public access to the default `run.app` endpoint.

> [!Note]
> By default, the load balancer is public-facing. It does not natively restrict incoming traffic to specific origins, such as Vercel, unless you explicitly configure access controls.

### Prerequisites & Initialization

The target Cloud Run service must reside in the same region as your serverless Network Endpoint Group (NEG). For this deployment, the designated region is `europe-west1`.

#### 1. Verify the Cloud Run Service Configuration

Execute the following command to retrieve the service status, endpoint URL, and metadata annotations:

```pwsh
gcloud run services describe $SERVICE `
   --region $REGION `
   --project $PROJECT_ID `
   --format "yaml(status.url,metadata.annotations)"
```

#### 2. Configure Ingress Controls

- Keep the Cloud Run ingress setting configured to `all` during the initial setup and verification phases.
- Restrict the ingress setting to `internal-and-cloud-load-balancing` only after validating that the load balancer routes traffic successfully.

### Stage 1: Provision a Static Global IP Address

Allocate a static, global IPv4 address to serve as the entry point for the Application Load Balancer, and capture the allocated address for subsequent configuration steps.

```pwsh
# Define the resource name for the IP address
$LB_IP_NAME = "<YOUR_LB_IP_NAME>"               # e.g., web-api-ip

# Create the global IPv4 address resource
gcloud compute addresses create $LB_IP_NAME `
   --global `
   --ip-version IPv4 `
   --project $PROJECT_ID

# Retrieve and display the provisioned IP address
$LB_IP = gcloud compute addresses describe $LB_IP_NAME `
            --global `
            --project $PROJECT_ID `
            --format="get(address)"

$LB_IP
```

### Stage 2: Configure DNS Routing in Vercel

Add an `A` record to your Vercel DNS configuration for `yourdomain.com` using the following values

| **Type** | **Name** | **Value**               |
| -------- | -------- | ----------------------- |
| A        | `api`    | \*The value of `$LB_IP` |

> [!IMPORTANT]
> Do not modify or delete existing root domain (`@`) or `www` records.

#### Verify DNS Resolution

Before proceeding with Google-managed certificate provisioning, verify that the new record resolves correctly to your load balancer IP:

```pwsh
Resolve-DnsName $API_DOMAIN
```

### Stage 3: Provision Serverless NEG and Global Backend Service

#### 1. Define Environment Variables

Initialize the configuration variables required for the load balancer infrastructure:

```pwsh
$NEG_NAME = "<neg-name>"
$BACKEND_NAME = "<backend-name>"
$URL_MAP_NAME = "<url-map-name>"
$CERT_NAME = "<cert-name>"
$HTTPS_PROXY_NAME = "<https-proxy-name>"
$HTTPS_RULE_NAME = "<https-rule-name>"
```

#### 2. Create the Network Endpoint Group (NEG)

Create a serverless NEG. Ensure this resource is deployed to the **same region** as your Cloud Run service:

```pwsh
gcloud compute network-endpoint-groups create $NEG_NAME `
  --region $REGION `
  --network-endpoint-type serverless `
  --cloud-run-service $SERVICE `
  --project $PROJECT_ID
```

#### 3. Configure the Backend Service

Create a global, externally managed HTTP backend service and attach your serverless NEG to it:

```pwsh
# Create the global backend service
gcloud compute backend-services create $BACKEND_NAME `
  --global `
  --load-balancing-scheme EXTERNAL_MANAGED `
  --project $PROJECT_ID

# Attach the serverless NEG to the backend service
gcloud compute backend-services add-backend $BACKEND_NAME `
  --global `
  --network-endpoint-group $NEG_NAME `
  --network-endpoint-group-region $REGION `
  --project $PROJECT_ID
```

### Stage 4: Deploy URL Map and SSL Certificate

#### 1. Create the URL Map

Define the global routing structure by mapping incoming requests to your default backend service:

```pwsh
gcloud compute url-maps create $URL_MAP_NAME `
  --default-service $BACKEND_NAME `
  --project $PROJECT_ID
```

#### 2. Generate a Google-Managed SSL Certificate

Provision a Compute Engine Google-managed SSL certificate to handle secure traffic for your API domain.

```pwsh
gcloud compute ssl-certificates create $CERT_NAME `
  --domains $API_DOMAIN `
  --global `
  --project $PROJECT_ID
```

### Stage 5: Establish Target HTTPS Proxy and Forwarding Rule

#### 1. Create the Target HTTPS Proxy

Link your URL map and managed SSL certificate to an HTTPS proxy:

```pwsh
gcloud compute target-https-proxies create $HTTPS_PROXY_NAME `
  --url-map $URL_MAP_NAME `
  --ssl-certificates $CERT_NAME `
  --global `
  --project $PROJECT_ID
```

#### 2. Create the Forwarding Rule

Direct external traffic from your reserved IP address on port 443 to the target HTTPS proxy:

```pwsh
gcloud compute forwarding-rules create $HTTPS_RULE_NAME `
  --load-balancing-scheme EXTERNAL_MANAGED `
  --network-tier PREMIUM `
  --address $LB_IP_NAME `
  --global `
  --target-https-proxy $HTTPS_PROXY_NAME `
  --ports 443 `
  --project $PROJECT_ID
```

> [!TIP]
> If you deploy an optional HTTP-to-HTTPS redirect, it will provision three additional resources: a global
> HTTP forwarding rule, a target HTTP proxy, and a redirect URL map. Note their exact resource names during
> setup so they can be completely removed during teardown.

### Stage 6: Provision Certificates, Test Routing, and Restrict Ingress

#### 1. Monitor SSL Certificate Provisioning

Google-managed certificates can take up to several hours to provision. Run the following command to check
the provision and domain validation status:

```pwsh
gcloud compute ssl-certificates describe $CERT_NAME `
  --global `
  --project $PROJECT_ID `
  --format "yaml(managed.status,managed.domainStatus)"
```

Ensure both the certificate status and domain status read `ACTIVE` before moving forward.

> [!NOTE]
> `FAILED_NOT_INVISIBLE`: If the status remains failed or invisible, verify that your Vercel DNS `A` record
> accurately resolves to your reserved load-balancer IP, and double-check your HTTPS proxy and forwarding rule
> configurations. It may take up to 24 hours for the DNS changes to propagate globally and for Google to successfully
> provision the managed SSL certificate.

#### 2. Validate Public Routing

Test the API endpoint via your custom domain to ensure traffic successfully routes through the load balancer:

```pwsh
curl.exe -i "https://$API_DOMAIN/api/v1"
```

**Expected Result:** The unauthenticated request should successfully reach your NestJS application and be rejected
by your global auth guard (returning a `401 Unauthorized` or `403 Forbidden` response).

#### 3. Restrict Cloud Run Ingress

Once you confirm the load-balancer path works and signed requests resolve cleanly, lock down the Cloud Run service
so it no longer accepts direct public traffic:

```pwsh
gcloud run services update $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --ingress internal-and-cloud-load-balancing
```

> [!NOTE]
> This setting instantly blocks all direct, public internet traffic targeting the default `*.run.app` URL. The service
> remains accessible _only_ via your external load balancer or internal VPC networks.

#### 4. Update and Redeploy the Vercel Frontend

Point your frontend application to the new custom API domain by updating your production environment variables in Vercel.

Set the following key in your Vercel project environment variables:

```pwsh
NEST_API_BASE_URL=https://yourdomain.com
```

Trigger a new Vercel production and verify that frontend requests successfully route through the load balancer and
authenticate with the backend.

## E. Safely Remove the Load Balancer and Revert to Direct Routing (`run.app`)

> [!IMPORTANT]
> To prevent application downtime, **re-route and validate frontend traffic to the direct service URL before destroying any load balancer resources**.

### 1. Point Vercel to Cloud Run Directly

#### 1.1. Retrieve the Cloud Run Service URL

Extract the default public endpoint URL assigned to your Cloud Run service:

```pwsh
$API_URL = gcloud run services describe $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --format "value(status.url)"

# Print the URL value
$API_URL
```

#### 1.2. Update Environment Variables and Re-Deploy

Update your Vercel project configuration to bypass the load balancer and establish a direct connection to Cloud Run:

Update the production environment variable value in Vercel:

```pwsh
NEST_API_BASE_URL=<Paste the value of $API_URL here>
```

Trigger a new Vercel production deployment and verify that frontend requests successfully route through the load balancer and
authenticate with the backend.

### 2. Restore Cloud Run Ingress to Public Access

#### 2.1. Open Public Ingress on Cloud Run

To allow the Vercel frontend to reach your service directly, restore the Cloud Run ingress configuration to accept all incoming traffic:

```pwsh
gcloud run services update $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --ingress all
```

#### 2.2. Confirm Ingress Policy Updates

Verify that the ingress annotation update has been successfully applied to the service:

```pwsh
gcloud run services describe $SERVICE `
  --region $REGION `
  --project $PROJECT_ID `
  --format "yaml(metadata.annotations)"
```

**Expected Output**: Confirm that the metadata reflects the open routing rule:

```yml
run.googleapis.com/ingress: all
```

#### 2.3. Validate Public Traffic Ingestion

Test the direct `run.app` endpoint to ensure the routing rules and security mechanisms are functioning out-of-band
of the load balancer:

1. Send an unauthenticated request directly to the Cloud Run service URL using `curl`. The NestJS guard should catch and reject the request.
2. Complete an action inside your newly redeployed Vercel frontend application to ensure your production signed requests successfully connect and authenticate against the backend.

### 3. Deprecate the Load Balancer DNS Record in Vercel

Once you confirm your Vercel production application successfully routes traffic directly the `run.app` endpoint, \*\*remove the obsolete `api` A record from your Vercel DNS settings` to prevent dangling DNS entries.

> [!WARNING]
>
> - **Do not modify or delete** your root/apex (`@`) or `www` DNS records.
> - If another project or application shares the `api.yourdomain.com` subdomain, **retain or update** the record instead of deleting it.

### 4. Identify the Actual Load-Balancer Resources

**Identify and inspect your specific load balancer resources before attempting deletion**. Blanket deletions or guessing resource names can cause accidental downtime for unrelated services.

Run the following commands to map out your infrastructure:

```pwsh
# list global forwarding rules and their targets
gcloud compute forward-rules list `
  --global `
  --project $PROJECT_ID `
  --format "table(name,IPAddress,target)"

# list target HTTPS proxies, associated URL maps, and SSL certificates
gcloud compute target-https-proxies list `
  --global `
  --project $PROJECT_ID `
  --format "table(name,urlMap,sslCertificates)"

# list target HTTP proxies and their associated URL maps
gcloud compute target-http-proxies list `
  --global `
  --project $PROJECT_ID `
  --format "table(name,urlMap)"

# list URL maps and their default backend services
gcloud compute url-maps list `
  --global `
  --project $PROJECT_ID `
  --format "table(name,defaultService)"

# list backend services, their schemes, and attached backends
gcloud compute backend-services list `
  --global `
  --project $PROJECT_ID `
  --format "table(name,loadBalancingScheme,backends)"

# list all Network Endpoint Groups (NEGs)
gcloud compute network-endpoint-groups list `
  --project $PROJECT_ID

# list global SSL certificates
gcloud compute ssl-certificates list `
  --global `
  --project $PROJECT_ID

# list global static IP addresses
gcloud compute addresses list `
  --global `
  --project $PROJECT_ID
```

> [!WARNING]
> Carefully evaluate the relationships between your targets, URL maps, backends, NEGs, certificates, and IP addresses. **Do not delete any resource that is shared by another active service**.

### 5. Tear Down the API Load Balancer Resources

**Delete the load balancer resources in sequential order to satisfy cloud dependency constraints**. Deleting resources out of order will result in command errors.

#### Step 1: Define Resource Environment Variables

Populate the environment variables below with the exact resource names identified during the [inspection phase](#4-identify-the-actual-load-balancer-resources):

```pwsh
$HTTPS_RULE_NAME = "<https-forwarding-rule-name>"
$HTTP_RULE_NAME = "<http-forwarding-rule-name-if-present>"

$HTTPS_PROXY_NAME = "<https-proxy-name>"
$HTTP_PROXY_NAME = "<http-proxy-name-if-present>"

$URL_MAP_NAME = "<url-map-name>"
$BACKEND_NAME = "<backend-service-name>"

$NEG_NAME = "<serverless-neg-name>"
$CERT_NAME = "<ssl-certificate-name>"

# retrieve from (#stage-1-provision-a-static-global-ip-address)
$LB_IP_NAME = "<global-static-address-name>"
```

#### Step 2: Remove Entrypoints (Forwarding Rules)

Remove the frontend configuration first to stop incoming traffic routing

```pwsh
# delete the primary https routing rule
gcloud compute forwarding-rules delete $HTTPS_RULE_NAME `
  --global `
  --project $PROJECT_ID

# delete the http redirect rule (if configured)
gcloud compute forwarding-rules delete $HTTP_RULE_NAME `
  --global `
  --project $PROJECT_ID
```

#### Step 3: Remove Target Proxies

With traffic stopped, remove the internal proxies that pass requests to your URL maps.

```pwsh
# delete the https target proxy
gcloud compute target-https-proxies delete $HTTPS_PROXY_NAME `
  --global `
  --project $PROJECT_ID

# delete the http target proxy (if configured)
gcloud compute target-http-proxies delete $HTTP_PROXY_NAME `
  --global `
  --project $PROJECT_ID
```

#### Step 4: Delete Routing Maps and Backend Services

Delete the URL map, the underlying backend service, and its network endpoint group (NEG).

```pwsh
# remove routing maps
gcloud compute url-maps delete $URL_MAP_NAME `
  --global `
  --project $PROJECT_ID

# remove core backend capabilities
gcloud compute backend-services delete $BACKEND_NAME `
  --global `
  --project $PROJECT_ID

# remove the regional serverless infrastructure mapping
gcloud compute network-endpoint-groups delete $NEG_NAME `
  --region $REGION `
  --project $PROJECT_ID
```

#### Step 5: Clean Up Certificates and Static IPs

Once all dependent traffic objects are removed, release your security and networking identifiers to stop billing charges.

```pwsh
# delete the compute engine ssl certificate
gcloud compute ssl-certificates delete $CERT_NAME `
  --global `
  --project $PROJECT_ID

# release the global static ip address back to the pool
gcloud compute addresses delete $LB_IP_NAME `
  --global `
  --project $PROJECT_ID
```

> [!NOTE]
> **Using Certificate Manager?**
>
> If your project utilizes Certificate Manager instead of classic Compute Engine SSL certificates, resources follow an
> independent lifecycle. You must detach and remove your certificate map entries, clear map references from your proxies,
> and delete the maps before you can successfully purge the underlying certificates. Refer to the [Google Cloud Certificate
> Manager Cleanup Guide](https://docs.cloud.google.com/certificate-manager/docs/deploy-google-managed-lb-auth) for explicit
> step-by-step decoupling instructions.

### 6. Verify Resource Cleanup

**Confirm that all load balancer components have been successfully removed**. Run the following verification commands to ensure no
orphan components remain in your project, which helps prevent unexpected cloud billing.

```pwsh
# verify all forwarding rules are removed
gcloud compute forwarding-rules list --global --project $PROJECT_ID

# verify all target HTTPS proxies are removed
gcloud compute target-https-proxies list --global --project $PROJECT_ID

# verify all URL maps are removed
gcloud compute url-maps list --global --project $PROJECT_ID

# verify all backend services are removed
gcloud compute backend-services list --global --project $PROJECT_ID

# verify the network endpoint groups (NEGs) are removed
gcloud compute network-endpoint-groups list --project $PROJECT_ID

# verify the legacy SSL certificates are removed
gcloud compute ssl-certificates list --global --project $PROJECT_ID

# verify the global static IP addresses are released
gcloud compute addresses list --global --project $PROJECT_ID
```

> [!NOTE]
> This teardown procedure targets **networking infrastructure only**. To maintain API data integrity and prevent service
> disruption, ensure the following core resources remain intact and or **not** modified or deleted during this cleanup:
>
> - The core **Cloud Run service** and its runtime environment.
> - The assigned **Runtime Service Account** (IAM identity).
> - The **Artifact Registry repository** hosting your container images.
> - The **Secret Manager signing key** (`signing-key`) used by the application

## F. Architecture and Operational Notes

### Architecture Option A: Direct Cloud Run (No Load Balancer)

This lean blueprint bypasses a proxy layer, routing traffic directly to the serverless container endpoint.

- **Endpoint Exposure**: The default `run.app` URL serves as a public ingress point.
- **Ingress configuration**: Network-level ingress must be set to `all` to accommodate public internet traffic.
- **Identity & Access Management (IAM)**: Core Google Cloud IAM policies handle basic transport-level invocation checks before forwarding payloads to the NestJS runtime.
- **Application Authentication**: A dedicated NestJS service-token guard handles granular API authorization.
- **Token Issuance**: The private signing key resides exclusively in the server-side Vercel environment to securely mint request tokens.
- **Validation Layer**: The API actively validates short-lived, incoming tokens and immediately drops unauthorized requests.

#### Trade-Offs

Minimizes operational complexity and entirely **eliminates the recurring base hourly charges** tied to cloud forwarding rules. However, it offers no native network-level shielding to isolate the application from direct scanner probes targeting the `run.app` domain.

### Architecture Option B: Proxy-Routed via External Load Balancer

This enterprise-ready blueprint encapsulates the serverless container behind a managed proxy gateway to provide unified traffic governance.

- **Edge Capabilities**: An External Application Load Balancer enables native custom domain routing and pairs seamlessly with Google Cloud Armor for automated DDoS shielding and rate-limiting.
- **Ingress Configuration**: cloud Run networking ingress is restricted to `internal-and-cloud-load-balancing`.
- **Perimeter Security**: Google Cloud drops any requests attempting to contact the default `run.app` endpoint directly from the public internet, forcing all web traffic through the proxy edge.
- **Network Isolation Constraints**: While the container is shielded, the load balancer's frontend IP remains broadly visible to the internet unless coupled with egress traffic restrictions (such as static allowlists).
- **Cost Profile**: Introduces a multi-resource footprint that incurs continuous provisioning costs regardless of underlying system volume.

> [!NOTE]
> Implementing a custom DNS name or configuring restrictive CORS policies does not secure an API endpoint. You must retain your application-level token guard across both architectural implementations.

## G. Reference Documentation

- [Cloud Run ingress controls](https://docs.cloud.google.com/run/docs/securing/ingress)
- [Set up a global external Application Load Balancer with a Cloud Run backend](https://docs.cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless)
- [Clean up a load-balancing setup](https://docs.cloud.google.com/load-balancing/docs/cleaning-up-lb-setup)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Load Balancing pricing](https://cloud.google.com/load-balancing/pricing)
- [Vercel DNS records](https://vercel.com/docs/domains/managing-dns-records)
