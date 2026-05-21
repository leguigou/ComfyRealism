# ComfyRealism Project Context

This workspace is a full-stack application connecting a React chat interface to a ComfyUI backend for real-time image generation.

## Agent Mandates
- **Stability**: Never modify `backend/index.ts` without ensuring that the ComfyUI polling logic remains robust.
- **UI/UX**: 
    - The chat interface must always feel responsive.
    - **Layout Stability**: Maintain the "Overlay Sidebar" pattern. Never use layouts that "push" or "shrink" the main content (to avoid jittering).
    - **Smooth Scrolling**: Avoid CSS `scroll-behavior: smooth` on chat containers; use the custom JS `smoothScrollTo` for reliable anchoring.
    - **Header Logic**: The `chat-header` must remain visible when near the bottom of the page (50px threshold) to prevent flickering feedback loops.
- **Verification**: When fixing generation issues, always verify the connection to `http://127.0.0.1:8188` first.
- **Quality**: Always run `npm run lint` and `npx tsc` in the `frontend` directory after changes. Use `.cmd` suffix on Windows.

## Tech Stack
- **Frontend**: Vite + React + TypeScript + ESLint (strict hooks rules).
- **Backend**: Express + Node.js (Port 3001) + better-sqlite3.
- **Security**: Passwords must be hashed using `bcryptjs`. Endpoints for personal data (`/api/users/me`) must use the `authenticate` middleware.

## Architectural Patterns
- **Sidebar**: Fixed position overlay with a `z-index` higher than the chat. It uses a `sidebar-overlay` backdrop for closing on mobile/desktop.
- **User Identity**: Managed via a "Profile Pill" in the sidebar footer.
- **Avatars**: Stored as URLs in the DB. Fallback to initials if `avatarUrl` is null. Avatars selected from the library must use `object-fit: cover`.
- **Modals**: Settings and Image Pickers should use a central overlay with `z-index` between 3000-4000.

## Development Rules
- **Versioning & Logs**: Always update `DEVELOPMENT_LOGS.md` and bump version in both `package.json` files.
- **Bilingual Support**: All UI strings must be added to `frontend/src/i18n.ts` for both `fr` and `en`.
- **Git Push Policy**: Ask for confirmation before pushing to GitHub, EXCEPT for critical bug fixes.
- **React Hooks**: Wrap data-fetching functions in `useCallback` when they are dependencies of `useEffect`.
- **Linting**: If `useEffect` must trigger a state update for initial fetch, suppress `react-hooks/set-state-in-effect` with a comment.
- **Clean Code**: Prefer small, single-responsibility files (< 400 lines). Document complex logic with JSDoc.
