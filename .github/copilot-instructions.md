# Copilot Coding Agent Instructions

## Project Overview
Monochrome is a minimalist, unlimited music streaming web application built with HTML, CSS, and JavaScript. Deployed on Vercel.

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend/Services: Firebase, Appwrite
- Build: Vite (npm/bun)
- Deployment: Vercel
- Linting: Bun (`bun run lint`)

## Efficiency Rules (IMPORTANT - Save Premium Credits)
1. **Plan before coding**: Always analyze the full scope of changes needed BEFORE writing any code. Create a plan first.
2. **Batch changes**: Make all related changes in a single commit rather than multiple small commits.
3. **Don't over-engineer**: Keep solutions simple and minimal. Avoid unnecessary abstractions.
4. **Read existing code first**: Always check existing implementations before creating new ones to avoid duplication.
5. **Use context7 MCP**: When unsure about a library API, use context7 to get accurate docs instead of guessing and iterating.
6. **Use sequential-thinking MCP**: For complex problems, use sequential-thinking to break down the problem before coding.
7. **Test locally first**: Always run `npm ci && npx vite build` to verify changes compile before requesting review.
8. **Minimize iterations**: Aim to get it right on the first attempt. Think carefully about edge cases upfront.

## Code Style
- Use ES6+ modern JavaScript
- Prefer const over let, avoid var
- Use async/await over .then() chains
- Keep functions small and focused
- Add JSDoc comments for complex functions only
- Use meaningful variable/function names
- CSS: Use CSS custom properties for theming
- Follow existing code patterns in the project

## File Structure
- `/src` - Source files
- `/public` - Static assets
- `/.github` - GitHub configurations

## Common Tasks
- Build: `npm ci && npx vite build`
- Lint: `bun run lint` (requires Bun installed)
- Dev: `npx vite`

## Problem Solving Approach
1. Understand the problem completely before starting
2. Check if similar functionality already exists in the codebase
3. Plan the minimal set of changes needed
4. Implement with proper error handling
5. Test the build succeeds
6. Create a clean, focused PR
