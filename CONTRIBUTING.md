# Contributing to Grafana MCP App

Thank you for your interest in contributing to Grafana MCP App! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to the Contributor Covenant [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, screenshots, etc.)
- **Describe the behavior you observed and what you expected**
- **Include environment details**:
  - OS and version
  - Node.js version
  - Grafana version
  - Browser (if UI-related)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the proposed functionality
- **Explain why this enhancement would be useful**
- **List any similar features** in other projects (if applicable)

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the coding standards below
3. **Add tests** if applicable
4. **Update documentation** if you're changing functionality
5. **Ensure the test suite passes**: `npm test`
6. **Ensure code type-checks**: `npm run typecheck`
7. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ (recommended: 20+)
- Docker (for running Grafana)
- Git

### Setup Steps

1. **Clone your fork**:
   ```bash
   git clone https://github.com/spitimage/grafana-mcp-app.git
   cd grafana-mcp-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Grafana**:
   ```bash
   docker run -d \
     --name grafana \
     -p 3000:3000 \
     -e GF_AUTH_ANONYMOUS_ENABLED=true \
     -e GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer \
     -e GF_SECURITY_ALLOW_EMBEDDING=true \
     -e GF_SECURITY_COOKIE_SAMESITE=none \
     -e GF_SECURITY_COOKIE_SECURE=false \
     grafana/grafana:latest

   npm run setup:grafana
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

5. **Build and run**:
   ```bash
   npm run build
   npm start
   ```

### Development Workflow

For active development with hot reload:

```bash
npm run dev
```

This starts:
- Vite in watch mode (rebuilds UI on changes)
- TypeScript compiler in watch mode
- Server auto-restarts on changes

### Testing

Run the test suite:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

### Testing with basic-host

The basic-host is useful for testing MCP App functionality:

```bash
# Terminal 1: Start MCP server
npm start

# Terminal 2: Start basic-host
cd /path/to/mcp-apps-host/examples/basic-host
SERVERS='["http://localhost:3001/mcp"]' npm run serve

# Open http://localhost:8080
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` or proper types
- Use strict type checking (already configured)

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Use trailing commas in multiline objects/arrays
- Maximum line length: 100 characters

### Naming Conventions

- **Files**: kebab-case (`grafana-client.ts`)
- **Classes**: PascalCase (`GrafanaClient`)
- **Functions**: camelCase (`buildEmbedUrl`)
- **Constants**: UPPER_SNAKE_CASE (`RESOURCE_MIME_TYPE`)
- **Interfaces**: PascalCase with descriptive names (`RenderPanelInput`)

### Comments

- Use JSDoc for public APIs
- Explain "why", not "what"
- Keep comments up-to-date with code changes
- Remove commented-out code

Example:
```typescript
/**
 * Builds a Grafana embed URL with time range and variables.
 *
 * @param baseUrl - Grafana instance URL
 * @param params - Panel parameters (dashboard, panel ID, time range)
 * @returns Complete embed URL for iframe
 */
export function buildEmbedUrl(baseUrl: string, params: EmbedParams): string {
  // Implementation...
}
```

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests after the first line

Example:
```
Add support for Grafana template variables

- Extract variables from dashboard metadata
- Render variable dropdowns in control bar
- Update panel URL when variables change

Closes #123
```

### File Structure

Place new files in appropriate directories:

```
src/
├── server/          # Server-side code
│   ├── main.ts      # Entry point
│   ├── server.ts    # MCP server setup
│   └── lib/         # Server utilities
└── ui/              # Client-side code
    ├── components/  # UI components
    ├── lib/         # Client utilities
    └── styles/      # CSS files
```

## Project Structure

- `src/server/` - MCP server implementation
- `src/ui/` - MCP App UI implementation
- `scripts/` - Utility scripts
- `tests/` - Test files
- `dist/` - Build output (not committed)

## Documentation

- Update README.md for user-facing changes
- Update JSDoc comments for API changes
- Add examples for new features
- Update CHANGELOG.md (see below)

## Release Process

We use semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

### CHANGELOG

Update CHANGELOG.md for all user-visible changes:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Modified behavior description

### Fixed
- Bug fix description
```

## Questions?

- Open an issue with the "question" label
- Check existing issues and discussions
- Review the README.md and documentation

## License

By contributing to Grafana MCP App, you agree that your contributions will be licensed under the Apache License 2.0.
