# Development Logs

## Current Version: 1.2.30

---

### v1.2.30 (2026-05-16)
- **Transparency**: Added explicit logging of configured ComfyUI HTTP and WebSocket URLs on startup to aid in environment debugging.
- **Maintenance**: Verified environment variable priority for `COMFY_URL`.

---

### v1.2.29 (2026-05-16)
- **Git Security**: Added `.gemini/agents/` to `.gitignore` to prevent agent configuration files from being committed.

---

### v1.2.28 (2026-05-16)
- **Fix**: Resolved `ECONNREFUSED` error on Raspberry Pi/Docker environments by ensuring WebSocket connections use the same dynamic URL as HTTP requests.
- **Robustness**: Removed hardcoded `127.0.0.1` addresses in the backend. The system now correctly derives the WebSocket URL from the configured `COMFY_URL`.
- **Environment Support**: Added support for `PORT` environment variable in the backend.

---

### v1.2.27 (2026-05-16)
- **Production Readiness**: Added `docker-compose.production.yml` specifically for deployment on VPS or Dokploy, using pre-built images from GHCR.
- **Documentation**: Updated `README.md` with the GitHub Actions build status badge and refined installation instructions for Docker Production mode.
- **Branding**: Integrated the project's official build status into the repository homepage.

---

### v1.2.26 (2026-05-16)
- **Build Fix**: Resolved a TypeScript compilation error in the frontend caused by a stale reference to `comfyModelsPath`. This was blocking the Docker image build.
- **Node.js Upgrade**: Updated both Frontend and Backend Dockerfiles to use Node.js 22 (LTS) to improve performance and avoid deprecation warnings.
- **Improved Reliability**: Verified local compilation with `tsc` to ensure image builds succeed on GitHub Actions.

---

