# Development Logs

## Current Version: v.1.5.3

---

### v.1.5.3 (2026-05-24)
- **Update Tab & UI Refinements**:
    - **GitHub Update Checker**: New "Update" tab in settings to check for the latest versions on GitHub and view release notes.
    - **Auto-Expanding Chat Input**: The chat input now grows automatically with the text content.
    - **Mobile Layout Optimization**: Closer button placement on mobile to save screen real estate.
    - **Enhanced Aesthetics**: Reduced transparency and added blur effects to the input container for a more premium feel.
    - **Visual Cues**: Added a distinct red border to the clear button in the input.

### v.1.5.2 (2026-05-23)
- **Chat Input Layout Optimization**:
    - **Adaptive Layout**: Implemented a dynamic layout for the chat input that switches from a compact horizontal view (when empty) to a stacked vertical view (when text is present). This prevents horizontal layout shifts when the "clear text" button appears.
    - **Symmetrical Design**: Ensured perfectly symmetrical spacing for the toggle button and input area on mobile devices by adjusting the wrapper's side padding.
    - **Improved Clear Button**: Replaced the text-based cross with a new `XIcon` component and styled it as a discrete circular button with a gray border and subtle red hover state.
    - **Button Positioning**: Refactored action buttons (Clear and Send) to reside in a dedicated bottom-right row within the input box during vertical mode for better UX on longer prompts.

---

### v.1.5.1 (2026-05-23)
- **UI/UX Refinements**:
    - **Chat Input Redesign**: Extracted the options toggle button (`+`) out of the input box, making it a standalone circular button perfectly aligned in height with the input box.
    - **Theme Compatibility**: Replaced hardcoded dark mode colors in the chat input and toggle button with CSS variables (`var(--social-bg)`) to ensure proper display in light mode.
    - **Dropdown Interaction**: Fixed an issue where clicking outside the top-right session menu (⋮) wouldn't close it. The invisible overlay was replaced with a robust `useRef` and `useEffect` approach for detecting outside clicks.
    - **Red Destructive Actions**: The "Delete" option in the session dropdown menu is now consistently red, rather than only turning red on hover.

---

### v.1.5.0 (2026-05-22)
- **Mobile Experience & Interactions**:
    - **Pinch-to-Zoom**: Implemented multi-finger zoom and single-finger pan in the image lightbox for mobile devices. Supports up to 4x magnification.
    - **Enhanced Click Feedback**: Upgraded the visual confirmation system to support `touchstart` for instant response on mobile. Added a green "glow" effect and increased priority to ensure all interactive elements provide clear feedback.
    - **Header Design Integrity**: Excluded header buttons from the flash feedback to preserve their clean, minimalist aesthetic.
- **Stability & Performance**:
    - **Scroll Crash Fix**: Resolved a critical `ReferenceError` in the scroll handler that was causing random application reloads.
    - **Empty Card Elimination**: Refined the chat rendering logic to automatically hide messages with redundant or missing content, ensuring a dense and relevant discussion thread.
- **Backend & Logic**:
    - **Prompt Flow Optimization**: Fixed the synchronization between LLM enhancement and ComfyUI generation to ensure enriched prompts are correctly applied and displayed.
- **Maintenance**:
    - Synchronized versions across backend and frontend to `v.1.5.0`.

---

### v.1.4.0 (2026-05-22)
- **UI/UX Transformation**:
    - **Header Redesign**: Completely rebuilt the header with rounded components. Includes a 2-line circular burger menu, a pill-style AI toggle, and a unified action group for "New Chat" and session management.
    - **Chat Input Refinement**: Optimized the input box for a more compact and professional look. It now expands into a rounded rectangle rather than a distorted oval for multi-line text, features a white circular send button, and has a dedicated focus border.
    - **Session Dropdown**: Added a floating menu (⋮) to the header for quick access to "Rename" and "Delete" actions.
    - **Fixed Transparency**: Header and Input areas are now fixed and transparent, allowing chat content to flow seamlessly underneath.
- **Backend & Logic Robustness**:
    - **LLM Cleanup**: Upgraded the LLM response handler to automatically strip Markdown backticks and extract valid JSON even when the model returns duplicate blocks.
    - **Session Sync Fix**: Resolved a bug where bot messages were incorrectly filtered out if their text matched the user's prompt during session merges.
- **Maintenance**:
    - Synchronized versions across backend and frontend to `v.1.4.0`.

---

### v.1.3.1 (2026-05-21)
- **UI/UX Stability Fixes**:
    - Converted the sidebar to a **fixed overlay layout** with a backdrop blur. This prevents the chat content from shifting or resizing when the menu is toggled, providing a much more stable and professional feel.
    - Resolved critical layout "jittering" and "jumping" at the bottom of the chat by disabling CSS `scroll-behavior: smooth` and implementing a robust JavaScript-driven scroll anchor.
    - Fixed header "flickering" loop by forcing header visibility when scrolled within 50px of the page bottom.
    - Improved `chat-header` transition logic by using `display: none` for hidden states, preventing unexpected height changes.
