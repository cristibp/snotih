const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getLatestModificationDate() {
  try {
    const gitDate = execSync('git log -1 --format="%cd" --date=format:"%d.%m.%Y %H:%M"', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../..'),
    }).trim();
    if (gitDate) return gitDate;
  } catch (e) {
    // ignore git error and fallback to system time
  }

  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${d}.${m}.${y} ${hh}:${mm}`;
}

function updateBuildInfo() {
  const lastModified = getLatestModificationDate();
  const targetDir = path.join(__dirname, '../src/constants');
  const targetFile = path.join(targetDir, 'buildInfo.json');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const data = JSON.stringify({ lastModified }, null, 2);
  fs.writeFileSync(targetFile, data, 'utf8');
  console.log(`[BuildInfo] Updated last modified date: ${lastModified}`);
}

updateBuildInfo();
