const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.innerHTML = open ? '✕ <span>Fechar</span>' : '☰ <span>Menu</span>';
  });
  mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.innerHTML = '☰ <span>Menu</span>';
  }));
}
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
