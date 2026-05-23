import express from 'express';
import axios from 'axios';
import pkg from '../../package.json';

const router = express.Router();

// Get current local version and check for updates on GitHub
router.get('/check', async (req, res) => {
  try {
    const currentVersion = pkg.version;
    const repoUrl = 'https://api.github.com/repos/leguigou/ComfyRealism/releases/latest';
    
    const response = await axios.get(repoUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ComfyRealism-Update-Checker'
      },
      timeout: 5000
    });

    const latestRelease = response.data;
    const latestVersion = latestRelease.tag_name.replace('v', '');
    
    res.json({
      currentVersion,
      latestVersion,
      updateAvailable: latestVersion !== currentVersion,
      releaseUrl: latestRelease.html_url,
      releaseNotes: latestRelease.body,
      publishedAt: latestRelease.published_at
    });
  } catch (error: any) {
    console.error('[UpdateCheck] Error:', error.message);
    // If GitHub fails, still return the local version
    res.json({
      currentVersion: pkg.version,
      error: 'Impossible de vérifier les mises à jour sur GitHub'
    });
  }
});

export default router;
