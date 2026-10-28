# Raw AI prompt log

The following is the original project brief submitted to the AI assistant for this implementation. The prompt text is reproduced without summarizing or editing it.

---

TDD Kata: Car Dealership Inventory System

Objective

The goal of this kata is to design, build, and test a full-stack Car Dealership Inventory System. This project will test your skills in API development, database management, frontend implementation, testing, and modern development workflows, including the use of AI tools.

Core Requirements

1. Backend API (RESTful)

You are to build a robust backend API that will serve as the brain of the application.

Technology: Choose one of the following: Node.js/TypeScript (with Express/NestJS), Python (with Django/FastAPI), or Ruby (with Rails).

Database: The application must connect to a database (e.g., PostgreSQL, MongoDB, SQLite). An in-memory database is not sufficient.

User Authentication:

Users must be able to register and log in.

Implement token-based authentication (e.g., JWT) to secure certain API endpoints.

API Endpoints:

Auth: POST /api/auth/register, POST /api/auth/login

Vehicles (Protected):

POST /api/vehicles: Add a new vehicle.

GET /api/vehicles: View a list of all available vehicles.

GET /api/vehicles/search: Search for vehicles by make, model, category, or price range.

PUT /api/vehicles/:id: Update a vehicle's details.

DELETE /api/vehicles/:id: Delete a vehicle (Admin only).

Inventory (Protected):

POST /api/vehicles/:id/purchase: Purchase a vehicle, decreasing its quantity.

POST /api/vehicles/:id/restock: Restock a vehicle, increasing its quantity (Admin only).

Each vehicle must have a unique ID, make, model, category, price, and quantity in stock.

1. Frontend Application

You must build a modern, single-page application (SPA) to interact with your backend API.

Technology: You must use HTML5, CSS3, Tailwind, and React

Functionality:

User registration and login forms.

A dashboard or homepage to display all available vehicles.

Functionality to search and filter vehicles.

A "Purchase" button on each vehicle, which should be disabled if the quantity is zero.

(For Admin Users) Forms/UI to add, update, and delete vehicles.

Design: This is a chance to show your creativity. The application should be visually appealing, responsive, and provide a great user experience.

Process & Technical Guidelines

1. Test-Driven Development (TDD)

Write tests before implementing functionality. We expect to see a clear "Red-Green-Refactor" pattern in your commit history, especially for the backend logic. Aim for high test coverage with meaningful test cases.

1. Clean Coding Practices

Write clean, readable, and maintainable code. Follow SOLID principles and other best practices in software design. Your code should be well-documented with meaningful comments and clear naming conventions.

1. Git & Version Control

Use Git for version control. Commit your changes frequently with clear, descriptive messages that narrate your development journey.

1. AI Usage Policy (Important)

We believe AI is a critical tool in the modern software development lifecycle. You are encouraged and expected to use AI tools. However, you must be transparent about it.

AI Co-authorship: For every commit where you used an AI tool (for generating boilerplate, writing tests, debugging, etc.), you must add the AI as a co-author.

How to add a co-author: At the end of your commit message, add two empty lines, followed by the co-author trailer.

git commit -m "feat: Implement user registration endpoint

Used an AI assistant to generate the initial boilerplate for the

controller and service, then manually added validation logic.

Co-authored-by: AI Tool Name [AI@users.noreply.github.com](mailto:AI@users.noreply.github.com)"

README Documentation: Your README.md file must include a detailed section titled "My AI Usage". In this section, you must describe:

Which AI tools you used (e.g., GitHub Copilot, ChatGPT, Gemini, etc.).

How you used them (e.g., "I used Gemini to brainstorm API endpoint structures," or "I asked Copilot to generate unit tests for my service layer").

Your reflection on how AI impacted your workflow.

Interview Discussion: Be prepared to discuss your AI usage in detail during the interview. We are interested in how you leverage these tools effectively and responsibly.

Deliverables

A public Git repository link (e.g., on GitHub, GitLab).

A comprehensive README.md file that includes:

A clear explanation of the project.

Detailed instructions on how to set up and run the project locally (both backend and frontend).

Screenshots of your final application in action.

The mandatory "My AI Usage" section.

A test report showing the results of your test suite.

A root PROMPTS.md containing your raw, unedited AI chat logs or public chat links (no AI-generated summaries).

(Optional - Brownie Points) A link to the deployed, live application on a platform like Vercel, Netlify, Heroku, or AWS.

Note: Plagiarism is strictly forbidden. While we encourage AI assistance, submitting code copied from other repositories or developers will result in immediate rejection. We want to see your work, augmented by modern tools.

