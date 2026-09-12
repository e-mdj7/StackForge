# Catalog entries

Plain-text plan of what the catalog covers. **In** = shipped in `src/catalog/*.json`.
**Planned** = not written yet, add when wanted. One JSON object per entry, no code changes needed.

Adding an entry: open the group's JSON, copy a neighbour, change the fields.
Adding a whole new box: add it to `groups.json` (with its `sections`), create `<id>.json`,
then add two lines to `src/catalog/index.ts`. `pnpm check` fails loudly if a section name,
link target or capability is misspelled.

**Total in: 349**

---

## language — Languages & Runtimes (17)
- **In** — Languages: JavaScript, Python, Go, Rust, Java, Kotlin, C#/.NET, PHP, Ruby, Elixir, Swift, Dart
- **In** — JS Runtimes: Node.js, Bun, Deno
- **In** — Type layer: TypeScript, SQL
- **Planned**: C, C++, Scala, Zig, Lua, R, Julia, Perl, Haskell, OCaml, Clojure, Groovy, WebAssembly

## frontend — Frontend (46)
- **In** — Build & Bundler: Vite, Webpack, Rspack, esbuild, Rollup, Turbopack
- **In** — Framework: React, Vue, Svelte, Angular, Solid, Preact, Qwik, htmx, Alpine.js
- **In** — Meta-framework: Next.js, Nuxt, SvelteKit, React Router/Remix, Astro
- **In** — UI & Components: shadcn/ui, MUI, Chakra UI, Ant Design, Radix UI, Headless UI, HeroUI, Mantine, Bootstrap
- **In** — Styling: Tailwind CSS, UnoCSS, Sass, styled-components, Emotion, CSS Modules
- **In** — State & Data: Redux Toolkit, Zustand, Jotai, MobX, Pinia, TanStack Query, SWR, Apollo Client
- **In** — Routing: React Router, TanStack Router, Vue Router
- **Planned**: Gatsby, Ember, Lit, Stencil, Panda CSS, vanilla-extract, Valtio, XState, Effector, urql, Relay, React Hook Form, Zod, TanStack Table, AG Grid, TipTap, Monaco, PWA/Workbox, i18next

## mobile — Mobile & Desktop (14)
- **In** — Cross-platform: React Native, Flutter, Expo, Ionic, Capacitor, Kotlin Multiplatform
- **In** — Native: SwiftUI, Jetpack Compose
- **In** — Desktop: Electron, Tauri, .NET MAUI
- **In** — Distribution: Fastlane, App Store Connect, Google Play Console
- **Planned**: NativeScript, Unity, Godot, Qt, Wails, Compose Multiplatform, Firebase App Distribution, Sentry Mobile, RevenueCat, OneSignal

## backend — Backend & API (30)
- **In** — Framework: Express, Fastify, NestJS, Hono, Django, FastAPI, Flask, Laravel, Rails, Spring Boot, Gin, ASP.NET Core, Phoenix
- **In** — API layer: GraphQL, tRPC, OpenAPI/Swagger, gRPC
- **In** — Platform (BaaS): Firebase, Supabase, Appwrite, PocketBase, Convex
- **In** — Jobs & Queues: BullMQ, Celery, Sidekiq, Inngest
- **In** — Realtime: Socket.IO, Pusher, Ably, Liveblocks
- **Planned**: Koa, AdonisJS, Encore, Axum, Actix, Fiber, Echo, Quarkus, Micronaut, Symfony, Litestar, Strapi, Directus, Sanity, Contentful, Payload, WordPress, Hasura, PostGraphile, Apollo Server, GraphQL Yoga, Kong, Tyk, Traefik, Centrifugo, LiveKit

## auth — Auth & Identity (15)
- **In** — Hosted: Auth0, Clerk, Okta, WorkOS, AWS Cognito, Stytch
- **In** — Self-hosted: Auth.js/NextAuth, Keycloak, SuperTokens, Lucia, Ory
- **In** — Protocols: OAuth 2.0/OIDC, SAML, JWT, Passkeys/WebAuthn
- **Planned**: Zitadel, Kinde, Descope, FusionAuth, Better Auth, Casbin, OpenFGA, SCIM, LDAP/Active Directory