- **Visual Enhancements**:
    - Fully styled the **Retry** button for failed generations to match the project's modern aesthetic (accent background, hover effects, and shadow).
    - Improved error feedback with a dedicated container for generation failures, including title, details, and warning icon.
- **Maintenance**:
    - Restored service accessibility by clearing hanging background processes on ports 3001 and 5173.
    - Synchronized versions across backend and frontend to `v.1.3.1`.

---

### v.1.3.0 (2026-05-21)
- **React Stability Overhaul**: Fixed critical React hook violations including "Cannot access refs during render", synchronous state updates in effects, and variable declaration order issues.
- **UI Aesthetics**:
    - Reduced spacing between images and action buttons in the feed for a tighter, more cohesive look.
    - Added transparency (0.5 opacity) to the favorite heart icon when inactive to make it more discreet on images.
    - Reversed the "shimmer" animation direction; it now flows from left to right.
- **Mobile UX**: Improved readability of the welcome screen text on small screens by increasing `line-height` and optimizing font size.
- **Code Quality**: Cleaned up ESLint warnings, removed unused directives, and improved type safety in `App.tsx`.

---

### v.1.2.68 (2026-05-20)
- **New Refresh Icon**: Integrated the custom SVG design for all refresh and regenerate buttons.
- **Cache Invalidation**: Updated Service Worker cache version to force immediate UI updates for all users.
- **Refactoring Strategy**: Proposed a senior-level architecture plan to decouple `App.tsx` into specialized components and hooks.

---

### v.1.2.67 (2026-05-20)
- **UI Refinement**: Improved welcome screen typography with increased `line-height` and padding for better readability on mobile devices.
- **Versioning Standard**: Synchronized project version to `v.1.2.65` across all branches.

---

### v.1.2.64 (2026-05-20)
- **Log System Overhaul**: Development logs are now loaded directly from `DEVELOPMENT_LOGS.md` using `react-markdown`. This ensures a single source of truth and a cleaner `App.tsx`.
- **Robust Process Cleanup**: Updated `run.bat` and `run.sh` to explicitly terminate processes on ports 3001 and 5173 before launching.
- **Enhanced Mobile Double-Tap**: Increased double-tap detection window to 350ms for better responsiveness.
- **Discreet Favorite Button**: Moved the heart icon directly onto the image with a minimalist design.
- **Lightbox Improvements**: Added double-click to favorite in full-screen mode and improved navigation.
- **Navigation & UX Fixes**: Fixed gallery-to-chat navigation, sidebar overlay blockage, and AI toggle visual feedback.
- **Build Fixes**: Resolved TypeScript errors by adding missing translation keys.

---

### v.1.2.63 (2026-05-18)
- **Favorites System**: Added the ability to mark images as favorites with a heart icon. Favorited images can be easily filtered in the gallery.
- **Cinematic Auto-Scroll**: Replaced the abrupt browser scroll with a custom, buttery-smooth cubic easing animation. The camera now gracefully glides to the newly generated image.
- **Persistent Disk Cleanup**: Deleting an image or a chat session from the UI now physically removes the corresponding `.webp` and thumbnail files from the server's disk, preventing storage bloat.
- **Dynamic User Directories**: Images and thumbnails are now seamlessly organized into dedicated sub-directories (`images/<user_id>` and `images/thumbnails/<user_id>`) for secure, multi-user isolation.
- **Format Harmonization**: Successfully migrated all legacy `.png` files to the optimized `.webp` format automatically.

---

### v1.2.62-multiuser (2026-05-17)
- **User Usage Statistics**: Administrators can now see the total number of images and disk space used by each user in the Administration panel.
- **Admin Password Reset**: Added the ability for administrators to reset any user's password directly from the UI.
- **Enhanced Admin UI**: Improved the user management layout with better visibility on mobile, a modern toggle for admin rights, and a clearer "Add User" button.
- **Multi-User Isolation**: Implemented a complete authentication system with bcrypt hashing. Users now have isolated sessions, messages, and galleries.
- **Admin CLI Tool**: Added a terminal-based utility (`cli.ts`) for managing users via SSH.

---

### v1.2.60-beta (2026-05-17)
- **Selective Bouncing Loader**: The bouncing ball animation is now exclusively shown during "Generating" and "AI Thinking" states. In the "Waiting" state, only the text is displayed to maintain a clear visual distinction between queueing and active processing.

---

