# Development Logs

## Current Version: 1.2.12

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