## data — Data & Storage (41)
- **In** — Relational: PostgreSQL, MySQL, SQLite, MariaDB, SQL Server, CockroachDB, Neon, PlanetScale, Turso
- **In** — NoSQL & Document: MongoDB, DynamoDB, Cassandra, CouchDB
- **In** — Cache & KV: Redis, Valkey, Memcached, Upstash
- **In** — Search: Elasticsearch, Meilisearch, Typesense, Algolia
- **In** — ORM & Query: Prisma, Drizzle, TypeORM, Kysely, SQLAlchemy
- **In** — Warehouse & Lake: Snowflake, BigQuery, Databricks, ClickHouse, DuckDB, dbt
- **In** — Vector: pgvector, Pinecone, Qdrant, Weaviate, Chroma
- **In** — Object storage: S3, Cloudflare R2, MinIO, Cloud Storage
- **Planned**: Oracle DB, Neo4j, SurrealDB, InfluxDB, TimescaleDB, QuestDB, ScyllaDB, EdgeDB, Firestore (standalone), Supabase Storage, Azure Blob, Backblaze B2, Sequelize, Knex, Mongoose, Alembic, Flyway, Liquibase, Iceberg, Delta Lake, OpenSearch, Milvus, LanceDB

## ai — AI & LLM (26)
- **In** — Model providers: Anthropic Claude, OpenAI, Google Gemini, Mistral, Groq, AWS Bedrock
- **In** — Local & Open: Ollama, vLLM, Hugging Face, llama.cpp
- **In** — Frameworks: LangChain, LlamaIndex, Vercel AI SDK, Pydantic AI, Model Context Protocol
- **In** — Coding agents: Claude Code, Cursor, GitHub Copilot, Aider
- **In** — RAG & Retrieval: NotebookLM, Firecrawl, Unstructured
- **In** — Ops & Eval: Langfuse, LangSmith, Braintrust, Weights & Biases
- **Planned**: Cohere, Perplexity API, Together, Fireworks, Replicate, OpenRouter, DeepSeek, Azure OpenAI, LM Studio, CrewAI, AutoGen, LangGraph, DSPy, Semantic Kernel, Haystack, Instructor, Guardrails, Ragas, Helicone, Portkey, Windsurf, Cline, Continue, Devin, PyTorch, TensorFlow, scikit-learn, MLflow, Kubeflow, BentoML

## automation — Automation & Pipelines (17)
- **In** — Workflow automation: n8n, Zapier, Make, Windmill
- **In** — Data pipelines: Airflow, Dagster, Prefect, Airbyte, Fivetran, Spark
- **In** — Messaging & Events: Kafka, RabbitMQ, NATS, Amazon SQS
- **In** — Scheduling: Temporal, Trigger.dev, cron
- **Planned**: Activepieces, Pipedream, Node-RED, Huginn, Mage, Meltano, Dlt, Flink, Beam, Redpanda, Pulsar, ActiveMQ, EventBridge, Google Pub/Sub, Celery Beat, Quartz, Restate

## testing — Testing & Quality (18)
- **In** — Unit: Vitest, Jest, pytest, JUnit, RSpec
- **In** — Component: Testing Library, Storybook
- **In** — End-to-end: Playwright, Cypress, Selenium
- **In** — Lint & Format: ESLint, Prettier, Biome, Oxlint, Ruff
- **In** — Load & Contract: k6, Locust, Pact
- **Planned**: Mocha, Jasmine, AVA, Karma, Puppeteer, WebdriverIO, Appium, Maestro, Detox, MSW, Faker, Chromatic, Percy, Applitools, Stryker (mutation), Hypothesis, JMeter, Gatling, Artillery, Schemathesis, SonarQube, Codecov, Semgrep, Snyk, Dependabot, Renovate, Trivy, OWASP ZAP, axe-core, Lighthouse CI, commitlint, Husky, lint-staged

## devops — DevOps & Infra (37)
- **In** — Package managers: pnpm, npm, Yarn, uv, Poetry
- **In** — Containers: Docker, Podman, Docker Compose
- **In** — Orchestration: Kubernetes, Helm, Argo CD
- **In** — CI/CD: GitHub Actions, GitLab CI, Jenkins, CircleCI
- **In** — Infra as Code: Terraform, OpenTofu, Pulumi, Ansible
- **In** — Hosting & PaaS: Vercel, Netlify, Railway, Render, Fly.io, Coolify
- **In** — Cloud providers: AWS, Google Cloud, Azure, Hetzner, DigitalOcean
- **In** — Edge & CDN: Cloudflare, Fastly, NGINX, Caddy
- **In** — Secrets: HashiCorp Vault, Doppler, Infisical
- **Planned**: Bun/Deno as package managers, pip, Conda, Cargo, Maven, Gradle, NuGet, Composer, Homebrew, Nix, Turborepo, Nx, Lerna, Bazel, Buildkite, Drone, Woodpecker, Tekton, Spinnaker, Flux CD, Nomad, ECS, Cloud Run, Lambda, Vercel Functions, Deno Deploy, Heroku, Dokku, CapRover, Portainer, Traefik, HAProxy, Envoy, Consul, Cloudflare Tunnel, Tailscale, 1Password, AWS Secrets Manager, SOPS, Bitwarden, Packer, Vagrant