### v1.2.59-beta (2026-05-17)
- **Reversed Status Animation**: The color-shifting shimmer effect on status text now moves diagonally from the bottom-right to the top-left, creating a reversed visual flow (right-to-left) as requested.

---

### v1.2.58-beta (2026-05-17)
- **Message Rendering Fix**: Resolved an issue where user prompts could be hidden when AI interpretation was enabled. The UI now correctly falls back to the original prompt if the optimized text is missing, and the duplicate detection logic has been improved to ensure visibility of all unique content.

---

### v1.2.57-beta (2026-05-17)
- **Refined Status Animation**: The color-shifting effect is now exclusive to "Generating" and "AI Thinking" states. The animation has been updated to move diagonally (135°) from left to right for a more dynamic visual experience.

---

### v1.2.56-beta (2026-05-17)
- **Timer Visibility Fix**: Isolated the animated status text effect to prevent it from making the generation timer invisible. The timer is now clearly visible with its standard styling.

---

### v1.2.55-beta (2026-05-17)
- **Animated Status Text**: Applied a smooth, color-shifting shimmer effect to the "Generating..." and "AI Thinking..." status text, mirroring the "intelligent" look of the AI-active input box.

---

### v1.2.54-beta (2026-05-17)
- **AI Visual Feedback**: Added an animated, color-shifting glowing border to the input box when AI optimization is enabled, providing intuitive feedback on the current generation mode.

---

### v1.2.53-beta (2026-05-17)
- **Timer Formatting**: Durations exceeding 60 seconds are now formatted as "XmXXs" (e.g., 1m05s) for better readability.
- **Flicker-Free Timer**: Hardened the WebSocket update logic to prevent the generation timer from disappearing or flickering during state transitions.

---

### v1.2.52-beta (2026-05-17)
- **Smart Auto-Scroll**: Fixed aggressive auto-scrolling that prevented users from reading previous messages during generation. Scroll now only triggers once on submission and once on image completion.
- **Timer Stability**: Resolved an issue where the generation counter would occasionally flicker or reset to zero during updates.

---

### v1.2.51-beta (2026-05-17)
- **Live Generation Timer**: Added a real-time counter below the "Generating..." status in the chat bubbles, showing elapsed seconds.
- **Duration Persistence**: The backend now calculates and stores the final generation duration in the SQLite database.
- **Info Panel Update**: The generation duration is now displayed in the "Info" panel of each bot message.

---

### v1.2.50-beta (2026-05-17)
- **Dynamic API Port Discovery**: Refactored the frontend's API detection logic to support multiple external machines. It now automatically maps `55X00` UI ports to `55X01` API ports, enabling seamless multi-instance external access.

---

### v1.2.49-beta (2026-05-17)
- **Dynamic Docker Environment**: Refactored `docker-compose.yml` and `docker-compose.production.yml` to use variable placeholders (`${VAR}`). This ensures that environment variables set in Dokploy's UI correctly override the default values.
- **Beta Branch Initiation**: First update on the new `beta` development branch.

---

### v1.2.48 (2026-05-17)
- **Critical Backend Restoration**: Restored essential functions (`processQueue`, `getWorkflow`, `parseComfyError`) that were accidentally omitted during previous refactoring.
- **Robust WebSocket Handover**: Simplified the WebSocket upgrade logic to be more resilient to various proxy header configurations.
- **Global Error Handling**: Added `uncaughtException` and `unhandledRejection` handlers to the backend to prevent silent crashes and improve debuggability.

---

### v1.2.47 (2026-05-17)
- **Proxy-Agnostic Routing**: Refactored backend routes to be compatible with various proxy configurations (like Dokploy/Traefik). All API routes are now handled by a router mounted at both `/` and `/api`.
- **Flexible WebSockets**: Updated the WebSocket server to accept connections on both `/api/ws` and `/ws`, ensuring real-time updates work even if the proxy strips the path prefix.
- **Improved Code Quality**: Cleaned up the backend routing logic by centralizing API endpoints into a dedicated router.

---

### v1.2.46 (2026-05-17)
- **Message Ordering Fix**: Removed the timestamp update upon generation completion. Messages now strictly maintain their original creation order in the chat history, preventing "jumping" blocks when the queue is active.

---

### v1.2.45 (2026-05-17)
- **Asynchronous Message Queuing**: Users can now send multiple prompts sequentially without waiting for the previous generation to finish.
- **UI State Refactoring**: Decoupled the "Send" button from the generation state. The button now remains active for new input while previous tasks process in the background.
- **Per-Message Status Tracking**: Each message now displays its own specific state (AI Thinking, Waiting in Queue, or Generating), providing better feedback for concurrent tasks.
- **Enhanced Reliability**: Implemented a counter-based state for AI enhancement (LLM) to handle multiple simultaneous interpretations.

---

