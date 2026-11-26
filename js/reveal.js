/* ===============================
   PAGE REVEAL - CONFIGURACAO
   =============================== */

const REVEAL_CONFIG = {
  duration: 2400, // tempo total em ms, já contando os atrasos
  columns: 64, // menos colunas = pixels maiores
  mobileColumns: 42,
  mobileBreakpoint: 600, // largura em px até onde vale mobileColumns
  layerDelay: 95, // ms entre o início de uma camada e a seguinte
  noiseScale: 0.085, // menor = manchas maiores
  noiseOctaves: 4, // mais oitavas = bordas mais quebradas
  // Uma cor = dissolve todo preto. Para voltar às camadas coloridas, liste
  // mais cores, da camada da frente para a mais funda. A primeira cor também
  // está em html.page-reveal-pending::before no CSS.
  colors: ["#050505"]
};


/* ===============================
   PAGE REVEAL - DISSOLVE EM CAMADAS PIXELADAS
   =============================== */

// Fractal value noise, um valor por célula. O resultado é trocado pela posição
// no ranking (0..1], então o progresso de uma camada = fração da tela removida.
function createRevealThresholds(columns, rows, seed, scale, octaves) {
  function hash(x, y, octave) {
    let h =
      (Math.imul(x, 374761393) +
        Math.imul(y, 668265263) +
        Math.imul(octave + 1, 1442695041) +
        seed) | 0;

    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function valueNoise(x, y, octave) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = hash(ix, iy, octave);
    const b = hash(ix + 1, iy, octave);
    const c = hash(ix, iy + 1, octave);
    const d = hash(ix + 1, iy + 1, octave);
    const top = a + (b - a) * ux;
    const bottom = c + (d - c) * ux;

    return top + (bottom - top) * uy;
  }

  const noise = new Float32Array(columns * rows);

  for (let index = 0; index < noise.length; index++) {
    const x = (index % columns) * scale;
    const y = Math.floor(index / columns) * scale;
    let amplitude = 1;
    let frequency = 1;

    for (let octave = 0; octave < octaves; octave++) {
      noise[index] += valueNoise(x * frequency, y * frequency, octave) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
  }

  const thresholds = new Float32Array(noise.length);

  Array.from(noise.keys())
    .sort((a, b) => noise[a] - noise[b])
    .forEach((cell, rank) => {
      thresholds[cell] = (rank + 1) / noise.length;
    });

  return thresholds;
}

// Uma vez por sessão da aba (a leitura é feita pelo script no <head>)
function markRevealSeen() {
  try {
    sessionStorage.setItem("portfolioRevealSeen", "1");
  } catch {
    /* sem sessionStorage, o <head> usa o referrer para não repetir */
  }
}

function setupPageReveal() {
  const root = document.documentElement;

  // Sem a classe: movimento reduzido, ou o script chegou tarde demais
  if (!root.classList.contains("page-reveal-pending")) return;

  const config = REVEAL_CONFIG;
  const layerCount = config.colors.length;
  const layerDuration = Math.max(
    1,
    config.duration - config.layerDelay * (layerCount - 1)
  );

  const canvas = document.createElement("canvas");
  const seed = (Math.random() * 4294967296) | 0;

  // Uma cor RGBA por camada; a posição extra fica zerada = transparente
  const palette = new Uint32Array(layerCount + 1);
  const progress = new Float32Array(layerCount);

  let ctx = null;
  let image = null;
  let pixels = null;
  let thresholds = null;
  let frameId = 0;
  let startTime = null;
  let elapsed = 0;

  function finish() {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", handleResize);
    canvas.remove();
    root.classList.remove("page-reveal-pending");
  }

  // Só recria buffers e ruído quando o tamanho da grade muda
  function resizeGrid() {
    const columns =
      window.innerWidth <= config.mobileBreakpoint
        ? config.mobileColumns
        : config.columns;
    const cellSize = canvas.clientWidth / columns;
    const rows = Math.max(1, Math.round(canvas.clientHeight / cellSize) || 1);

    if (image && image.width === columns && image.height === rows) return false;

    canvas.width = columns;
    canvas.height = rows;
    image = ctx.createImageData(columns, rows);
    pixels = new Uint32Array(image.data.buffer);
    thresholds = createRevealThresholds(
      columns,
      rows,
      seed,
      config.noiseScale,
      config.noiseOctaves
    );

    return true;
  }

  function draw() {
    for (let layer = 0; layer < layerCount; layer++) {
      const time = (elapsed - layer * config.layerDelay) / layerDuration;
      const t = Math.min(Math.max(time, 0), 1);

      progress[layer] = t * t * (3 - 2 * t);
    }

    // Cada célula mostra a primeira camada que ainda não passou por ela
    for (let cell = 0; cell < pixels.length; cell++) {
      let layer = 0;

      while (layer < layerCount && thresholds[cell] <= progress[layer]) layer++;

      pixels[cell] = palette[layer];
    }

    ctx.putImageData(image, 0, 0);
  }

  function handleResize() {
    // Mudar o tamanho limpa o canvas, então redesenha na mesma hora
    if (resizeGrid()) draw();
  }

  function render(timestamp) {
    if (startTime === null) startTime = timestamp;

    elapsed = timestamp - startTime;

    if (elapsed >= config.duration) {
      finish();
      return;
    }

    draw();
    frameId = requestAnimationFrame(render);
  }

  try {
    ctx = canvas.getContext("2d");

    if (!ctx) {
      finish();
      return;
    }

    const paletteBytes = new Uint8Array(palette.buffer);

    config.colors.forEach((color, layer) => {
      const value = parseInt(color.slice(1), 16);

      paletteBytes.set(
        [value >> 16, (value >> 8) & 255, value & 255, 255],
        layer * 4
      );
    });

    canvas.className = "page-reveal";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    resizeGrid();
    draw(); // primeiro frame: tela toda na cor da camada da frente
    root.classList.remove("page-reveal-pending");
    markRevealSeen();

    window.addEventListener("resize", handleResize);

    // Espera dois frames antes de iniciar o relógio, para o primeiro desenho
    // da página não engasgar o começo da animação
    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(render);
      });
    });
  } catch (error) {
    console.error("Page reveal:", error);
    finish();
  }
}

setupPageReveal();
