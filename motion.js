/* Плавное появление блоков при прокрутке. Если анимации отключены в системе
   или браузер не умеет IntersectionObserver, контент сразу виден как обычно. */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  const selector = [
    /* главная */
    '.section-head', '.branch-group-head', '.branch', '.veranda', '.deal', '.set', '.club',
    '.food-copy', '.food-photos figure', '.faq h2', '.faq-list details', '.contacts h2', '.contact-card',
    /* меню */
    '.menu-section h2', '.dish', '.list-card', '.hookah-price', '.hookah-list li',
  ].join(',');

  const items = [...document.querySelectorAll(selector)];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  items.forEach((el) => {
    /* Соседние карточки появляются друг за другом */
    const siblings = [...el.parentElement.children].filter((n) => n.matches(selector));
    el.style.setProperty('--reveal-i', Math.min(siblings.indexOf(el), 5));
    el.classList.add('reveal');
    observer.observe(el);
  });
})();