---

## Additional raw user prompt snapshot

The following is the complete user-provided prompt attachment from the later project requirements turn. The prompt body is copied verbatim from the read-only attachment. This file does not contain a complete transcript of the assistant's responses or earlier conversation history; add those original records or a public conversation link if the assignment requires the full chat.

<!-- BEGIN VERBATIM USER PROMPT ATTACHMENT -->

# MASTER ENGINEERING PROMPT — CAR DEALERSHIP INVENTORY SYSTEM

## 1. YOUR ROLE
Act as a senior full-stack engineer, software architect, test engineer, DevOps engineer, security reviewer, and product designer.

Your task is to help me build a complete, professional-grade **Car Dealership Inventory Management System** for a Test-Driven Development (TDD) coding assignment.

This is a real software engineering project, not a landing-page demo, static mockup, or superficial CRUD tutorial.

You must implement a working application with a real database, secure authentication, role-based authorization, REST APIs, a polished React frontend, comprehensive automated tests, Docker-based development, CI/CD, API documentation, and complete project documentation.

Treat correctness, maintainability, security, usability, and demonstrable engineering decisions as equally important.

Work directly in the existing repository when tools permit. Inspect the repository before making changes. Preserve useful existing code and configuration instead of blindly replacing everything.

Do not stop after generating a plan, a homepage, or a project scaffold. Continue implementing, testing, debugging, and verifying the application until all feasible requirements are complete.

---

## 2. NON-NEGOTIABLE PRODUCT REQUIREMENTS
The application must support:

- User registration and login.
- Secure token-based authentication.
- Customer and administrator roles.
- Viewing available vehicle inventory.
- Searching and filtering by make, model, category, and price range.
- Adding and editing vehicles.
- Deleting vehicles with administrator authorization.
- Purchasing vehicles and reducing inventory quantities.
- Restocking vehicles with administrator authorization.
- A persistent relational database.
- Comprehensive automated tests.
- Dockerized local development.
- An automated CI pipeline.
- API documentation.
- A complete README.md.
- A mandatory My AI Usage section.
- A root-level PROMPTS.md containing the actual, unedited AI prompts and conversation logs or public chat links.
- A test report with real test execution results.
- A clear Git history showing incremental development and TDD.
Never claim that a feature, test, deployment, security check, or pipeline works unless you have actually verified it or clearly label it as unverified.

Do not fabricate test results, screenshots, coverage percentages, CI status, or deployment URLs.

---

## 3. REQUIRED TECHNOLOGY STACK
Use the following stack unless an existing repository imposes a compelling compatibility constraint. Explain any necessary deviation before implementing it.

### Frontend

- React
- TypeScript
- Vite
- HTML5 and CSS3
- Tailwind CSS
- React Router
- TanStack Query for server-state management
- React Hook Form for forms
- Zod for client-side validation
- A lightweight icon library such as Lucide
- Vitest
- React Testing Library
- Playwright for end-to-end testing
Use stable, mutually compatible package versions and commit the appropriate lockfiles.

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic for database migrations
- PostgreSQL
- Pytest
- HTTPX for API integration tests
- Ruff for linting and formatting
- MyPy where practical
Use JWT access tokens with appropriate expiration, secure password hashing using Argon2id or another appropriate modern password-hashing algorithm, and explicit role-based authorization.

### Infrastructure and tooling

- Docker
- Docker Compose
- PostgreSQL
- GitHub Actions
- Git
- OpenAPI / Swagger UI
- Environment-variable-based configuration
- Pre-commit checks where practical
Do not introduce unnecessary infrastructure, microservices, Kubernetes, Redis, message queues, or paid services unless there is a clear requirement and documented justification.

Prefer a well-structured modular monolith over needless architectural complexity.

---

## 4. DESIGN DIRECTION: DISTINCTIVE, HUMAN-DESIGNED UI
This requirement is extremely important.

The interface must NOT look like a generic AI-generated SaaS dashboard.

Avoid the familiar AI-generated aesthetic:

- Inter, Roboto, or Arial as the automatic default for every page.
- Purple-to-blue gradients.
- Glowing cards and excessive glassmorphism.
- Huge rounded cards everywhere.
- Identical card grids with no visual hierarchy.
- Generic hero sections with oversized slogans.
- Excessive badges, pills, shadows, and decorative icons.
- Every section centered with excessive whitespace.
- Emoji used as interface icons.
- Fake analytics, fake testimonials, invented ratings, and meaningless statistics.
- Repeated components that make every page look identical.
- Generic marketing copy such as "Unlock the power of your inventory."
- Placeholder buttons and fake functionality.
- A design that resembles a default shadcn/ui template or an AI-generated admin dashboard.

