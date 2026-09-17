const search = document.querySelector('#test-search');
if (search) {
  const cards = [...document.querySelectorAll('.test-card')];
  const filters = [...document.querySelectorAll('.filter')];
  let category = 'all';
  const filterCards = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const visible = (category === 'all' || card.dataset.category === category) && terms.every(term => card.dataset.search.includes(term));
      card.hidden = !visible; count += Number(visible);
    }
    document.querySelector('#no-results').hidden = count > 0;
    const resultCount = document.querySelector('#result-count');
    if (resultCount) resultCount.textContent = `${count} ${count === 1 ? 'test' : 'tests'}`;
  };
  search.addEventListener('input', filterCards);
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    filterCards();
  }));
  document.querySelector('#clear-search').addEventListener('click', () => {
    search.value = ''; filters[0].click(); search.focus();
  });
  if (location.hash === '#test-search') search.focus();
}
const root = document.querySelector('#tool-root');
if (root) {
  const kind = root.dataset.tool;
  const modulePath = ['webcam', 'microphone', 'headphone'].includes(kind) ? './media-tools.js' : ['keyboard', 'mouse', 'screen', 'touch', 'gamepad'].includes(kind) ? './input-tools.js' : ['vibration', 'gyroscope', 'accelerometer', 'multitouch'].includes(kind) ? './mobile-tools.js' : './extra-tools.js';
  import(modulePath).then(module => {
    const mount = module.mountMediaTool || module.mountInputTool || module.mountMobileTool || module.mountExtraTool;
    mount(root, kind);
  }).catch(() => {
    root.innerHTML = '<div class="tool-error"><h2>The test could not load</h2><p>Reload this page to try again. The guide below is still available.</p><button class="button" id="reload-tool">Reload page</button></div>';
    document.querySelector('#reload-tool').addEventListener('click', () => location.reload());
  });
  const query = new URLSearchParams(location.search);
  if (query.get('setup') === 'call' && ['webcam','microphone','headphone'].includes(kind)) {
    const nav = document.createElement('nav'); nav.className = 'call-progress'; nav.setAttribute('aria-label','Call setup steps');
    const steps = [['webcam','Camera'],['microphone','Microphone'],['headphone','Headphones']];
    nav.innerHTML = '<span>Check your call setup</span>' + steps.map(([id,label]) => `<a href="/${id}-test/?setup=call" ${id === kind ? 'aria-current="step"' : ''}>${label}</a>`).join('');
    document.querySelector('.tool-heading').before(nav);
  }
}
