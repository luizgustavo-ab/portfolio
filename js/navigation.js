/* ===============================
   VISÕES: PROJETOS / INFO
   Usa o hash da URL (#work, #info), então voltar e avançar do navegador
   funcionam sem roteador.
   =============================== */

(() => {
  const views = [...document.querySelectorAll("[data-view]")];
  const links = [...document.querySelectorAll("[data-view-link]")];

  if (!views.length || !window.Portfolio?.carousel) return;

  // Sem JavaScript o hash rola até a seção. Com ele, o id sai do caminho
  // para a troca de visão não rolar a página.
  views.forEach((view) => {
    view.id = `view-${view.dataset.view}`;
  });

  function apply() {
    const current = location.hash === "#info" ? "info" : "work";

    views.forEach((view) => {
      const active = view.dataset.view === current;

      view.classList.toggle("is-active", active);
      view.inert = !active;
      view.setAttribute("aria-hidden", String(!active));
    });

    links.forEach((link) => {
      if (link.dataset.viewLink === current) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    // A nova entrada do histórico também precisa lembrar o projeto
    window.Portfolio.carousel.persist();
  }

  window.addEventListener("hashchange", apply);
  apply();

  // Libera as transições só depois do primeiro estado estar aplicado
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add("is-ready");
    });
  });

  window.portfolioReady = true;
})();