### Creative direction
Design the product as a premium automotive dealership inventory platform: precise, editorial, technical, and visually confident.

The design should feel like software built by a thoughtful product team for people who actually work with cars.

Use this direction as a starting point, not as a rigid template:

- Primary palette: warm off-white, graphite, charcoal, and a restrained racing red or burnt orange accent.
- Typography: choose a distinctive, readable pairing, such as Space Grotesk or Manrope for headings and IBM Plex Sans for interface text. Consider IBM Plex Mono for inventory identifiers, prices, and technical metadata.
- Use a deliberate typographic hierarchy.
- Prefer crisp borders, disciplined spacing, strong alignment, and subtle hover states over excessive shadows.
- Use real automotive imagery where appropriate and legally accessible. Never make the application dependent on inaccessible external image URLs.
- Design meaningful vehicle imagery, specifications, stock indicators, price displays, and inventory tables.
- Use compact, purposeful navigation and practical information density.
- Make primary actions obvious without making every element a button.
- Use a consistent spacing, color, typography, and component system.
- Support keyboard navigation, focus states, sufficient contrast, and reduced-motion preferences.
- Make the application genuinely responsive on mobile, tablet, and desktop.
Choose exact fonts, colors, sizing, and layouts deliberately. Do not simply copy this prompt's palette and typography without considering how the complete application should look.

### Required frontend pages

1. Login.
2. Registration.
3. Inventory dashboard.
4. Vehicle details.
5. Create vehicle.
6. Edit vehicle.
7. Purchase confirmation or transaction result.
8. Administrator inventory management.
9. Access-denied / unauthorized state.
10. Not-found page.
The inventory dashboard must contain:

- A clear page heading and useful supporting context.
- Search input with sensible behavior.
- Make, model, category, and price filters.
- Sorting and pagination.
- A clear indication of available stock.
- Vehicle cards or a well-designed table, selected according to what best serves the use case.
- Vehicle details and pricing.
- Purchase actions.
- Loading skeletons.
- Empty states.
- Error states and retry actions.
- Success and failure feedback.
- A disabled purchase action when stock is zero.
Administrator users should have appropriate controls for creating, updating, deleting, and restocking vehicles.

Customers must not see or execute administrator-only operations.

Do not build every page as a duplicate of the same dashboard. Give each page an appropriate layout and purpose.

### Interaction quality
Every visible control must work.

Implement:

- Form validation.
- Clear validation errors.
- Search and filter state.
- Loading indicators.
- Confirmation for destructive actions.
- Purchase feedback.
- Empty results.
- API error handling.
- Authentication state.
- Protected navigation.
- Responsive navigation.
- Appropriate disabled states.
Never substitute mock data for real API data in the completed application. Seed data is acceptable for local development and demonstrations, but it must be persisted in PostgreSQL.

---

## 5. ARCHITECTURE AND REPOSITORY STRUCTURE
Use a clean monorepo structure similar to:

car-dealership-inventory/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── inventory/
│   │   │   └── admin/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── types/
│   │   └── test/
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── db/
│   │   └── main.py
│   ├── migrations/
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── testing.md
│   └── security.md
├── screenshots/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .dockerignore
├── Makefile
├── README.md
├── PROMPTS.md
└── LICENSE

Adjust this structure when justified. Avoid creating empty modules, unnecessary abstractions, or files that contain no meaningful implementation.

Separate API routing, business logic, persistence, validation, and configuration. Keep frontend components maintainable and organized by feature.

Document important architectural decisions and their trade-offs.

---

## 6. DATABASE DESIGN
Use PostgreSQL as the persistent database.

Design normalized tables with appropriate constraints, indexes, and relationships.

### Users
Include:

- Unique user ID.
- Name.
- Email address with case-insensitive uniqueness.
- Securely hashed password.
- Role: customer or admin.
- Created timestamp.
- Updated timestamp.
Never store plaintext passwords.

Do not allow public registration to assign an administrator role. Provision the initial administrator through a controlled bootstrap command or another documented, secure process.

### Vehicles
Include:

- Unique vehicle ID.
- Make.
- Model.
- Category.
- Price.
- Quantity in stock.
- Optional description and specifications.
- Optional image URL or managed image reference.
- Created timestamp.
- Updated timestamp.
Enforce:

