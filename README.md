# LaSuMa — Calculadora de Parque Eólico

Herramienta interactiva de **dimensionado y análisis económico** de un parque eólico onshore. Todo corre en un **único archivo HTML autocontenido** (sin instalación, sin servidor, sin dependencias externas): se abre directo en el navegador y también funciona offline.

🔗 **Versión online:** https://mateovargas0305-cmyk.github.io/LaSuMa/

## Características

- **Dimensionado del parque** — número de aerogeneradores, potencia unitaria, diámetro de rotor, factor de capacidad y separaciones entre turbinas.
- **Layout interactivo 2D** — disposición en grilla (alineada o al tresbolillo), arrastre de turbinas, dirección de viento configurable con estelas y rotación del parque.
- **Vista 3D del parque** — recorrido tridimensional con aerogeneradores realistas (rotores animados), terreno, iluminación y sombras, cámara orbital. Renderizado con Three.js embebido para funcionar offline.
- **Análisis económico** — CAPEX, OPEX, generación anual, VAN, TIR, LCOE y flujo de fondos, contemplando el régimen de incentivos **RIGI**.
- **Diseño responsive** — pensado para escritorio y mobile.

## Uso

- **Online:** abrí el [link de GitHub Pages](https://mateovargas0305-cmyk.github.io/LaSuMa/).
- **Local:** descargá `lasuma_calculadora_eolica_v22.html` y abrilo con doble clic en cualquier navegador moderno.

## Tecnología

HTML + CSS + JavaScript puro en un solo archivo. La vista 3D usa [Three.js](https://threejs.org/) (r158) embebido inline para preservar la portabilidad offline.

---

Proyecto académico de análisis de inversión en energía eólica.
