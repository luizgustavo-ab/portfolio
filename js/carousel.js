/* ===============================
   CARROSSEL DE PROJETOS
   Sequência infinita com crossfade. Entrada por roda/trackpad (layout
   fixo), teclado e gesto horizontal. A ordem vem do HTML.
   =============================== */

(() => {
  const CAROUSEL_CONFIG = {
    duration: 450, // ms do crossfade (igual a --fade-project no CSS)
    wheelThreshold: 50, // px acumulados para trocar de projeto
    wheelQuiet: 200, // ms sem eventos que encerram um gesto
    swipeDistance: 48 // px horizontais mínimos de um gesto de toque
  };

  const carousel = document.querySelector("[data-carousel]");

  if (!carousel) return;

  const slides = [...carousel.querySelectorAll("[data-project]")];
  const view = carousel.closest("[data-view]");
  const live = document.getElementById("carouselStatus");
  const storageKey = "portfolioProject";

  // Mesma condição do layout de viewport fixa no CSS
  const fixedLayout = window.matchMedia(
    "(min-width: 901px) and (min-height: 560px)"
  );
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let busy = false;

  function isActive() {
    return !view || view.classList.contains("is-active");
  }

  function savedProject() {
    if (history.state && history.state.project) return history.state.project;

    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function persist() {
    const project = slides[index].dataset.project;

    history.replaceState({ ...history.state, project }, "");

    try {
      sessionStorage.setItem(storageKey, project);
    } catch {
      /* o history.state continua valendo para voltar/avançar */
    }
  }

  function show(next) {
    const focused = document.activeElement;
    const previous = slides[index];
    const focusRole = previous.contains(focused)
      ? focused.dataset.focusRole
      : null;

    index = next;

    slides.forEach((slide, position) => {
      const active = position === index;

      slide.classList.toggle("is-active", active);
      slide.inert = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });

    // O foco acompanha a troca para não cair no vazio
    if (focusRole) {
      slides[index]
        .querySelector(`[data-focus-role="${focusRole}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  function announce() {
    const strings = window.Portfolio?.currentStrings?.();

    if (!live || !strings) return;

    live.textContent = strings.announce
      .replace("{n}", index + 1)
      .replace("{total}", slides.length)
      .replace("{name}", slides[index].dataset.name);
  }

  async function move(step) {
    if (busy) return;

    busy = true;

    const next = (index + step + slides.length) % slides.length;
    const image = slides[next].querySelector(".frame img");

    // Só troca com a imagem pronta, para não mostrar um quadro vazio
    if (image) {
      await Promise.race([
        image.decode().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 800))
      ]);
    }

    show(next);
    persist();
    announce();

    setTimeout(
      () => {
        busy = false;
      },
      reducedMotion.matches ? 120 : CAROUSEL_CONFIG.duration
    );
  }

  /* Roda do mouse e trackpad: um projeto por gesto */
  let accumulated = 0;
  let lastTime = 0;
  let lastSize = 0;
  let lastDirection = 0;
  let consumed = false;
  let consumedAt = 0;

  function handleWheel(event) {
    // Ctrl/Cmd + roda é zoom do navegador
    if (event.ctrlKey || event.metaKey) return;
    if (!fixedLayout.matches || !isActive()) return;
    // Com a página ampliada por pinça, a rolagem serve para navegar nela
    if ((window.visualViewport?.scale || 1) > 1.01) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    event.preventDefault();

    // deltaMode: 0 = pixels, 1 = linhas, 2 = páginas
    const unit = [1, 40, window.innerHeight][event.deltaMode] || 1;
    const delta = event.deltaY * unit;

    if (!delta) return;

    const now = event.timeStamp;
    const gap = now - lastTime;
    const size = Math.abs(delta);
    const direction = Math.sign(delta);

    if (gap > CAROUSEL_CONFIG.wheelQuiet || direction !== lastDirection) {
      accumulated = 0;
      consumed = false;
    } else if (consumed && now - consumedAt > CAROUSEL_CONFIG.duration) {
      // Novo impulso no meio do fluxo: um clique da roda ou um novo
      // movimento por cima da inércia (que só diminui)
      const notch = size >= 80 && gap > 50;
      const push = size >= 30 && size > lastSize * 2;

      if (notch || push) {
        accumulated = 0;
        consumed = false;
      }
    }

    lastTime = now;
    lastSize = size;
    lastDirection = direction;

    if (consumed || busy) return;

    accumulated += size;

    if (accumulated >= CAROUSEL_CONFIG.wheelThreshold) {
      consumed = true;
      consumedAt = now;
      accumulated = 0;
      move(direction);
    }
  }

  /* Teclado */
  function handleKey(event) {
    if (event.defaultPrevented || !isActive()) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const horizontal = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const vertical = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const step = horizontal || vertical;

    if (!step) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable]")) {
      return;
    }

    // Quando a página rola, as setas continuam rolando a página
    if (!fixedLayout.matches) {
      const inCarousel = carousel.contains(event.target);

      if (vertical || (!inCarousel && event.target !== document.body)) return;
    }

    event.preventDefault();
    move(step);
  }

  /* Gesto horizontal. A rolagem vertical e o zoom ficam com o navegador. */
  let start = null;
  let swiped = false;

  carousel.addEventListener("pointerdown", (event) => {
    swiped = false;

    // Segundo dedo (pinça) cancela o gesto
    if (!event.isPrimary || event.button !== 0) {
      start = null;
      return;
    }

    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });

  carousel.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.id) return;

    const x = event.clientX - start.x;
    const y = event.clientY - start.y;

    start = null;

    // Com a página ampliada, arrastar para o lado serve para navegar nela
    if ((window.visualViewport?.scale || 1) > 1.01) return;

    if (
      Math.abs(x) >= CAROUSEL_CONFIG.swipeDistance &&
      Math.abs(x) > Math.abs(y) * 1.4
    ) {
      swiped = true;
      move(x < 0 ? 1 : -1);
    }
  });

  carousel.addEventListener("pointercancel", () => {
    start = null;
  });

  // Um arrasto não pode virar clique no link do projeto
  carousel.addEventListener(
    "click",
    (event) => {
      if (!swiped) return;

      swiped = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  carousel.addEventListener("dragstart", (event) => event.preventDefault());

  window.visualViewport?.addEventListener("resize", () => {
    carousel.classList.toggle("is-zoomed", window.visualViewport.scale > 1.01);
  });

  /* Imagem ausente: o quadro mostra o nome do projeto */
  carousel.querySelectorAll(".frame img").forEach((image) => {
    const markMissing = () => image.closest(".frame").classList.add("is-missing");

    image.addEventListener("error", markMissing);

    if (image.complete && !image.naturalWidth) markMissing();
  });

  /* Início, restaurando o projeto escolhido antes */
  const saved = slides.findIndex(
    (slide) => slide.dataset.project === savedProject()
  );

  show(Math.max(saved, 0));
  persist();

  window.addEventListener("wheel", handleWheel, { passive: false });
  document.addEventListener("keydown", handleKey);

  window.Portfolio = { ...window.Portfolio, carousel: { persist } };
})();