### v1.2.25 (2026-05-16)
- **CI/CD Fix**: Fixed Docker image tag naming by forcing lowercase names (required by GHCR/Docker standards).
- **Future-Proofing**: Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` to address Node.js 20 deprecation warnings in GitHub Actions.
- **Workflow Optimization**: Standardized container naming for better consistency in the registry.

---

### v1.2.24 (2026-05-16)
- **UI Readability Fix**: Fixed "gray on gray" text issue in the light theme by darkening the default text color and explicitly styling `.message-text`.
- **Theme Polish**: Updated `.light` theme variables to provide better contrast across the entire interface (Text, Headings, and Backgrounds).

---

### v1.2.23 (2026-05-16)
- **CI/CD Integration**: Added GitHub Actions workflow to automatically build and push Docker images to GitHub Container Registry (GHCR).
- **Automated Infrastructure**: The project now supports automated builds for both frontend and backend on every push to the main branch.

---

### v1.2.22 (2026-05-16)
- **UI Refinement**: Reduced sidebar item height (40px) and adjusted alignment for a sleeker, more balanced "capsule" look.
- **Improved Spacing**: Tuned padding and horizontal alignment to ensure titles are closer to the left edge without touching it, maximizing space for text.

---

### v1.2.21 (2026-05-16)
- **UI Refinement**: Removed vertical gaps between sidebar session items for a more compact and continuous list.
- **Improved Spacing**: Adjusted padding to maintain clarity while increasing information density in the sidebar.

---

### v1.2.20 (2026-05-16)
- **UI Redesign**: Overhauled the sidebar session list with a modern "pill" style (capsule design).
- **Improved Ergonomics**: Standardized item heights (46px) and added smooth hover/active transitions.
- **Scrollbar Polish**: Refined the sidebar scrollbar for a cleaner look.
- **Visual Consistency**: Removed the legacy side indicator line in favor of a full-pill active state.

---

### v1.2.18 (2026-05-16)
- **LLM Configuration**: Added a "Test Connection" button for the LLM API URL in Settings. Works with OpenAI and Ollama compatible APIs.
- **Robustness**: Integrated the same non-JSON response handling for LLM tests as used for ComfyUI.
- **New API Endpoint**: Created `/api/llm-check` in the backend for secure health checking of the configured LLM service.

---

### v1.2.18 (2026-05-16)
- **Bug Fix**: Resolved the "Unexpected token <" error in the connection tester. The frontend now gracefully handles non-JSON responses (like HTML error pages from proxies or Nginx) and provides a clear error message.
- **Improved Resilience**: Added Content-Type validation before parsing API responses in the settings panel.

---

### v1.2.17 (2026-05-16)
- **Accessibility Fix**: Improved the touch target of the "Test Connection" button on mobile by increasing its height and padding.
- **Responsive UI**: Standardized button heights (min 44px) on mobile devices for better ergonomics and usability.

---

### v1.2.16 (2026-05-16)
- **UI Polish**: Added color-coded status messages (Green for success, Red for error) for ComfyUI and LLM connection tests.
- **Improved Visibility**: Enhanced the visibility of status feedback in the settings panel with dedicated CSS styles.

---

### v1.2.15 (2026-05-16)
- **Configuration UX**: Added a "Test Connection" button next to the ComfyUI URL in Settings. Users can now instantly verify if their backend is reachable.
- **Backend Validation**: Implemented a new `/api/comfy-check` endpoint to securely proxy health checks to ComfyUI.

---

### v1.2.14 (2026-05-16)
- **Dockerization**: Added `Dockerfile` for both frontend and backend, along with a root `docker-compose.yml`.
- **Infrastructure as Code**: Optimized containers for production (Nginx for frontend, Node slim for backend).
- **Persistence**: Configured Docker volumes to ensure that the SQLite database, custom workflows, and generated images are preserved across container restarts.
- **Network Compatibility**: Added `host.docker.internal` support to allow the backend container to easily communicate with a ComfyUI instance running on the host machine.

---

### v1.2.13 (2026-05-16)
- **Robust Error Handling**: Implemented a comprehensive error parsing system for ComfyUI. The backend now detects specific failures such as "Out of VRAM", "Missing Model", or "Node Errors".
- **Infinite Loop Prevention**: Added a 5-minute timeout to the generation polling loop to prevent the backend from hanging indefinitely on silent failures.
- **UI Error Feedback**: Updated the chat interface to display detailed error messages and added a "Retry" button for failed generations.
- **Automatic State Recovery**: The system now correctly clears the queue and updates the message status when a fatal generation error occurs.

---

### v1.2.12 (2026-05-16)
- **Linux Support**: Added `run.sh` script to simplify launching the full-stack application on Linux/Raspberry Pi.
- **Portability**: Standardized paths in the start script for easier deployment across different environments.

---

### v1.2.11 (2026-05-16)
- **Branding Update**: Set the application's browser tab title to "ComfyRealism".

---

### v1.2.10 (2026-05-16)
- **Backup Policy Enforcement**: First backup following the new rule to exclude the `images/` directory. Backups are now significantly smaller and focused on code.
- **Maintenance**: Verified general system stability and configuration cleanliness.

---

### v1.2.9 (2026-05-16)
- **API Integration**: Switched from local directory scanning to ComfyUI API for fetching the list of checkpoint models.
- **UI Simplification**: Removed the manual model path setting as it's no longer needed.
- **Improved Reliability**: The system now automatically queries the active ComfyUI instance to get the list of available models, ensuring compatibility even with remote instances.

---

### v1.2.8 (2026-05-16)
- **UI Bug Fix**: Fixed visibility of the settings close button on hover when using the light theme.
- **CSS Variable Correction**: Replaced undefined CSS variables with standard theme variables (`--accent` and `--sidebar-hover`) for better consistency.

---

### v1.2.7 (2026-05-16)
- **UI Improvement**: Added a circular close button with a cross icon in the top-right corner of the Settings modal for better accessibility.
- **Visual Polish**: Added hover effects and rotation animation to the new close button.

---

### v1.2.6 (2026-05-16)
- **Feature Finalization**: Verified and secured the on-the-fly thumbnail generation system.
- **Auto-Recovery**: Confirmed system's ability to recreate the entire `thumbnails` directory automatically if deleted.

---

### v1.2.5 (2026-05-16)
- **Dynamic Thumbnails**: Implemented on-the-fly thumbnail generation. If a thumbnail is missing on the disk, the server now automatically recreates it from the original HD image using `sharp`.
- **Media Resilience**: Users can now safely clear the `thumbnails` directory without breaking the gallery interface.

---

### v1.2.4 (2026-05-16)
- **Directory Relocation**: Moved the `images` directory from `backend/images` to the project root (`./images`) for better organization.
- **Auto-creation**: Implemented automatic directory creation for `images` and `thumbnails` at the root level if they are missing.
- **Backend Cleanup**: Centralized media storage outside of the backend source folder.

---

### v1.2.3 (2026-05-16)
- **Stability Fix**: Resolved "white screen" issue by fixing TypeScript strict mode errors and missing translation keys after i18n refactoring.
- **Type Safety**: Improved type definitions for settings tabs and message statuses.

---

### v1.2.2 (2026-05-16)
- **Translation Refactoring**: Extracted all UI strings into a dedicated `i18n.ts` file for better maintainability and easier addition of new languages.
- **UI Enhancement**: Integrated the "Logs & Version" tab in the settings menu to view the current version and development history.
- **Code Cleanup**: Reduced `App.tsx` size by moving static translation data out.

---

### v1.2.1 (2026-05-16)
- **Initial Log Creation**: Established the development logging system.
- **Bilingual Strategy**: Enforced English and French translation requirement for all new features.
- **Versioning Policy**: Automated version bumping on backup requests.
- **UI Integration**: Planned access to logs and versioning in Settings.

---

### Historique Précédent (Tentative de reconstruction)
- **v1.2.0**: Intégration de SQLite avec `better-sqlite3` et gestion de l'historique en base de données.
- **v1.1.0**: Gestion des files d'attente et polling ComfyUI robuste.
- **v1.0.0**: Lancement initial de l'interface ComfyRealism avec support WebSocket et API Express.