- Non-negative stock quantity.
- Positive price.
- Required identifying fields.
- Suitable field-length limits.
- Database-level integrity constraints.
Use a suitable numeric database type for monetary values, such as Numeric/Decimal. Do not use binary floating-point values for financial calculations.

### Purchase records
Add a purchase or inventory transaction table so that successful purchases can be audited.

Include:

- Unique transaction ID.
- Vehicle reference.
- User reference.
- Quantity purchased.
- Unit price at the time of purchase.
- Total amount.
- Transaction timestamp.
- A transaction status if needed.
Preserve the historical transaction price if the vehicle price later changes.

For this kata, define the purchase endpoint as purchasing one unit by default. If quantity-based purchases are supported, validate the requested quantity and prevent overselling.

Use Alembic migrations. Do not rely on automatic table creation as a substitute for a proper migration workflow.

Provide realistic development seed data and a documented way to create a demo administrator.

Never commit real credentials or production secrets.

---

## 7. AUTHENTICATION AND SECURITY
Implement:

POST /api/auth/register
POST /api/auth/login

Requirements:

- Validate and normalize email addresses.
- Enforce password policy.
- Hash passwords securely.
- Return appropriate HTTP status codes.
- Issue short-lived JWT access tokens.
- Validate token signatures, expiry, and claims.
- Implement a reusable current-user dependency.
- Enforce customer/admin authorization on the backend.
- Avoid returning password hashes or sensitive internal fields.
- Avoid leaking whether an account exists through unnecessarily detailed login errors.
- Apply reasonable request validation and abuse protections.
- Configure CORS through environment variables.
- Keep secrets outside source code.
- Protect state-changing operations from relevant security risks.
- Use HTTPS in production.
- Ensure logs do not contain passwords, tokens, or sensitive authentication data.
For the initial assignment, use bearer-token authentication if it simplifies the REST API. Explain token storage risks. Do not store long-lived credentials in localStorage by default without explicitly evaluating the XSS implications.

If using cookies, configure HttpOnly, Secure, SameSite, and CSRF protections appropriately.

Provide a documented administrator bootstrap process.

Test authentication expiration, invalid tokens, privilege escalation attempts, and access to protected endpoints.

Do not rely on hiding frontend buttons as an authorization mechanism.

---

## 8. REST API CONTRACT
Use a versioned API prefix if appropriate, such as /api/v1, and document the mapping to the required assignment routes if the exact unversioned paths are retained.

Implement the following required endpoints.

### Authentication
POST /api/auth/register

POST /api/auth/login

### Vehicles
POST /api/vehicles

- Authenticated users only.
- Apply an explicit policy on who may create vehicles. Prefer admin-only creation for a dealership system unless the assignment requires otherwise.
GET /api/vehicles

- Authenticated access.
- Return available inventory.
- Support pagination, sorting, and useful filters.
GET /api/vehicles/search

- Authenticated access.
- Support make, model, category, minimum price, and maximum price.
- Validate filter ranges.
- Avoid inefficient database queries.
PUT /api/vehicles/{id}

- Authenticated administrator access.
- Validate updates and preserve data integrity.
DELETE /api/vehicles/{id}

- Administrator only.
- Avoid silently deleting historical transaction information.
- Return an appropriate response when a vehicle does not exist or has historical purchases.
POST /api/vehicles/{id}/purchase

- Authenticated customer access.
- Verify that the vehicle exists and is purchasable.
- Prevent stock from becoming negative.
- Persist the inventory change and purchase record atomically.
- Handle simultaneous purchase requests safely.
POST /api/vehicles/{id}/restock

- Administrator only.
- Validate a positive restock quantity.
- Update inventory safely.
- Return the updated vehicle.

### Additional useful endpoints
GET /api/vehicles/{id}

GET /api/auth/me

GET /api/health/live

GET /api/health/ready

Optionally provide administrator inventory transaction endpoints when they add real value.

### API standards
Use:

- Appropriate GET, POST, PUT, and DELETE semantics.
- Correct HTTP status codes.
- Consistent JSON request and response schemas.
- Structured validation errors.
- Consistent error responses.
- Pagination metadata.
- Filtering and sorting validation.
- Database transactions where needed.
- Explicit authorization checks.
- OpenAPI documentation.
Avoid returning raw database exceptions or stack traces to clients.

Use 401 for unauthenticated requests and 403 for authenticated users lacking permission, where appropriate. Return 404 for missing resources and 409 for genuine resource-state conflicts.

Document every endpoint with request examples, response examples, authentication requirements, status codes, and failure scenarios.

---

