document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const saved = (() => { try { return localStorage.getItem('theme'); } catch (e) { return null; } })();
if (saved) {
  root.dataset.theme = saved;
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  root.dataset.theme = 'dark';
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});