### v1.2.44 (2026-05-16)
- **WebSocket Synchronization**: Fixed a bug where the `clientId` used for generation was not correctly synchronized with the backend's WebSocket relay.
- **Improved Tracking**: The frontend now uses the `clientId` assigned by the backend upon connection, ensuring that generation progress updates are correctly received.

---

### v1.2.43 (2026-05-16)
- **Routing Conflict Fix**: Removed the proxy-agnostic middleware introduced in v1.2.42 which caused internal routing failures due to double-prefixing.
- **Explicit Dual Routing**: Replaced the middleware with an explicit `apiRouter` mounted at both `/` and `/api`. This guarantees native Express compatibility with Dokploy's Traefik path stripping behavior without side effects.

---

### v1.2.42 (2026-05-16)
- **Proxy-Agnostic Routing**: Attempted to implement a middleware to handle Traefik path stripping (later reverted in v1.2.43).

---

### v1.2.41 (2026-05-16)
- **Routing Bug Fix**: Resolved double `/api/api/` prefix issue in production that caused 404 errors. `API_BASE` now correctly identifies the root domain.
- **WebSocket Fix**: Standardized WebSocket URL construction to consistently use the `/api/ws` path across all environments.

---

### v1.2.40 (2026-05-16)
- **Routing Bug Fix**: Resolved double `/api/api/` prefix issue in production that caused 404 errors. `API_BASE` now correctly identifies the root domain.
- **WebSocket Fix**: Standardized WebSocket URL construction to consistently use the `/api/ws` path across all environments.

---

### v1.2.40 (2026-05-16)
- **Privacy & Anonymization**: Removed all hardcoded personal domains from the source code, logs, and configuration.
- **Dynamic Domain Logic**: Implemented dynamic parent domain detection for cookies and domain-agnostic path routing for the API.
- **Security**: The project is now fully anonymized and ready for public hosting or deployment on any domain without leaking personal infrastructure details.

---

### v1.2.39 (2026-05-16)
- **Infrastructure Overhaul (Solution B)**: Switched to a single domain model using path-based routing. Both frontend and backend now run under the same host.
- **WebSocket Refactoring**: Moved the backend WebSocket server to the `/api/ws` path and updated the frontend to connect via the unified production domain.
- **Port-less Architecture**: Eliminated the need for explicit port numbers (like `:3001`) in production, resolving SSL protocol conflicts.
- **CORS Elimination**: By using a single domain for all services, cross-origin issues and cookie sharing restrictions are completely bypassed.

---

### v1.2.38 (2026-05-16)
- **Critical Bug Fix**: Resolved "white screen" (frontend crash) by reordering variable definitions. The `lang` and `t` variables are now defined at the top of the `App` component, making them safely available to all state initializers and functions.
- **Maintenance**: Improved code stability for local development and production.

---

### v1.2.37 (2026-05-16)
- **Production SSL Fix**: Prevented the frontend from appending port `:3001` when running on HTTPS custom domains, resolving `ERR_SSL_PROTOCOL_ERROR`.
- **Advanced Domain Discovery**: Improved automatic API detection for custom infrastructure to ensure seamless connectivity between UI and API subdomains.

---

### v1.2.36 (2026-05-16)
- **Production UX Fix**: Implemented automatic API subdomain detection. If the app runs on `comfyui.*`, it now automatically tries to reach the API on `api-comfy.*`.
- **Debug Improvement**: Added explicit error reporting on login failure, displaying the attempted API URL to help users diagnose connectivity issues.
- **Resilience**: The frontend is now more capable of running on custom domains without requiring manual environment variable configuration at build time.

---

### v1.2.33 (2026-05-16)
- **Auth Security Fix**: Updated cookie configuration for production environments. Added `secure: true` and `sameSite: 'none'` support to ensure login works across different subdomains (e.g., UI on one domain, API on another).
- **Environment Awareness**: The authentication system now automatically adapts cookie security settings based on the `NODE_ENV` variable.

---

### v1.2.32 (2026-05-16)
- **Deployment UX**: Enhanced frontend API discovery logic to support custom domains and production environments like Dokploy.
- **Environment Support**: Added support for `VITE_API_URL` environment variable, allowing the frontend to point to any backend endpoint.
- **Smart Fallback**: Improved automatic detection of API endpoints when running on standard HTTP/HTTPS ports.

---

### v1.2.31 (2026-05-16)
- **Dynamic Config**: Refactored the backend to prioritize ComfyUI URL settings stored in the database.
- **Fix**: WebSocket connections now correctly use the URL configured via the UI, resolving `ECONNREFUSED` issues in Docker and remote environments.
- **Transparency**: Added a new startup log `Startup ComfyUI URL` to confirm the loaded configuration from all sources (Env, DB, or Default).

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