## 9. BUSINESS LOGIC AND CONCURRENCY
The inventory rules are critical.

Implement these invariants:

1. Stock must never become negative.
2. A purchase must not succeed when stock is zero.
3. A failed purchase must not create a successful transaction record.
4. A successful purchase must update stock and create the purchase record in the same database transaction.
5. Two simultaneous purchase requests must not oversell the same inventory.
6. Restocking must require administrator authorization.
7. Invalid prices and quantities must be rejected.
8. Historical purchase records must remain consistent.
9. An unsuccessful operation must not leave partial database changes.
Use an appropriate transaction strategy, such as a conditional atomic UPDATE or row-level locking, supported by PostgreSQL.

Add tests that reproduce concurrent purchase attempts and verify that the final stock and transaction count are correct.

Do not assume that checking the stock in Python before updating it is sufficient to prevent race conditions.

---

## 10. TEST-DRIVEN DEVELOPMENT IS MANDATORY
Use genuine Red-Green-Refactor development.

For each important feature:

1. Write a failing test.
2. Run it and verify that it fails for the expected reason.
3. Implement the smallest correct change.
4. Run the test and verify that it passes.
5. Refactor without changing behavior.
6. Rerun the relevant tests.
7. Run the broader suite at meaningful checkpoints.
8. Record the actual results.
Do not write the entire application first and generate tests afterward.

### Backend testing
Use Pytest and HTTPX.

Test:

- Registration success.
- Duplicate email rejection.
- Invalid registration payloads.
- Password hashing.
- Successful login.
- Invalid credentials.
- Expired or invalid tokens.
- Current-user endpoint.
- Protected endpoint access.
- Customer versus admin permissions.
- Vehicle creation and validation.
- Listing and pagination.
- Search and price filters.
- Updating a vehicle.
- Deleting a vehicle.
- Purchasing available stock.
- Purchasing zero-stock vehicles.
- Restocking.
- Invalid quantities and prices.
- Missing vehicle IDs.
- Transaction rollback.
- Concurrent purchasing.
- Database constraints.
- Error response consistency.
Use a dedicated test database or isolated transactional test fixtures. Never run destructive tests against a production database.

### Frontend testing
Use Vitest and React Testing Library.

Test:

- Registration and login forms.
- Validation errors.
- API loading states.
- Error states.
- Inventory rendering.
- Search and filters.
- Purchase button behavior.
- Out-of-stock behavior.
- Protected routes.
- Administrator-only UI.
- Successful and failed mutations.
- Accessibility-critical interactions.
Mock network calls at the appropriate frontend testing boundary, but use real backend integration tests separately.

### End-to-end testing
Use Playwright for critical user journeys:

1. Register a customer.
2. Log in.
3. View the inventory.
4. Search and filter vehicles.
5. Purchase an available vehicle.
6. Verify that inventory decreases.
7. Verify that a zero-stock vehicle cannot be purchased.
8. Log in as an administrator.
9. Create a vehicle.
10. Edit a vehicle.
11. Restock a vehicle.
12. Delete a permitted vehicle.
13. Verify that unauthorized actions are rejected.
Use an isolated test environment and deterministic test data.

### Coverage and reporting
Configure meaningful coverage reports.

Aim for at least 80% backend coverage for application code as an engineering target, but prioritize meaningful branch and business-rule coverage over gaming the percentage.

Generate actual reports. Identify untested critical branches and add tests where useful.

Never fabricate a passing test result or coverage figure.

---

## 11. FRONTEND-BACKEND INTEGRATION
The React application must communicate with the real FastAPI backend.

Implement:

- A centralized API client.
- Configurable API base URL.
- Consistent response and error handling.
- Typed request and response interfaces.
- Authentication handling.
- Protected routes.
- Role-aware UI.
- Request loading and cancellation where appropriate.
- Safe handling of expired authentication.
- Query invalidation after successful inventory changes.
- Form submission feedback.
- Empty, loading, error, and success states.
Avoid duplicating backend business rules in the frontend. Frontend validation improves usability, but the backend remains authoritative.

Do not hardcode fake inventory, fake authentication, or success responses in production code.

Make local development work without requiring a paid third-party API.

If vehicle images are unavailable, use a designed fallback that remains attractive and does not produce broken-image icons.

---

## 12. DOCKER AND LOCAL DEVELOPMENT
Create working Dockerfiles and a Docker Compose configuration for:

- Frontend.
- Backend.
- PostgreSQL.
Requirements:

- Persistent PostgreSQL volume.
- Health checks.
- Correct service-to-service networking.
- Environment-based configuration.
- Reliable application startup.
- Database readiness before migrations and application initialization.
- Non-root containers where practical.
- Multi-stage production builds where useful.
- No hardcoded secrets.
- Correct dependency installation and lockfile usage.
Document commands for:

- Starting the complete stack.
- Running database migrations.
- Seeding development data.
- Creating an administrator.
- Running backend tests.
- Running frontend tests.
- Running end-to-end tests.
- Running linting and formatting.
- Viewing API documentation.
- Shutting down the stack.
- Resetting the local development database.
Verify the actual commands in a clean environment when possible.

Do not claim the Docker setup works unless you have built and run it.

---

## 13. CI/CD PIPELINE
Implement GitHub Actions workflows that run on pull requests and pushes to the main branch.

### Continuous integration
The pipeline should:

1. Check out the repository.
2. Set up supported Python and Node.js versions.
3. Install dependencies reproducibly.
4. Start a PostgreSQL service for integration tests.
5. Validate configuration and migrations.
6. Run backend linting and formatting checks.
7. Run static type checks where configured.
8. Run backend unit and integration tests.
9. Generate backend coverage reports.
10. Run frontend linting and type checking.
11. Run frontend unit tests.
12. Build the frontend.
13. Run end-to-end tests in a suitable browser environment.
14. Publish test artifacts and reports.
15. Fail the workflow when required checks fail.
Avoid duplicate or unnecessarily expensive jobs. Use dependency caching correctly and keep credentials out of pull-request logs.

### Continuous deployment
Provide an optional, clearly documented deployment workflow.

Use a realistic deployment target for the frontend and backend, with PostgreSQL hosted separately or through a suitable managed service.

Use GitHub Actions environments and repository secrets for credentials.

Include:

- Environment-specific configuration.
- Production build verification.
- Database migration considerations.
- Health checks.
- Deployment verification.
- A rollback strategy where the platform supports it.
Do not automatically deploy untested code.

Do not invent secrets, deployment URLs, successful deployments, or cloud resources.

If credentials or external infrastructure are unavailable, finish the deployable configuration and explain precisely what must be supplied to activate deployment.

---

## 14. CODE QUALITY AND ENGINEERING PRACTICES
Follow these principles:

- SOLID where applicable.
- DRY without excessive abstraction.
- Clear separation of concerns.
- Small, readable functions.
- Explicit types.
- Dependency injection where useful.
- Predictable error handling.
- Configuration through environment variables.
- Consistent naming.
- Meaningful comments explaining non-obvious decisions.
- Docstrings for public interfaces where appropriate.
- No committed credentials.
- No dead code.
- No unexplained `any` types.
- No unnecessary catch-all exception handling.
- No swallowed errors.
- No duplicated business logic.
- No giant components or monolithic service files.
- No hardcoded production URLs.
- No unnecessary dependencies.
Use Ruff, TypeScript strict mode, ESLint, and appropriate formatting checks.

Run dependency vulnerability checks using available tools and document any unresolved findings.

Avoid overengineering a coding kata. Explain where a simple implementation is sufficient.

---

## 15. DEBUGGING AND VERIFICATION LOOP
You are responsible for debugging the application, not merely generating code.

After implementing each meaningful vertical slice:

1. Inspect the changed files.
2. Run the relevant unit tests.
3. Run integration tests.
4. Run linting and type checks.
5. Start the application where feasible.
6. Exercise the actual API.
7. Verify frontend-to-backend communication.
8. Inspect browser console errors and failed network requests.
9. Check database persistence and transaction behavior.
10. Fix the underlying causes of failures.
11. Rerun the tests that previously failed.
12. Rerun all affected regression tests.
When debugging:

- Identify the actual error.
- Trace its cause.
- Fix the root cause rather than hiding the symptom.
- Add a regression test for meaningful bugs.
- Explain any unresolved issue accurately.
Do not silently disable failing tests, weaken assertions, suppress lint errors, or remove functionality merely to achieve a green pipeline.

If a tool or environment limitation prevents verification, explain the limitation and provide the exact next command or manual step.

---

## 16. GIT HISTORY AND COMMIT STRATEGY
Use incremental, meaningful commits.

Examples:

- chore: initialize full-stack project structure
- test(auth): add failing registration tests
- feat(auth): implement secure user registration
- test(auth): cover login and token validation
- feat(auth): implement JWT authentication
- test(inventory): cover filtering and pagination
- feat(inventory): implement vehicle listing API
- test(inventory): cover concurrent purchase requests
- feat(inventory): implement atomic vehicle purchases
- feat(frontend): build responsive inventory dashboard
- test(frontend): cover protected routes and purchase states
- feat(docker): containerize application services
- ci: add automated backend and frontend checks
- docs: document setup, API, testing, and AI usage
Only claim TDD history when the actual commit sequence demonstrates it.

For every commit that uses AI assistance, follow the assignment's co-authorship requirement.

Use the following trailer format, replacing the identity with the actual AI tool and a valid, verified noreply address when available:

Co-authored-by: AI Tool Name [AI@users.noreply.github.com](mailto:AI@users.noreply.github.com)

Place the trailer after two blank lines, as required by the assignment.

Do not invent an AI tool's identity or email address. Verify the appropriate co-author identity before using it.

Do not squash away the TDD history if doing so would conceal the development process.

If Git write access or permission is unavailable, provide the exact suggested commit commands and explain what I need to execute.

---

## 17. DOCUMENTATION REQUIREMENTS

### README.md
Create a polished, comprehensive README with:

1. Project name and overview.
2. Problem statement.
3. Key features.
4. Technology stack.
5. Architecture overview.
6. Screenshots of the actual application.
7. Database schema overview.
8. API endpoint summary.
9. Authentication and authorization model.
10. Prerequisites.
11. Environment setup.
12. Docker-based setup.
13. Local development setup.
14. Database migration instructions.
15. Seed-data instructions.
16. Administrator setup.
17. Backend test commands.
18. Frontend test commands.
19. End-to-end test commands.
20. Coverage and test-report instructions.
21. CI/CD explanation.
22. API documentation links for a running local server.
23. Troubleshooting.
24. Security considerations.
25. Known limitations.
26. Future improvements.
27. Deployment instructions or live URL, if genuinely deployed.
28. Mandatory **My AI Usage** section.

### My AI Usage
Document:

- Every AI tool actually used.
- What each tool helped with.
- Which implementation, testing, debugging, or documentation tasks were AI-assisted.
- What I reviewed, modified, tested, and verified myself.
- How AI improved or affected the workflow.
- Limitations or incorrect suggestions encountered and how they were addressed.
Use an honest, first-person account based on the actual development process. Do not invent personal experiences or claim that I manually wrote code that AI generated.

### PROMPTS.md
Create a root-level PROMPTS.md for the assignment's mandatory raw AI interaction logs.

Important:

- Preserve actual prompts and responses without rewriting them into summaries.
- Record public conversation links where available.
- Organize the logs chronologically without altering their contents.
- Clearly distinguish raw logs from explanatory metadata.
- Never fabricate conversation transcripts or public URLs.
- If the environment cannot retrieve the complete conversation history, provide a clear collection template and instructions for adding the original logs.

### Additional documentation
Create:

- docs/architecture.md
- docs/api.md
- docs/testing.md
- docs/security.md
Include architecture diagrams where useful, database relationships, request flows, test strategy, known limitations, and security decisions.

### Test report
Generate a report from actual executed test results, including:

- Test commands.
- Pass/fail counts.
- Skipped tests.
- Coverage where available.
- Known failures.
- Environment limitations.
Keep generated reports reproducible.

### Screenshots
Capture genuine screenshots of the running application at useful viewport sizes. Do not substitute generated mockups for screenshots of the implemented product.

If browser automation is unavailable, document how screenshots can be captured manually.

---

## 18. IMPLEMENTATION WORKFLOW
Work in these phases.

### Phase 1: Repository inspection and planning

- Inspect the repository and Git status.
- Identify existing implementation and constraints.
- Confirm the selected architecture.
- Create a requirements checklist.
- Identify major risks and acceptance criteria.
- Establish the development commands.
- Create a concise implementation plan.
Then begin implementation without waiting for unnecessary confirmation.

### Phase 2: Foundation

- Configure the frontend and backend.
- Establish environment configuration.
- Set up PostgreSQL and migrations.
- Configure linting, formatting, and tests.
- Create Docker Compose.
- Verify that the foundation starts correctly.

### Phase 3: Authentication

- Write failing authentication tests first.
- Implement registration and login.
- Add password hashing and JWT verification.
- Add authorization dependencies.
- Verify protected routes and role restrictions.

### Phase 4: Inventory backend

- Define database models and constraints.
- Write failing vehicle API tests.
- Implement listing, filtering, search, creation, updating, and deletion.
- Add inventory transaction handling.
- Implement atomic purchases and restocking.
- Test concurrency and authorization.

### Phase 5: Frontend foundation and design

