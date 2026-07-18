# AriseHash

[![Node.js CI](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**AriseHash** is an open-source AI architecture engine and interactive web sandbox. It transforms raw project ideas into structured Product Requirement Documents (PRDs), interactive Mermaid.js system architecture diagrams, and live, self-healing frontend prototypes rendered directly inside browser sandboxes.

Built for engineers, software architects, and product builders participating in the **Claude Open Source Program** and developer community.

---

## ⚡ Key Highlights

- **Adaptive Context Quizzes to Technical PRDs**: Solicits domain-specific architectural details (stack, target throughput, storage preferences) and drafts technical blueprints with version control.
- **Live Sandpack Browser Runtime**: Instant client-side React 18, Vue, Svelte, and Vanilla JS execution powered by `@codesandbox/sandpack-react`.
- **Real-Time Streaming Code Engine**: Streams code output via Server-Sent Events (SSE) with robust XML parsing for multi-file project structures.
- **Autonomous Error Auto-Fix Loop**: Intercepts Sandpack compilation and runtime errors, feeding contextual stack traces back to LLM providers for hands-free resolution.
- **Resilient AI Failover Gateway**: Configurable multi-provider routing (Claude, OpenAI-compatible APIs) with automated retry and fallback strategies.
- **Atomic Quota Allocation**: Guard against double-spending and race conditions using conditional Prisma SQL updates (`quotaUsedToday`).
- **Bring Your Own Key (BYOK)**: Supports custom OpenAI-compatible and Anthropic endpoints without platform token limits.
- **Production Security & Observability**: Google OAuth token verification, httpOnly JWT cookies, double-submit CSRF defense, and detailed admin audit logs.

---

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client [Browser SPA - React 18 & Vite]
        A["Adaptive Quiz & Input"] --> B["Mermaid.js Visualizer"]
        A --> C["Sandpack Code IDE Sandbox"]
        C --> D["Auto-Fix Error Interceptor"]
    end

    subgraph Server [Express.js Backend & API Gateway]
        E["Auth Guard & CSRF Validator"]
        F["SSE Code Generator Engine"]
        G["Atomic Quota Controller"]
        H["AI Gateway Router"]
    end

    subgraph Storage [Persistence & Cache]
        I[("Neon / Postgres via Prisma")]
        J[("Version Control & Snapshots")]
    end

    Client -->|"Google ID Token / Cookie JWT"| E
    E -->|"Session check"| I
    C -->|"SSE Stream Request"| F
    F -->|"Claim Quota (Atomic)"| G
    G -->|"Database Mutate"| I
    F -->|"Prompt Dispatch"| H
    H -->|"Multi-Model Failover"| AI[("LLM Providers / Claude / BYOK")]
    D -->|"Debounced Stack Trace"| F
    F -->|"Store Blueprint & Version"| J
```

---

## 🛠 Tech Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite, Lucide Icons, Tailwind CSS | High-performance Single Page Application |
| **Browser Sandbox** | `@codesandbox/sandpack-react` | In-browser isolated JS/React compilation runtime |
| **Backend API** | Node.js, Express.js | REST endpoints, SSE streaming pipeline, security middleware |
| **ORM & Database** | Prisma 6, PostgreSQL (Neon / Supabase compatible) | Relational storage for users, blueprints, versions, and quota |
| **Auth & Security** | Google OAuth 2.0, JWT, CSRF Headers, Rate Limiting | Stateless httpOnly authentication & mutation safety |
| **AI Protocol** | Server-Sent Events (SSE), XML `<vcFile>` Parser | Real-time multi-file streaming with error recovery |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`
- **PostgreSQL**: Local instance or cloud database (Neon, Supabase, Aiven)

### 1. Installation

Clone the repository and install all workspace dependencies:

```bash
git clone git@github.com:zennz-hash/arisehash.git
cd arisehash
npm run install:all
```

### 2. Environment Setup

Create environment configuration files for both backend and frontend layers:

```bash
# Server Environment
cp server/.env.example server/.env

# App Environment
cp app/.env.example app/.env
```

Ensure `server/.env` contains your database connection strings and secret tokens:

```env
PORT=4000
DATABASE_URL="postgresql://user:password@localhost:5432/arisehash?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/arisehash?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
AI_GATEWAY_URL="https://api.openai.com/v1"
AI_GATEWAY_KEY="sk-your-ai-key"
```

### 3. Database Migration & Setup

Initialize the Prisma schema and seed default data:

```bash
npm run db:setup
```

### 4. Run Development Server

Launch both Express API (`localhost:4000`) and Vite Dev Server (`localhost:5173`) concurrently:

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Testing & Validation

Run the test suite and database validation checks:

```bash
# Execute backend unit tests
npm test

# Validate Prisma schema consistency
npm run db:validate

# Build frontend production bundle
npm run build
```

---

## 🔐 Security & Architecture Highlights

1. **HttpOnly Session Cookies & Double-Submit CSRF**: Authentication cookies cannot be accessed via client JavaScript (`XSS protection`). Mutations require a valid `X-CSRF-Token` header matching the signed token inside the session cookie.
2. **SSRF-Resistant AI Proxying**: Custom BYOK endpoints strictly enforce HTTPS URL normalization and block private IP address ranges (`127.0.0.1`, `10.0.0.0/8`, `169.254.0.0/16`).
3. **Atomic Quota System**: Deductions are applied at the database query level using conditional `updateMany` queries (`WHERE quotaUsedToday < limit`). If parallel requests race, unused units are safely handled.
4. **Sandpack Import Sanitizer**: Unsafe system folder traversals (`/server/`, `/node_modules/`, `/prisma/`) are stripped dynamically during SSE parsing.

---

## 🤝 Contributing & Open Source Program

Contributions are welcome! Whether you are submitting bug fixes, adding new framework support to Sandpack (Vue, Svelte, Solid), or improving prompt architectures for technical PRDs:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
