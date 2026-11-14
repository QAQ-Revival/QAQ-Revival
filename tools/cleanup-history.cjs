const fs = require('node:fs');

const newestFirst = (field) => (a, b) => Date.parse(b[field] || b.created_at) - Date.parse(a[field] || a.created_at) || b.id - a.id;
function retentionPlan(releases, runs, currentRunId = null) {
  const latestRelease = [...releases].filter(release => !release.draft && release.published_at).sort(newestFirst('published_at'))[0];
  const latestRun = [...runs].sort(newestFirst('created_at'))[0];
  return {
    latestRelease: latestRelease || null,
    latestRun: latestRun || null,
    releases: latestRelease ? releases.filter(release => !release.draft && release.id !== latestRelease.id) : [],
    runs: runs.filter(run => run.status === 'completed' && run.id !== latestRun?.id && String(run.id) !== String(currentRunId))
  };
}
async function paginate(request, route, field) {
  const result = [];
  for (let page = 1; ; page++) {
    const data = await request(`${route}?per_page=100&page=${page}`);
    const entries = field ? data[field] : data;
    if (!Array.isArray(entries)) throw Error('Invalid GitHub list response for ' + route);
    result.push(...entries);
    if (entries.length < 100) return result;
  }
}
async function cleanupHistory({ repository, currentRunId, cleanupReleases = true, request, log = console.log }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw Error('Invalid GitHub repository');
  const base = `/repos/${repository}`;
  // Collect all pages before deleting: removing a page while paging skips runs.
  const [releases, runs] = await Promise.all([
    paginate(request, base + '/releases'), paginate(request, base + '/actions/runs', 'workflow_runs')
  ]);
  if (currentRunId && !runs.some(run => String(run.id) === String(currentRunId))) {
    runs.push(await request(`${base}/actions/runs/${currentRunId}`));
  }
  const plan = retentionPlan(releases, runs, currentRunId);
  log(`Keeping release ${plan.latestRelease?.tag_name || '(none)'} and workflow run ${plan.latestRun?.id || '(none)'}`);
  let releasesDeleted = 0, runsDeleted = 0;
  for (const release of cleanupReleases ? plan.releases : []) {
    await request(`${base}/releases/${release.id}`, { method: 'DELETE' });
    releasesDeleted++;
    log('Deleted release ' + release.tag_name);
  }
  for (const run of plan.runs) {
    // A completed run may have been rerun since the snapshot was taken.
    const current = await request(`${base}/actions/runs/${run.id}`);
    if (current === null || current.status !== 'completed') continue;
    await request(`${base}/actions/runs/${run.id}`, { method: 'DELETE' });
    runsDeleted++;
    log('Deleted workflow run ' + run.id);
  }
  const result = { release: plan.latestRelease?.tag_name || null, run: plan.latestRun?.id || null, releasesDeleted, runsDeleted };
  log(JSON.stringify(result));
  return result;
}
function githubRequest(token) {
  if (!token) throw Error('GITHUB_TOKEN is required');
  return async (route, { method = 'GET' } = {}) => {
    const response = await fetch('https://api.github.com' + route, {
      method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000)
    });
    if (response.status === 404 && /\/(?:releases|actions\/runs)\/\d+$/.test(route)) return null;
    if (!response.ok) throw Error(`GitHub ${method} ${route} failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
}
if (require.main === module) {
  cleanupHistory({ repository: process.env.GITHUB_REPOSITORY, currentRunId: process.env.GITHUB_RUN_ID, cleanupReleases: process.env.CLEANUP_RELEASES !== 'false', request: githubRequest(process.env.GITHUB_TOKEN) })
    .then(result => {
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Kept release **${result.release || 'none'}** and run **${result.run || 'none'}**. Deleted ${result.releasesDeleted} older releases and ${result.runsDeleted} older workflow runs.\n`);
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { retentionPlan, paginate, cleanupHistory };
