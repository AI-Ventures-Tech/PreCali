# PreCali Web

Landing B2C estática de PreCali para comparar créditos por país y presentar la futura línea de seguros. Está construida en HTML, CSS y JavaScript puro para preservar la estética original y desplegarse sin build.

## Archivos principales

```text
index.html       Estructura principal de la página
styles.css       Estética, layout, animaciones y responsive
data.js          Países, bancos, condiciones y textos regionales
app.js           Calculadora, resultados, análisis y modales
privacidad.html  Política de privacidad
terminos.html    Términos y condiciones
vercel.json      Configuración mínima para Vercel
```

## Validación local

Desde la carpeta del proyecto:

```cmd
node --check app.js
node --check data.js
py -m http.server 3011 --bind 127.0.0.1
```

Abrir:

```text
http://127.0.0.1:3011/?fresh=local
```

## Deploy en Vercel

Opción recomendada con Vercel CLI:

```cmd
cd /d "G:\PreCali Web"
npx vercel
```

Para producción:

```cmd
cd /d "G:\PreCali Web"
npx vercel --prod
```

Cuando Vercel pregunte por framework, seleccionar `Other` si aparece. No hay comando de build ni directorio de salida: se publica la carpeta raíz.

## Notas de producto

- La calculadora de créditos está activa.
- Costa Rica tiene datos operativos; los demás países están estructurados para validación regional.
- Seguros existe como sección separada para no mezclarlo con la lógica crediticia.
- La página no usa backend todavía; todo el cálculo actual corre en el navegador.
