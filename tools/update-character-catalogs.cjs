const fs = require('node:fs');
const path = require('node:path');
const { SOURCES, RESOURCE_DIRS, fetchCharacters, mergeCharacters } = require('../app/out/main/character-catalog.cjs');
async function main() {
  for (const [gameId, directory] of Object.entries(RESOURCE_DIRS)) {
    try {
      const file = path.join(__dirname, '../runtime-resources/games', directory, 'character-config.json');
      const base = JSON.parse(fs.readFileSync(file, 'utf8'));
      const records = await fetchCharacters(gameId);
      const next = mergeCharacters(base, records);
      next.onlineSource = { urls: SOURCES[gameId], checkedAt: new Date().toISOString().slice(0, 10) };
      fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
      console.log(`${gameId}: ${records.length} online entries, added ${next.defaultCharacters.filter(name => !base.defaultCharacters.includes(name)).join(', ') || 'none'}`);
    } catch (error) { console.warn(`${gameId}: update unavailable; keeping the bundled catalog (${error.message})`); }
  }
}
main();
