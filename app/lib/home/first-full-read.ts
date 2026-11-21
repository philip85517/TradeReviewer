import {initialFullRequest} from './full-contracts';

/** Parser-time request for ordinary entry. Hydration owns restored selections. */
export function firstFullReadScript(day:string){
 const key=JSON.stringify(initialFullRequest(day));
 return `
(function startFirstFullRead() {
  try {
    // A restored HTML document must never fetch yesterday's default range.
    var today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    if (today !== ${JSON.stringify(day)}) return;
    var query = new URLSearchParams(location.search);
    if (query.has('state') || query.has('contributionState') ||
        sessionStorage.getItem('tradereview-full-home-context-v1') ||
        window.__tradeReviewFirstFullRead) return;

    var key = ${JSON.stringify(key)};
    var controller = new AbortController();
    var timer;
    function dispose() {
      clearTimeout(timer);
      window.removeEventListener('pagehide', leave);
    }
    function leave() {
      controller.abort();
      dispose();
    }
    var response = fetch('/api/home/full?' + new URLSearchParams({request: key}), {
      signal: controller.signal,
      cache: 'no-store'
    });
    // Hydration will handle the same rejection through the ordinary read path.
    response.catch(function () {});
    window.__tradeReviewFirstFullRead = {
      key: key,
      createdAt: Date.now(),
      controller: controller,
      dispose: dispose,
      response: response
    };
    window.addEventListener('pagehide', leave);
    timer = setTimeout(leave, 15000);
  } catch (_) {
    // Disabled storage or unsupported browser APIs fall back to normal hydration.
  }
})();`;
}
