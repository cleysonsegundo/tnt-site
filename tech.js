// TNT Propaganda — motores 3D do site: números feitos de partículas (WebGL) e o globo do contato (canvas).
// Aqui ficam só os motores; main.js decide quando e onde usar cada um.
window.TNT3D = (() => {
  const rand = (a, b) => a + Math.random() * (b - a);
  const D2R = Math.PI / 180;

  /* =======================================================================
     FORMAS: o que é pintado num canvas escondido vira ponto (e vira textura do número sólido).
     Coordenadas normalizadas: x de -1 a 1 e y de -0,5 a 0,5. O canvas tem proporção 2:1.
     ======================================================================= */
  function surface(res) {
    const c = document.createElement("canvas");
    c.width = res; c.height = res / 2;
    return [c, c.getContext("2d", { willReadFrequently: true })];
  }
  function fromAlpha(c, ctx) {
    const W = c.width, H = c.height, step = Math.max(2, Math.round(W / 500));
    const d = ctx.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (d[(y * W + x) * 4 + 3] > 128) pts.push((x / W - 0.5) * 2, 0.5 - y / H);
      }
    }
    return { pts: new Float32Array(pts), img: c };
  }
  function textShape(text, { res = 1000, weight = 900, family = '"League Spartan", system-ui, sans-serif', spacing = -0.05, fill = 0.94 } = {}) {
    const [c, ctx] = surface(res);
    const W = c.width, H = c.height;
    let size = W * 0.3;
    const font = () => {
      ctx.font = `${weight} ${size}px ${family}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = `${(spacing * size).toFixed(1)}px`;
    };
    font();
    let m = ctx.measureText(text);
    size *= Math.min((W * fill) / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight), (H * 0.84) / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
    font();
    m = ctx.measureText(text);
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    ctx.fillStyle = "#fff";
    ctx.fillText(text, (W - inkW) / 2 + m.actualBoundingBoxLeft, H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    return fromAlpha(c, ctx);
  }
  function imageShape(img, { res = 1000, fill = 0.92 } = {}) {
    const [c, ctx] = surface(res);
    const W = c.width, H = c.height;
    const s = Math.min((W * fill) / img.naturalWidth, (H * fill) / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    return fromAlpha(c, ctx);
  }
  // Distribui n partículas por uma forma; as últimas viram poeira solta em volta.
  function spread(cand, n, nDust) {
    const out = new Float32Array(n * 3);
    const m = cand.length / 2;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      if (i >= n - nDust || !m) {
        out[o] = rand(-1.8, 1.8); out[o + 1] = rand(-1, 1); out[o + 2] = rand(-1.2, 0.9);
        continue;
      }
      const j = (Math.random() * m) | 0;
      out[o] = cand[j * 2] + rand(-0.002, 0.002);
      out[o + 1] = cand[j * 2 + 1] + rand(-0.002, 0.002);
      out[o + 2] = rand(-0.05, 0.02);
    }
    return out;
  }

  /* =======================================================================
     PARTÍCULAS (WebGL): 4 formas na memória da placa de vídeo; a rolagem só muda números.
     Quando as partículas assentam, o número "se forja" sólido, com espessura e um brilho que o atravessa.
     ======================================================================= */
  const VERT = `
precision highp float;
attribute vec3 aP0;
attribute vec3 aP1;
attribute vec3 aP2;
attribute vec3 aP3;
attribute vec4 aSeed;
attribute float aDust;
uniform float uMorph;
uniform float uEnter;
uniform float uTime;
uniform float uBlast;
uniform float uScale;
uniform float uDpr;
uniform float uSize;
uniform float uGlow;
uniform float uSolid;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uRot;
uniform vec2 uMouse;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float m = clamp(uMorph, 0.0, 3.0);
  float s1 = step(1.0, m);
  float s2 = step(2.0, m);
  vec3 pa = mix(mix(aP0, aP1, s1), aP2, s2);
  vec3 pb = mix(mix(aP1, aP2, s1), aP3, s2);
  float t = m - s1 - s2;
  // Partem e chegam numa onda da esquerda para a direita: o próximo número "se escreve".
  float d = clamp((pb.x + 1.0) * 0.5, 0.0, 1.0) * 0.3 + aSeed.w * 0.1;
  float tt = smoothstep(d, d + 0.6, t);
  vec3 dir = normalize(aSeed.xyz - 0.5 + vec3(0.0001));
  float burst = sin(3.14159265 * tt) * (0.25 + aSeed.x);
  vec3 p = mix(pa, pb, tt) + dir * burst * uBlast;
  float ang = burst * (aSeed.y - 0.5) * 2.4;
  float ca = cos(ang), sa = sin(ang);
  p.xy = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
  // Entrada: a nuvem se junta na primeira forma.
  vec3 cloud = dir * (1.25 + aSeed.z * 1.5);
  float te = smoothstep(aSeed.w * 0.45, aSeed.w * 0.45 + 0.55, uEnter);
  p = mix(cloud, p, te);
  // Onda de energia que atravessa o número de tempos em tempos.
  float wr = 0.3 + fract(uTime / 3.4) * 2.3;
  float dr = length(p.xy) - wr;
  float wave = exp(-dr * dr / 0.01) * uSolid * (1.0 - aDust) * 0.5 * (1.0 - uGlow * 0.8);
  p.xy += normalize(p.xy + vec2(0.0001)) * wave * 0.03;
  p.z += wave * 0.08;
  // Poeira em órbita, como uma galáxia em volta do número.
  float oa = uTime * (0.07 + aSeed.y * 0.14) * aDust;
  float co = cos(oa), so = sin(oa);
  p = vec3(co * p.x + so * p.z, p.y, -so * p.x + co * p.z);
  p += vec3(sin(uTime * 0.9 + aSeed.x * 40.0), cos(uTime * 0.8 + aSeed.y * 40.0), sin(uTime * 0.7 + aSeed.z * 40.0)) * (0.004 + aDust * 0.03);
  // Câmera.
  float cy = cos(uRot.y), sy = sin(uRot.y), cx = cos(uRot.x), sx = sin(uRot.x);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float k = 3.0 / max(0.6, 3.0 - p.z);
  vec2 scr = uCenter + vec2(p.x, -p.y) * uScale * k;
  // O mouse empurra os pontos.
  vec2 dm = scr - uMouse;
  float dist = length(dm);
  float push = exp(-dist * dist / 16000.0);
  scr += dm / max(dist, 1.0) * push * 70.0;
  vec2 clip = scr / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = uSize * uDpr * k * (0.55 + aSeed.y * 0.9) * mix(1.0, 0.75, aDust) * (1.0 + burst * 0.45 + wave * 0.5) * mix(1.0, 4.2, uGlow);
  vec3 col = mix(vec3(1.0, 0.8, 0.0), vec3(1.0, 0.95, 0.8), step(0.82, aSeed.z));
  col = mix(col, vec3(0.55, 0.62, 1.0), aDust * step(0.4, aSeed.x));
  col = mix(col, vec3(1.0, 0.45, 0.1), clamp(burst, 0.0, 1.0) * 0.5);
  vColor = col + vec3(push * 0.4 + wave * 0.6);
  // Com o número sólido na tela, os pontos dele viram só um brilho por cima.
  float dim = mix(1.0, mix(0.28, 0.5, uGlow), uSolid * (1.0 - aDust));
  vAlpha = mix(0.95, 0.4, aDust) * (0.7 + 0.3 * sin(uTime * 2.3 + aSeed.x * 31.0)) * clamp(k, 0.55, 1.3) * mix(1.0, 0.07, uGlow) * (dim + wave);
}`;
  const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float a = 1.0 - d;
  a *= a * vAlpha;
  gl_FragColor = vec4(vColor * a, a);
}`;
  // O número sólido: a mesma forma como textura, em camadas (frente amarela, lados mais escuros).
  const QVERT = `
precision highp float;
attribute vec2 aCorner;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uRot;
uniform float uScale;
uniform float uZ;
varying vec2 vUv;
void main() {
  vec3 p = vec3(aCorner.x, aCorner.y * 0.5, uZ);
  float cy = cos(uRot.y), sy = sin(uRot.y), cx = cos(uRot.x), sx = sin(uRot.x);
  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float w = max(0.2, (3.0 - p.z) / 3.0);
  vec2 pos = (uCenter * w + vec2(p.x, -p.y) * uScale) / uRes * 2.0 - w;
  gl_Position = vec4(pos.x, -pos.y, 0.0, w);
  vUv = vec2(aCorner.x * 0.5 + 0.5, 0.5 - aCorner.y * 0.5);
}`;
  const QFRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform float uSolid;
uniform float uShade;
uniform float uTime;
uniform float uFlash;
varying vec2 vUv;
void main() {
  float a = texture2D(uTex, vUv).a;
  if (a < 0.02) discard;
  float front = step(0.99, uShade);
  vec3 face = mix(vec3(1.0, 0.9, 0.34), vec3(1.0, 0.7, 0.0), clamp(vUv.y * 1.5 - 0.25, 0.0, 1.0));
  vec3 side = mix(vec3(0.3, 0.13, 0.0), vec3(0.78, 0.44, 0.0), uShade);
  vec3 col = mix(side, face, front);
  float sweep = fract(uTime * 0.2) * 2.8 - 0.9;
  float band = smoothstep(0.08, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.45 - sweep)) * front;
  col = mix(col, vec3(1.0, 0.98, 0.9), band * 0.9);
  col = mix(col, vec3(1.0), uFlash * 0.8 * front);
  float alpha = a * uSolid;
  gl_FragColor = vec4(col * alpha, alpha);
}`;
  function shader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  function program(gl, vsrc, fsrc, locs) {
    const vs = shader(gl, gl.VERTEX_SHADER, vsrc), fs = shader(gl, gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    Object.entries(locs).forEach(([name, i]) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }
  const LOC = { aP0: 0, aP1: 1, aP2: 2, aP3: 3, aSeed: 4, aDust: 5, aCorner: 6 };
  function particles(canvas, { count = 16000, dust = 0.12, layers = 8 } = {}) {
    let gl = null;
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: "high-performance" });
    } catch { gl = null; }
    if (!gl) return null;
    const progP = program(gl, VERT, FRAG, { aP0: 0, aP1: 1, aP2: 2, aP3: 3, aSeed: 4, aDust: 5 });
    const progQ = program(gl, QVERT, QFRAG, { aCorner: 6 });
    if (!progP || !progQ) return null;

    const n = count, nDust = Math.round(count * dust);
    const bufs = {};
    const upload = (name, data, size) => {
      bufs[name] = bufs[name] || gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(LOC[name]);
      gl.vertexAttribPointer(LOC[name], size, gl.FLOAT, false, 0, 0);
    };
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const kind = new Float32Array(n);
    for (let i = n - nDust; i < n; i++) kind[i] = 1;
    upload("aSeed", seed, 4);
    upload("aDust", kind, 1);
    // Até as formas ficarem prontas, tudo é poeira.
    ["aP0", "aP1", "aP2", "aP3"].forEach((a) => upload(a, spread(new Float32Array(0), n, n), 3));
    upload("aCorner", new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2);
    gl.disableVertexAttribArray(LOC.aCorner);

    const uniforms = (prog, names) => Object.fromEntries(names.map((u) => [u, gl.getUniformLocation(prog, u)]));
    const UP = uniforms(progP, ["uMorph", "uEnter", "uTime", "uBlast", "uScale", "uDpr", "uSize", "uGlow", "uSolid", "uRes", "uCenter", "uRot", "uMouse"]);
    const UQ = uniforms(progQ, ["uRes", "uCenter", "uRot", "uScale", "uZ", "uTex", "uSolid", "uShade", "uTime", "uFlash"]);
    const tex = [];
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    let lost = false, W = 1, H = 1, DPR = 1;
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });

    return {
      count: n,
      setShapes(shapes) {
        shapes.forEach((sh, i) => {
          upload(`aP${i}`, spread(sh.pts, n, nDust), 3);
          tex[i] = tex[i] || gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex[i]);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sh.img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        });
        gl.disableVertexAttribArray(LOC.aCorner);
      },
      resize(w, h, dpr) {
        W = Math.max(1, w); H = Math.max(1, h); DPR = dpr;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      draw(s) {
        if (lost) return;
        gl.clear(gl.COLOR_BUFFER_BIT);
        // 1) O número sólido, de trás para a frente (as camadas de trás formam a espessura).
        const t = tex[s.idx];
        if (t && s.solid > 0.01) {
          gl.useProgram(progQ);
          gl.enableVertexAttribArray(LOC.aCorner);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.uniform1i(UQ.uTex, 0);
          gl.uniform2f(UQ.uRes, W, H);
          gl.uniform2f(UQ.uCenter, s.cx, s.cy);
          gl.uniform2f(UQ.uRot, s.rx, s.ry);
          gl.uniform1f(UQ.uScale, s.scale);
          gl.uniform1f(UQ.uSolid, s.solid);
          gl.uniform1f(UQ.uTime, s.time);
          gl.uniform1f(UQ.uFlash, s.flash);
          for (let L = 0; L < layers; L++) {
            const f = layers > 1 ? L / (layers - 1) : 1;
            gl.uniform1f(UQ.uZ, -0.065 * (1 - f));
            gl.uniform1f(UQ.uShade, f);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
          gl.disableVertexAttribArray(LOC.aCorner);
        }
        // 2) As partículas por cima, somando luz: primeiro um halo largo, depois os pontos nítidos.
        gl.useProgram(progP);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniform1f(UP.uMorph, s.morph);
        gl.uniform1f(UP.uEnter, s.enter);
        gl.uniform1f(UP.uTime, s.time);
        gl.uniform1f(UP.uBlast, s.blast);
        gl.uniform1f(UP.uScale, s.scale);
        gl.uniform1f(UP.uDpr, DPR);
        gl.uniform1f(UP.uSize, s.size);
        gl.uniform1f(UP.uSolid, s.solid);
        gl.uniform2f(UP.uRes, W, H);
        gl.uniform2f(UP.uCenter, s.cx, s.cy);
        gl.uniform2f(UP.uRot, s.rx, s.ry);
        gl.uniform2f(UP.uMouse, s.mx, s.my);
        gl.uniform1f(UP.uGlow, 1);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.uniform1f(UP.uGlow, 0);
        gl.drawArrays(gl.POINTS, 0, n);
      },
    };
  }

  /* =======================================================================
     GLOBO (canvas 2D): continentes em pontos, Salvador marcada e rotas saindo daqui.
     ======================================================================= */
  const vec = (lat, lon) => {
    const a = lat * D2R, b = lon * D2R;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  };
  const HOME = vec(-12.97, -38.5);
  // Para onde as ideias viajam: capitais do Brasil e do mundo.
  const CITIES = [[-23.55, -46.63], [-22.91, -43.2], [-15.79, -47.88], [-3.73, -38.52], [-8.05, -34.9], [38.72, -9.14], [40.71, -74.0], [51.5, -0.12], [-34.6, -58.38], [-8.84, 13.23], [25.76, -80.19]];

  // Mapa-múndi em TopoJSON (world-atlas) → polígonos [lon, lat].
  function decodeTopo(topo) {
    const tf = topo.transform;
    const arcs = topo.arcs.map((arc) => {
      if (!tf) return arc;
      let x = 0, y = 0;
      return arc.map(([dx, dy]) => [(x += dx) * tf.scale[0] + tf.translate[0], (y += dy) * tf.scale[1] + tf.translate[1]]);
    });
    const ring = (ids) => {
      const out = [];
      ids.forEach((id, k) => {
        const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id];
        out.push(...(k ? a.slice(1) : a));
      });
      return out;
    };
    const polys = [];
    const walk = (g) => {
      if (g.type === "GeometryCollection") g.geometries.forEach(walk);
      else if (g.type === "Polygon") polys.push(g.arcs.map(ring));
      else if (g.type === "MultiPolygon") g.arcs.forEach((p) => polys.push(p.map(ring)));
    };
    walk(topo.objects.land);
    return polys;
  }
  function landMask(polys) {
    const MW = 1024, MH = 512;
    const c = document.createElement("canvas");
    c.width = MW; c.height = MH;
    const m = c.getContext("2d", { willReadFrequently: true });
    m.fillStyle = "#fff";
    polys.forEach((rings) => {
      m.beginPath();
      rings.forEach((r) => {
        let px = null;
        r.forEach(([lon, lat]) => {
          const x = ((lon + 180) / 360) * MW, y = ((90 - lat) / 180) * MH;
          // Polígonos que cruzam a linha de data (lon ±180) são cortados ali.
          if (px === null || Math.abs(x - px) > MW / 2) m.moveTo(x, y);
          else m.lineTo(x, y);
          px = x;
        });
        m.closePath();
      });
      m.fill("evenodd");
    });
    return { data: m.getImageData(0, 0, MW, MH).data, MW, MH };
  }

  function globe(canvas, { dots = 18000 } = {}) {
    const ctx = canvas.getContext("2d");
    let w = 1, h = 1, dpr = 1;
    let land = null, near = null;
    const routes = CITIES.map(([la, lo], i) => {
      const b = vec(la, lo);
      const th = Math.acos(Math.min(1, HOME[0] * b[0] + HOME[1] * b[1] + HOME[2] * b[2]));
      const lift = Math.min(0.16, 0.05 + th * 0.08);
      const N = 40, pts = new Float32Array((N + 1) * 3), s = Math.sin(th);
      for (let k = 0; k <= N; k++) {
        const t = k / N, f0 = Math.sin((1 - t) * th) / s, f1 = Math.sin(t * th) / s, r = 1 + lift * Math.sin(Math.PI * t);
        for (let j = 0; j < 3; j++) pts[k * 3 + j] = (HOME[j] * f0 + b[j] * f1) * r;
      }
      return { pts, N, sx: new Float32Array(N + 1), sy: new Float32Array(N + 1), vis: new Uint8Array(N + 1), delay: i * 0.73, dur: 1.6 + th * 0.8 };
    });

    function setDots(list) {
      land = new Float32Array(list);
      near = new Uint8Array(land.length / 3);
      const lim = Math.cos(9 * D2R);
      for (let i = 0, k = 0; i < land.length; i += 3, k++) near[k] = land[i] * HOME[0] + land[i + 1] * HOME[1] + land[i + 2] * HOME[2] > lim ? 1 : 0;
    }
    function sample({ data, MW, MH }) {
      const out = [];
      for (let i = 0; i < dots; i++) {
        const y = 1 - ((i + 0.5) / dots) * 2, r = Math.sqrt(1 - y * y), t = i * 2.399963229728653;
        const x = Math.cos(t) * r, z = Math.sin(t) * r;
        const lat = Math.asin(y) / D2R, lon = Math.atan2(x, z) / D2R;
        if (lat < -58) continue;
        const px = Math.min(MW - 1, (((lon + 180) / 360) * MW) | 0), py = Math.min(MH - 1, (((90 - lat) / 180) * MH) | 0);
        if (data[(py * MW + px) * 4 + 3] > 100) out.push(x, y, z);
      }
      return out;
    }
    // Sem internet para o mapa: meridianos e paralelos em pontos.
    function graticule() {
      const out = [];
      for (let lat = -60; lat <= 80; lat += 20) for (let lon = -180; lon < 180; lon += 2) out.push(...vec(lat, lon));
      for (let lon = -180; lon < 180; lon += 20) for (let lat = -60; lat <= 80; lat += 2) out.push(...vec(lat, lon));
      return out;
    }

    return {
      async load(url) {
        try {
          const res = await fetch(url);
          setDots(sample(landMask(decodeTopo(await res.json()))));
        } catch {
          setDots(graticule());
        }
      },
      resize(cw, ch, d) {
        w = Math.max(1, cw); h = Math.max(1, ch); dpr = d;
        canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      },
      draw(time, view) {
        const R = Math.min(w, h) * view.radius, cx = w / 2, cy = h / 2, TAU = Math.PI * 2;
        const a = -view.lon * D2R, b = view.lat * D2R;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // Atmosfera e corpo.
        let g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.2);
        g.addColorStop(0, "rgba(110, 80, 255, 0.5)");
        g.addColorStop(1, "rgba(110, 80, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, TAU); ctx.fill();
        g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.05, cx, cy, R);
        g.addColorStop(0, "rgba(80, 46, 255, 0.85)");
        g.addColorStop(0.55, "rgba(22, 6, 150, 0.9)");
        g.addColorStop(1, "rgba(4, 1, 58, 0.96)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        // Continentes: o verso aparece de leve, como um holograma.
        if (land) {
          const s = Math.max(1.2, R / 115);
          for (let pass = 0; pass < 2; pass++) {
            ctx.fillStyle = pass ? "#ffcc00" : "#dfe2ff";
            for (let i = 0, k = 0; i < land.length; i += 3, k++) {
              if (near[k] !== pass) continue;
              const x = land[i], y = land[i + 1], z = land[i + 2];
              const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
              const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
              if (z2 < 0) {
                ctx.globalAlpha = 0.07;
                ctx.fillRect(cx + x1 * R - s * 0.3, cy - y2 * R - s * 0.3, s * 0.6, s * 0.6);
                continue;
              }
              ctx.globalAlpha = pass ? 0.6 + z2 * 0.4 : 0.14 + z2 * 0.8;
              const dd = s * (0.7 + z2 * 0.5);
              ctx.fillRect(cx + x1 * R - dd / 2, cy - y2 * R - dd / 2, dd, dd);
            }
          }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = "rgba(180, 170, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
        // Rotas: uma linha fraca e um cometa amarelo indo de Salvador ao destino.
        ctx.lineCap = "round";
        routes.forEach((rt) => {
          const P = rt.pts;
          for (let k = 0; k <= rt.N; k++) {
            const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
            const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
            const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
            rt.sx[k] = cx + x1 * R; rt.sy[k] = cy - y2 * R;
            rt.vis[k] = z2 > 0 || x1 * x1 + y2 * y2 > 1 ? 1 : 0;
          }
          ctx.strokeStyle = "rgba(255, 204, 0, 0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let k = 1; k <= rt.N; k++) if (rt.vis[k] && rt.vis[k - 1]) { ctx.moveTo(rt.sx[k - 1], rt.sy[k - 1]); ctx.lineTo(rt.sx[k], rt.sy[k]); }
          ctx.stroke();
          const ph = ((time + rt.delay) % (rt.dur + 2.2)) / rt.dur;
          if (ph > 1.35) return;
          const head = Math.min(ph, 1) * rt.N, tail = Math.max(0, (ph - 0.35) * rt.N);
          for (let k = Math.floor(tail); k < Math.ceil(head) && k < rt.N; k++) {
            if (!rt.vis[k] || !rt.vis[k + 1]) continue;
            const f = (k - tail) / Math.max(1, head - tail);
            ctx.strokeStyle = `rgba(255, ${(205 + f * 45) | 0}, ${(f * 150) | 0}, ${(0.2 + f * 0.8).toFixed(2)})`;
            ctx.lineWidth = 0.8 + f * 1.8;
            ctx.beginPath(); ctx.moveTo(rt.sx[k], rt.sy[k]); ctx.lineTo(rt.sx[k + 1], rt.sy[k + 1]); ctx.stroke();
          }
          if (ph > 1 && rt.vis[rt.N]) {
            const q = (ph - 1) / 0.35;
            ctx.strokeStyle = `rgba(255, 204, 0, ${(1 - q).toFixed(2)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(rt.sx[rt.N], rt.sy[rt.N], 2 + q * 9, 0, TAU); ctx.stroke();
          }
        });
        // Salvador.
        const hx = HOME[0] * ca + HOME[2] * sa, hz1 = -HOME[0] * sa + HOME[2] * ca;
        const hy = HOME[1] * cb - hz1 * sb, hz = HOME[1] * sb + hz1 * cb;
        if (hz > 0) {
          const px = cx + hx * R, py = cy - hy * R, q = (time * 0.6) % 1;
          ctx.strokeStyle = `rgba(255, 204, 0, ${(0.9 * (1 - q)).toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(px, py, 4 + q * 24, 0, TAU); ctx.stroke();
          ctx.fillStyle = "#ffcc00";
          ctx.beginPath(); ctx.arc(px, py, 3.8, 0, TAU); ctx.fill();
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
          ctx.fillText("SALVADOR", px + 11, py - 9);
        }
      },
    };
  }

  return { particles, textShape, imageShape, globe };
})();