## observability — Observability (14)
- **In** — Errors: Sentry, Rollbar, Bugsnag
- **In** — Metrics & Dashboards: Prometheus, Grafana, Datadog, New Relic
- **In** — Logs & Tracing: OpenTelemetry, Jaeger, Grafana Loki, Axiom
- **In** — Uptime: Better Stack, UptimeRobot, Healthchecks.io
- **Planned**: Honeycomb, Lightstep, Dynatrace, AppSignal, Elastic APM, Graylog, Papertrail, Signoz, VictoriaMetrics, Tempo, Zipkin, PagerDuty, Opsgenie, Statuspage, Checkly, Cronitor, Highlight, LogRocket, FullStory

## analytics — Analytics & BI (20)
- **In** — Product analytics: PostHog, Mixpanel, Amplitude
- **In** — Web analytics: Google Analytics, Plausible, Umami, Matomo
- **In** — BI & Dashboards: Power BI, Tableau, Looker, Metabase, Apache Superset
- **In** — Charting libraries: Recharts, Chart.js, D3.js, ECharts, Plotly, visx
- **In** — Event pipelines: Segment, RudderStack
- **Planned**: Heap, Pendo, Hotjar, Fathom, Simple Analytics, Cloudflare Web Analytics, Google Data Studio/Looker Studio, Sigma, Hex, Preset, Redash, Lightdash, Evidence, Observable, Nivo, ApexCharts, Victory, Highcharts, AG Charts, Vega-Lite, deck.gl, Mapbox, Leaflet, Snowplow, Jitsu, Firebase Analytics

## design — Design & UI (14)
- **In** — Design tools: Figma, Penpot, Framer, Excalidraw
- **In** — Component systems: Style Dictionary, React Aria
- **In** — Icons & Assets: Lucide, Simple Icons, Heroicons, Font Awesome, Google Fonts
- **In** — Animation: Motion, GSAP, Lottie
- **Planned**: Sketch, Adobe XD, InVision, Zeplin, Miro, FigJam, tldraw, Whimsical, Storybook Design Tokens, Tokens Studio, Supernova, Zeroheight, Phosphor Icons, Tabler Icons, Iconify, Remix Icon, Fontsource, Adobe Fonts, React Spring, AutoAnimate, Rive, Three.js, React Three Fiber, Spline

## pm — Project & Collaboration (20)
- **In** — Issue tracking: Jira, Linear, Asana, ClickUp, GitHub Issues & Projects, Trello
- **In** — Docs & Knowledge: Notion, Confluence, Obsidian, Docusaurus, MkDocs
- **In** — Communication: Slack, Discord, Microsoft Teams, Loom
- **In** — Version control: Git, GitHub, GitLab, Bitbucket, Changesets
- **Planned**: Monday.com, Shortcut, Basecamp, Height, Plane, Redmine, YouTrack, Azure DevOps Boards, Productboard, Aha!, Coda, Craft, Slite, GitBook, ReadMe, Mintlify, Nextra, VitePress, Sphinx, Zoom, Google Meet, Around, Tuple, Gerrit, Gitea, Graphite, Danger, semantic-release, Conventional Commits

## business — Business Systems (21)
- **In** — ERP: SAP, Odoo, NetSuite
- **In** — CRM & Marketing: Salesforce, HubSpot, Pipedrive, Resend, Mailchimp, Customer.io
- **In** — Payments: Stripe, PayPal, Adyen, Lemon Squeezy, Mercado Pago
- **In** — Commerce: Shopify, WooCommerce, Medusa
- **In** — Support: Zendesk, Intercom, Crisp
- **Planned**: Microsoft Dynamics 365, ERPNext, Xero, QuickBooks, Zoho, Attio, Close, Twilio, SendGrid, Postmark, Brevo, Loops, Klaviyo, Braze, Square, Braintrust Payments, Razorpay, Mollie, Checkout.com, Chargebee, Paddle, BigCommerce, Saleor, Vendure, Swell, Freshdesk, Help Scout, Front, Plain, Chatwoot

---

## Rules planned (not yet in `rules.json`)
- Warn when a cache exists but nothing uses it as a queue or session store.
- Warn when a warehouse exists with no ETL tool feeding it.
- Warn when `mobile` is present with no crash reporting.
- Warn when `commerce` is present with no transactional email.
- Warn when `self-hosted` is present with no backup strategy (needs a `backup` capability first).
