const collections = [
  ['transactions', '/transactions', true], ['franchisees', '/franchisees', true],
  ['bdAgents', '/bd-agents', true], ['teamLeaders', '/team-leaders', true],
  ['budgets', '/budgets', false]
];

// Every result is published as soon as it arrives; a slow tab cannot hold up another.
export async function loadFinanceCollections({base, request, refresh = false, onData = () => {}, onError = () => {}}) {
  return Promise.all(collections.map(async ([key, path, isList]) => {
    try {
      const response = await request(`${base}${path}${refresh ? '?refresh=1' : ''}`, {cache: 'no-store'});
      if (!response.ok) {
        const error = new Error(`${key}: HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      if (isList ? !Array.isArray(data) || data.some(row => !row || typeof row !== 'object' || Array.isArray(row))
        : !data || typeof data !== 'object' || Array.isArray(data) || data.success === false || data.error) {
        throw new Error(`${key}: the server did not return valid finance data.`);
      }
      onData(key, data);
      return {key, ok: true};
    } catch (error) {
      onError(key, error);
      return {key, ok: false, error};
    }
  }));
}
