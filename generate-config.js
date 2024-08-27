import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// To get the directory name (similar to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the environment variables (use default values if not set)
const VITE_ASISTENTES_URL = process.env.VITE_ASISTENTES_URL || "http://127.0.0.1:8000";
const VITE_APP_ENDPOINTS = process.env.VITE_APP_ENDPOINTS || "APIdocs,migracion,core,capacitacion,pseudoCode";

// Define the content of config.js
const configContent = `
window.__RUNTIME_CONFIG__ = {
  VITE_ASISTENTES_URL: "${VITE_ASISTENTES_URL}",
  VITE_APP_ENDPOINTS: "${VITE_APP_ENDPOINTS}"
};
`;

// Write the configContent to public/config.js
const configPath = path.join(__dirname, 'public', 'config.js');
fs.writeFileSync(configPath, configContent);

console.log(`Generated ${configPath} with VITE_ASISTENTES_URL=${VITE_ASISTENTES_URL} and VITE_APP_ENDPOINTS=${VITE_APP_ENDPOINTS}`);
