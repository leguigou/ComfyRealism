# ComfyRealism Project Context

This workspace is a full-stack application connecting a React chat interface to a ComfyUI backend for real-time image generation.

## Agent Mandates
- **Stability**: Never modify `backend/index.ts` without ensuring that the ComfyUI polling logic remains robust.
- **UI/UX**: The chat interface must always feel responsive. Any new features should include appropriate loading states and error handling for both the backend and ComfyUI.
- **Verification**: When fixing generation issues, always verify the connection to `http://127.0.0.1:8188` first.
- **Quality**: Always run `npm run lint` and `npx tsc` in the `frontend` directory after changes. Use `.cmd` suffix on Windows to avoid execution policy issues.

## Tech Stack
- **Frontend**: Vite + React + TypeScript + ESLint (strict hooks rules).
- **Backend**: Express + Node.js (Port 3001) + ts-node-dev.
- **Integration**: Axios for API calls, ComfyUI for image processing.

## Development Rules
- **Versioning & Logs**: Always update `DEVELOPMENT_LOGS.md` and bump the version number when a backup is requested.
- **Backup Policy**: Never include the `images/` directory in project backups. Focus only on source code, configurations, and the database.
- **Bilingual Support**: All UI strings must support both English and French.
- **Git Push Policy**: Ask for confirmation before pushing to GitHub, EXCEPT for critical bug fixes (e.g., connection issues, build failures, crashes) which should be pushed immediately to ensure environment stability.
- **React Hooks**: Wrap data-fetching functions in `useCallback` when they are dependencies of `useEffect`.
- **Linting**: If `useEffect` must trigger a state update for initial fetch, suppress `react-hooks/set-state-in-effect` with a comment if necessary, but prefer better patterns if possible.
- **Error Handling**: Implement visual indicators for backend status (e.g., `backendError` state in `App.tsx`).
