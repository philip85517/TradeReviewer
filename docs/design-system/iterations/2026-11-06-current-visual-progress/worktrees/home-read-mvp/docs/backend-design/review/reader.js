(() => {
  const links = [...document.querySelectorAll('.toc a[data-target]')];
  const headings = links.map(link => document.getElementById(link.dataset.target)).filter(Boolean);
  function reveal(target) {
    let parent = target?.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }
  function followHash() {
    if (!location.hash) return;
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    reveal(target); requestAnimationFrame(() => { target.scrollIntoView({block: 'start'}); mark(); });
  }
  function mark() {
    let current = headings[0];
    for (const heading of headings) if (heading.getClientRects().length && heading.getBoundingClientRect().top <= 125) current = heading;
    links.forEach(link => { const active = link.dataset.target === current?.id; link.classList.toggle('is-current', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => { let target; try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))); } catch (_) {} reveal(target); if (link.hash === location.hash) requestAnimationFrame(followHash); }));
  document.addEventListener('scroll', mark, {passive: true});
  document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', mark));
  window.addEventListener('hashchange', followHash);
  followHash(); mark();
})();