- Establish the visual design system.
- Implement routing, layouts, forms, and API client.
- Build login and registration.
- Build the inventory experience.
- Implement vehicle details and purchase interactions.
- Build administrator inventory management.
- Add loading, empty, error, and success states.
- Test responsive behavior and accessibility.

### Phase 6: Integration

- Connect all pages to the real API.
- Verify token handling.
- Validate role-based behavior.
- Verify inventory changes against PostgreSQL.
- Test failure scenarios and race conditions.
- Remove accidental mock data from production paths.

### Phase 7: Quality assurance

- Run backend tests.
- Run frontend tests.
- Run end-to-end tests.
- Run linting and type checks.
- Run coverage reports.
- Run dependency and security checks.
- Debug and fix failures.
- Verify all acceptance criteria.

### Phase 8: DevOps and CI/CD

- Build Docker images.
- Test Compose startup and persistence.
- Implement GitHub Actions.
- Verify CI jobs.
- Configure optional deployment.
- Document environment-specific steps and remaining external prerequisites.

### Phase 9: Final documentation and delivery

- Complete README.md.
- Complete My AI Usage.
- Complete PROMPTS.md using real logs.
- Complete architecture, API, testing, and security documentation.
- Generate the test report.
- Capture real screenshots.
- Review Git status and secrets.
- Verify a clean local setup.
- Produce a final delivery report.
Do not move past a critical phase while leaving the application in a broken state. If something cannot be completed, state the blocker and continue with independent tasks.

---

## 19. DEFINITION OF DONE
The project is complete only when the following have been verified:

[ ] Frontend builds successfully.
[ ] Backend starts successfully.
[ ] PostgreSQL persistence works.
[ ] Database migrations work.
[ ] Registration and login work.
[ ] Passwords are hashed securely.
[ ] JWT authentication works.
[ ] Role-based authorization works on the backend.
[ ] Vehicle listing works.
[ ] Search and filters work.
[ ] Create, update, and delete operations obey permissions.
[ ] Purchase operations update stock correctly.
[ ] Concurrent purchases cannot oversell inventory.
[ ] Restocking works and is restricted to administrators.
[ ] Frontend communicates with the real backend.
[ ] Loading, empty, error, and success states work.
[ ] Mobile and desktop layouts work.
[ ] Backend tests have been executed.
[ ] Frontend tests have been executed.
[ ] End-to-end tests have been executed where the environment permits.
[ ] Linting and type checks pass.
[ ] Coverage reports are generated.
[ ] Docker Compose starts the complete application.
[ ] GitHub Actions is configured and verified.
[ ] API documentation is available.
[ ] README.md is complete.
[ ] My AI Usage is honest and complete.
[ ] PROMPTS.md contains actual raw logs or clearly identifies what remains to be added.
[ ] Test reports reflect real results.
[ ] Screenshots represent the actual application.
[ ] No secrets or real credentials are committed.
[ ] Git history demonstrates incremental development.
[ ] Remaining limitations are explicitly documented.

---

## 20. FINAL OPERATING INSTRUCTIONS
Start by inspecting the repository and reporting the existing state briefly.

Then implement the project in small, verifiable steps.

Do not produce a massive untested code dump. Prefer complete, working vertical slices.

Do not ask me to approve every minor design or implementation choice. Make sensible engineering decisions and document important trade-offs.

Do not stop at pseudocode, file trees, mockups, or instructions when you have the tools to implement the actual files.

Do not claim success without verification.

Prioritize a working, secure, maintainable application over superficial visual polish, but make the final interface genuinely distinctive and professional.

At the end, provide:

1. What was implemented.
2. The final architecture and technology choices.
3. Commands to run the complete project.
4. Actual test and coverage results.
5. CI/CD status.
6. Screenshots and deployment URL, if available.
7. Repository status and meaningful commits created.
8. Known limitations or tasks requiring my credentials or manual action.
9. A checklist mapping every assignment requirement to its implementation and verification evidence.
10. The key technical decisions I should understand before explaining the project in an interview.
Begin with repository inspection, then proceed through implementation, testing, debugging, and verification.
<!-- END VERBATIM USER PROMPT ATTACHMENT -->

---

## Template for unavailable transcript turns

The workspace did not provide the complete historical assistant/user transcript or a public chat URL. If required, add each missing exchange verbatim below; do not replace raw turns with a summary.

```text
Conversation date/time:
Public conversation URL (if available):

[User]
Paste the original user message verbatim.

[Assistant]
Paste the original assistant response verbatim.
```
