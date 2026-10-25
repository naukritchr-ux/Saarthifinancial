// Durable sync-job orchestration. No hooks, credentials or browser state here.
const countKeys = ['franchisees', 'enquiries', 'invoices', 'expenses', 'clients', 'legals'];
const sleepDefault = ms => new Promise(resolve => setTimeout(resolve, ms));

function jobStats(job) {
  const stats = {ok: job.status !== 'failed', status: job.status,
    duration_seconds: Number(job.duration_seconds) || 0,
    notes: job.message ? [job.message] : [],
    errors: job.status !== 'completed' && job.message ? [job.message] : []};
  for (const key of countKeys) stats[key] = Number(job[`${key}_count`]) || 0;
  stats.payroll = Number(String(job.message || '').match(/(?:^|\|)\s*Payroll:\s*(\d+)/i)?.[1]) || 0;
  return stats;
}

export async function runCrmSync({apiBaseUrl, request, onRefresh, onProgress = () => {},
  jobId = null, maxWaitMs = 600000, pollIntervalMs = 2500, now = Date.now, sleep = sleepDefault}) {
  const base = apiBaseUrl.replace(/\/+$/, '');
  try {
    if (!jobId) {
      let started;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await request(`${base}/finance/sync-saarthi`, {
            method: 'POST', cache: 'no-store', retries: 1, timeoutMs: 60000,
            headers: {'Content-Type': 'application/json'}
          });
          const data = await response.json();
          if (!response.ok || data.success === false) {
            const error = new Error(data.error || data.message || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
          }
          started = data;
          break;
        } catch (error) {
          if ([400,401,403,404].includes(error.status) || error.isAuthError || attempt === 2) throw error;
          onProgress({message: 'Retrying sync registration after a temporary connection failure.'});
          await sleep(1000 * (attempt + 1));
        }
      }
      jobId = started?.log_id;
      if (!jobId) throw new Error('Backend did not create a trackable sync job. Deploy the updated backend.');
    }
    onProgress({message: `Monitoring CRM sync job ${jobId}. Closing the dialog does not cancel the backend job.`, jobId});
    const deadline = now() + maxWaitMs;
    let lastError = '';
    let notFound = 0;
    while (now() < deadline) {
      try {
        const response = await request(`${base}/sync/status?log_id=${encodeURIComponent(jobId)}`, {
          cache: 'no-store', timeoutMs: 15000, retries: 1
        });
        const data = await response.json();
        if (!response.ok) {
          const error = new Error(data.error || `Status HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const job = [data.latest, ...(data.logs || [])].find(row => row && String(row.id) === String(jobId));
        if (job && ['completed', 'completed_with_warnings', 'failed'].includes(job.status)) {
          const stats = jobStats(job);
          const count = countKeys.reduce((sum, key) => sum + stats[key], 0) + stats.payroll;
          if (job.status !== 'failed' || count > 0) {
            try {
              if (onRefresh && await onRefresh() === false) throw new Error('Dashboard did not load fresh records.');
            } catch (error) {
              stats.errors.push(`CRM job finished, but dashboard refresh needs retry: ${error.message}`);
            }
          }
          return {success: job.status !== 'failed', warning: stats.errors.length > 0,
            error: job.status === 'failed' ? job.message || 'CRM sync failed. Check Render job logs.' : undefined,
            log_id: jobId, data: stats};
        }
        lastError = '';
      } catch (error) {
        if ([401,403].includes(error.status) || error.isAuthError) throw error;
        if (error.status === 404 && ++notFound >= 3) throw new Error('Sync job is not visible on this backend. Check the deployed API URL and database configuration.');
        lastError = error.message;
      }
      await sleep(pollIntervalMs);
    }
    return {success: false, pending: true, log_id: jobId,
      error: `Still awaiting job ${jobId}. You can resume monitoring; do not assume the backend stopped.${lastError ? ` Last status error: ${lastError}` : ''}`};
  } catch (error) {
    return {success: false, log_id: jobId, error: error.message || 'CRM sync could not be started or monitored.'};
  }
}
