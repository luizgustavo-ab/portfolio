/* ===============================
   GLYPHS DE FUNDO (pretos, sobre o fundo claro)
   Duas camadas discretas: braille espalhado e manchas de símbolos que
   fluem devagar. Poucos quadros por segundo, resolução 1x, parado quando
   a aba está oculta e estático com "reduzir movimento".
   =============================== */

(() => {
  const GLYPH_CONFIG = {
    fps: 10,
    color: "#000000",
    layers: [
      {
        cell: 18,
        fontSize: 13,
        alpha: 0.12,
        scale: 0.07, // tamanho das manchas (menor = maiores)
        threshold: 0.42, // maior = menos glyphs
        speed: 0.035,
        glyphs: ["⠛", "⠔", "⠢", "⠕", "⠪", "⡇", "⡟", "⢻", "⣏", "⣹", "⣟"]
      },
      {
        cell: 14,
        fontSize: 12,
        alpha: 0.2,
        scale: 0.065,
        threshold: 0.6,
        speed: 0.06,
        glyphs: ["+", "+", "+", "✦", "◆", "·", "·"]
      }
    ]
  };

  const canvas = document.getElementById("glyphs");
  const ctx = canvas && canvas.getContext("2d");

  if (!ctx) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Ruído de valor com tabela pronta: sem funções trigonométricas por célula
  const table = new Float32Array(256 * 256);

  for (let index = 0, value = 12345; index < table.length; index++) {
    value = (Math.imul(value, 1664525) + 1013904223) | 0;
    table[index] = (value >>> 0) / 4294967296;
  }

  function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const x0 = ix & 255;
    const x1 = (ix + 1) & 255;
    const y0 = (iy & 255) << 8;
    const y1 = ((iy + 1) & 255) << 8;
    const top = table[y0 | x0] + (table[y0 | x1] - table[y0 | x0]) * ux;
    const bottom = table[y1 | x0] + (table[y1 | x1] - table[y1 | x0]) * ux;

    return top + (bottom - top) * uy;
  }

  // Cada glyph é desenhado uma única vez e depois só copiado
  const sprites = GLYPH_CONFIG.layers.map((layer) =>
    layer.glyphs.map((glyph) => {
      const sprite = document.createElement("canvas");
      const size = layer.cell + 4;
      const spriteContext = sprite.getContext("2d");

      sprite.width = size;
      sprite.height = size;
      spriteContext.fillStyle = GLYPH_CONFIG.color;
      spriteContext.font = `${layer.fontSize}px "Share Tech Mono", monospace`;
      spriteContext.textAlign = "center";
      spriteContext.textBaseline = "middle";
      spriteContext.fillText(glyph, size / 2, size / 2);

      return sprite;
    })
  );

  let width = 0;
  let height = 0;
  let time = 0; // só avança quando desenha, então pausar não causa salto
  let timer = 0;
  let frame = 0;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    GLYPH_CONFIG.layers.forEach((layer, layerIndex) => {
      const columns = Math.ceil(width / layer.cell);
      const rows = Math.ceil(height / layer.cell);
      const drift = time * layer.speed;
      const set = sprites[layerIndex];

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x = column * layer.scale;
          const y = row * layer.scale;
          const warp = noise(x * 2.3 + drift * 1.7, y * 2.3 + 11.3) - 0.5;
          const value =
            noise(x + warp + drift, y + warp - drift * 0.6) * 0.7 +
            noise(x * 2.9 - drift, y * 2.9 + 27.1) * 0.3;
          const strength = (value - layer.threshold) / 0.14;

          if (strength <= 0.05) continue;

          const index = Math.floor(
            noise(column * 0.37 + drift * 2, row * 0.41 - drift) * set.length
          );

          ctx.globalAlpha = layer.alpha * Math.min(strength, 1);
          ctx.drawImage(
            set[Math.min(index, set.length - 1)],
            column * layer.cell - 2,
            row * layer.cell - 2
          );
        }
      }
    });

    ctx.globalAlpha = 1;
  }

  function stop() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  }

  function tick() {
    // Durante o page reveal mantém o quadro já desenhado
    if (!document.querySelector(".page-reveal")) {
      time += 1 / GLYPH_CONFIG.fps;
      draw();
    }

    schedule();
  }

  function schedule() {
    timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, 1000 / GLYPH_CONFIG.fps);
  }

  function start() {
    stop();

    if (!document.hidden && !reducedMotion.matches) schedule();
  }

  window.addEventListener("resize", () => {
    // Barras do navegador no celular mudam a altura o tempo todo
    if (canvas.clientWidth === width && canvas.clientHeight === height) return;

    resize();
    draw();
  });

  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener?.("change", start);

  resize();
  draw();
  start();
})();
