# Salesforce Agent Instructions

## Primary Rule

Always use Salesforce MCP tools when available.

Prefer business-level agent tools over low-level implementation actions.

---

## Available MCP Tools

### developerAgent

Used for Salesforce development activities.

Handles:

- Create Field
- Create Object
- Create Apex Class
- Create Lightning Web Component
- Create Flow
- Create Validation Rule

Internally performs:

- Feature Branch Creation
- Metadata Creation
- Commit
- Push
- Pull Request Creation

---

### releaseAgent

Used for environment promotion.

Handles:

- Deploy to Dev
- Deploy to Test
- Deploy to Prod

Internally performs:

- Commit Promotion
- Branch Promotion
- GitHub Actions Trigger
- Deployment Orchestration

---

## Mandatory Development Workflow

All Salesforce development must follow:

Feature Branch
→ Metadata Creation
→ Commit
→ Push
→ Pull Request
→ Promotion
→ GitHub Actions
→ Salesforce Deployment

---

## Direct Deployment Policy

Direct Salesforce deployment is prohibited.

Never execute:

- sf project deploy start
- sf deploy metadata
- sf project deploy validate
- sf force source deploy

Deployment must happen only through GitHub Actions.

---

## Development Deployment

When the user requests:

"Deploy to Dev"

Use:

releaseAgent

with:

environment = dev

---

## Testing Deployment

When the user requests:

"Deploy to Test"

Use:

releaseAgent

with:

environment = test

---

## Production Deployment

When the user requests:

"Deploy to Production"

Use:

releaseAgent

with:

environment = prod

---

## Salesforce Metadata Creation

For requests such as:

- Create Field
- Create Object
- Create Apex Class
- Create LWC
- Create Flow
- Create Validation Rule

Use:

developerAgent

Never create metadata directly through shell commands if the agent capability exists.

---

## Pull Requests

Pull Requests are created internally by developerAgent.

Do not manually create pull requests unless explicitly requested.

---

## Repository Information

Repository Name: Agentic-AI

Development Branch: devagent1

Testing Branch: test

Production Branch: main

---

## Optimization Rules

Prefer execution over investigation.

Do not repeatedly:

- scan repository structure
- inspect workflow files
- read branch lists
- verify successful actions

If an agent reports success:

assume success and continue.

Only investigate when an error occurs.

---

## Enterprise Architecture

User
↓
developerAgent
↓
Feature Branch
↓
Metadata Creation
↓
Commit
↓
Push
↓
Pull Request

User
↓
releaseAgent
↓
Promotion
↓
GitHub Actions
↓
Salesforce Deployment

---

## Governance

GitHub Actions is the only deployment mechanism.

No direct deployment to Salesforce is allowed.

All environment releases must pass through:

releaseAgent
→ GitHub Actions
→ Salesforce