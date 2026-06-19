# LaSuMa — Calculadora de Parque Eólico

Herramienta interactiva de **dimensionado y análisis económico** de un parque eólico onshore. **Sin instalación, sin servidor, sin paso de build**: se abre directo en el navegador (incluso offline, con doble clic en `index.html`).

🔗 **Versión online:** https://mateovargas0305-cmyk.github.io/LaSuMa/

## Características

- **Dimensionado del parque** — número de aerogeneradores, potencia unitaria, diámetro de rotor, factor de capacidad y separaciones entre turbinas.
- **Layout interactivo 2D** — disposición en grilla (alineada o al tresbolillo), arrastre de turbinas, dirección de viento configurable con estelas y rotación del parque.
- **Vista 3D del parque** — recorrido tridimensional con aerogeneradores realistas (rotores animados), terreno, iluminación y sombras, cámara orbital. Renderizado con Three.js embebido para funcionar offline.
- **Análisis económico** — CAPEX, OPEX, generación anual, VAN, TIR, LCOE y flujo de fondos, contemplando el régimen de incentivos **RIGI**.
- **Diseño responsive** — pensado para escritorio y mobile.

## Uso

- **Online:** abrí el [link de GitHub Pages](https://mateovargas0305-cmyk.github.io/LaSuMa/).
- **Local:** descargá/cloná el repositorio y abrí `index.html` con doble clic en cualquier navegador moderno (funciona offline, sin servidor).

## Estructura

```
index.html          → marcado + carga de estilos y scripts
css/styles.css      → estilos
js/
├ economics.js      → modelo financiero (VAN/TIR/LCOE/RIGI) y gráfico de cashflow
├ park2d.js         → diagrama 2D del parque, brújulas, viewport y animación
├ app.js            → estado de UI, cálculo del parque, controles, informe/export, init
├ park3d.js         → vista 3D (motor propio sobre Three.js)
└ three.min.js      → librería Three.js (r158), local para funcionar offline
```

## Tecnología

HTML + CSS + JavaScript puro, con `<script>` clásicos (sin módulos ni bundler) para que abra por `file://` sin build. La vista 3D usa [Three.js](https://threejs.org/) (r158) servido localmente para preservar la portabilidad offline.

---

Proyecto académico de análisis de inversión en energía eólica.
