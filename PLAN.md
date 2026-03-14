# Plan de Desarrollo — blog-drakk3
Fecha: 2026-03-14
Stack: Astro 5.x · MDX · Tailwind CSS 3 · TypeScript · @tailwindcss/typography

---

## Resumen ejecutivo

El proyecto es un blog Astro con colección `blog` (`.md` y `.mdx`), un único
layout `BlogPost.astro`, enrutamiento vía `[...slug].astro` y Tailwind con el
plugin `@tailwindcss/typography`. MDX ya está integrado y funcionando.

El objetivo es añadir un sistema de tipos de contenido (`post | essay | poem`)
que permita layouts diferenciados sin romper los posts existentes, que no
tienen campo `type` en su frontmatter.

---

## Dependencias entre funcionalidades

```
[Fase 1] Schema + retrocompat
    └── [Fase 2] Utility readingTime
         └── [Fase 3] TableOfContents
              └── [Fase 4] EssayLayout  ←── depende de Fase 2 y 3
                   └── [Fase 5] Componentes MDX de ensayo
                        └── [Fase 6] Divider
                             └── [Fase 7] ShareButtons
                                  └── [Fase 8] Enrutamiento por tipo
```

---

## Fase 1 — Campo `type` en el schema (fundación)

**Objetivo:** Añadir el campo sin romper posts existentes.

### `src/content/config.ts` — MODIFICAR
Añadir al objeto `z.object({...})`:
```ts
type: z.enum(['post', 'essay', 'poem']).default('post'),
```
El `.default('post')` es la clave de retrocompatibilidad: todos los posts
existentes sin `type` en su frontmatter recibirán `'post'` automáticamente.
Zod no lanzará error de validación.

**Riesgo:** Ninguno. El `default` opera en tiempo de build; los posts `.md`
existentes no necesitan modificarse.

**Verificación:** `astro build` debe completar sin errores de schema.

---

## Fase 2 — Utility `readingTime`

**Objetivo:** Función pura que recibe texto plano y devuelve minutos estimados.

### `src/utils/readingTime.ts` — CREAR
```ts
// ~200 palabras/minuto (promedio lectura español)
export function readingTime(content: string): number {
  const words = content.trim().split(/[\s\n\r\t]+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
```

**Consideraciones técnicas:**
- En Astro 5, `post.body` contiene el texto MDX/Markdown raw sin frontmatter.
- El string puede incluir imports JSX y componentes (`<Callout>`). El impacto
  en el conteo es mínimo (~2-4% de varianza en textos largos).

---

## Fase 3 — Componente `TableOfContents.astro`

**Objetivo:** Índice navegable sticky en desktop, colapsable en mobile.

### `src/components/TableOfContents.astro` — CREAR

**Props:**
```ts
interface Props {
  headings: { depth: number; slug: string; text: string }[];
}
```

**Estrategia:**

Astro extrae headings automáticamente: `const { headings } = await post.render()`.
El array tiene la forma `{ depth: 2 | 3, slug: string, text: string }[]`.

Estructura:
1. Filtrar solo `depth === 2` y `depth === 3`.
2. En desktop (`lg:`): posición `sticky top-24`, sidebar en el grid de EssayLayout.
3. En mobile: `<details>/<summary>` nativo (sin JS extra) para colapsable.
4. Highlight activo: `IntersectionObserver` en `<script>` que observa cada
   heading con `id` y añade/quita clase `toc-active`.

**Consideraciones técnicas:**
- Los slugs los genera remark automáticamente en kebab-case. No se necesita `slugify`.
- ViewTransitions está activo en `Base.astro`. El `IntersectionObserver` debe
  re-inicializarse en `astro:page-load` para no perder el listener tras navegación SPA.
- Si `headings` es vacío, el componente no debe renderizar nada (`{headings.length > 0 && (...)}`).

---

## Fase 4 — `EssayLayout.astro`

**Objetivo:** Layout de dos columnas (sidebar TOC + contenido), barra de
progreso, drop cap, tipografía serif y reading time en el header.

### `src/layouts/EssayLayout.astro` — CREAR

**Props:**
```ts
type Props = CollectionEntry<'blog'>['data'] & {
  prev?: CollectionEntry<'blog'> | null;
  next?: CollectionEntry<'blog'> | null;
  headings: { depth: number; slug: string; text: string }[];
  readingTime: number;
};
```

**Estructura del layout:**
```
<Base>
  <!-- Barra de progreso (fixed, top: 0) -->
  <div id="reading-progress" class="fixed top-0 left-0 h-1 bg-zinc-800 dark:bg-zinc-100 z-50 w-0" />

  <article class="mx-auto max-w-screen-lg px-4">
    <!-- Header del ensayo -->
    <header class="mb-12 text-center">
      <h1>          <!-- texto serif, text-4xl/5xl -->
      <div>         <!-- meta: fecha · reading time · categoría -->
    </header>

    <div class="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
      <!-- Sidebar TOC (solo desktop) -->
      <aside class="hidden lg:block">
        <TableOfContents headings={headings} />
      </aside>

      <!-- Contenido principal -->
      <div class="prose prose-essay ...">
        <!-- TOC colapsable mobile -->
        <div class="lg:hidden mb-8">
          <TableOfContents headings={headings} />
        </div>
        <slot />
      </div>
    </div>

    <!-- Tags + nav prev/next -->
  </article>
</Base>
```

**Barra de progreso — script de cliente:**
```js
const bar = document.getElementById('reading-progress');
const update = () => {
  const total = document.body.scrollHeight - window.innerHeight;
  bar.style.width = total > 0 ? `${(window.scrollY / total) * 100}%` : '0%';
};
window.addEventListener('scroll', update, { passive: true });
document.addEventListener('astro:page-load', () => {
  window.addEventListener('scroll', update, { passive: true });
});
```

### `tailwind.config.cjs` — MODIFICAR

Añadir en `theme.extend`:
```js
fontFamily: {
  serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
},
```

Añadir variante `essay` en la config de `typography`:
```js
essay: {
  css: {
    fontFamily: 'Georgia, Cambria, serif',
    fontSize: '1.125rem',
    lineHeight: '1.8',
    'p:first-of-type::first-letter': {
      float: 'left',
      fontSize: '3.5em',
      lineHeight: '0.8',
      marginRight: '0.1em',
      marginTop: '0.1em',
      fontWeight: '700',
    },
  },
},
```

---

## Fase 5 — Componentes MDX para ensayos

Todos en `src/components/mdx/`. Se importan en cada `.mdx` de ensayo.

### `src/components/mdx/ImageBlock.astro` — CREAR
Props: `src: string`, `alt: string`, `caption?: string`, `wide?: boolean`

Renderiza `<figure>` con `<Image>` de Astro y `<figcaption>` opcional.
La prop `wide` aplica `not-prose` + márgenes negativos para "bleed" fuera del prose.

### `src/components/mdx/PullQuote.astro` — CREAR
Props: slot para contenido, `author?: string`

Cita destacada en tamaño grande, centrada, con borde lateral decorativo o
comillas tipográficas. Usa `not-prose` para escapar los estilos de blockquote
ya definidos en `tailwind.config.cjs`.

### `src/components/mdx/Callout.astro` — CREAR
Props: `type?: 'info' | 'warning' | 'tip'`, slot para contenido.

Caja coloreada según `type`. Clases: `border-l-4 pl-4 py-2` con variantes de color.

### `src/components/mdx/Footnote.astro` — CREAR
Props: `id: string`, slot para texto.

Renderiza `<sup><a href="#fn-{id}">n</a></sup>` inline. El autor coloca
`<FootnoteList>` al pie del MDX, o un `<aside>` manual.

**Consideraciones:**
- Estos componentes se importan en cada `.mdx` manualmente, NO se registran
  globalmente, para no afectar posts `.md` existentes.
- Alternativa: registrar en `[...slug].astro` via `components={{ ImageBlock, ... }}`
  solo cuando `post.data.type === 'essay'`.

---

## Fase 6 — `Divider.astro`

### `src/components/mdx/Divider.astro` — CREAR
```astro
---
interface Props {
  style?: 'stars' | 'line' | 'ornament';
}
const { style = 'stars' } = Astro.props;
---
<div class="not-prose my-12 flex items-center justify-center gap-4 text-zinc-400 dark:text-zinc-600">
  {style === 'stars' && <><span>✦</span><span>✦</span><span>✦</span></>}
  {style === 'line' && <hr class="w-24 border-zinc-300 dark:border-zinc-700" />}
  {style === 'ornament' && <span class="text-2xl">❧</span>}
</div>
```

**Nota:** Para usarlo en lugar de `---`, importarlo explícitamente en el `.mdx`.
Alternativa: sobreescribir `hr` en el objeto `components` de `[...slug].astro`.

---

## Fase 7 — `ShareButtons.astro`

### `src/components/ShareButtons.astro` — CREAR
Props: `title: string`, `url: string`

Tres botones:
1. **X:** `https://twitter.com/intent/tweet?text={title}&url={url}`
2. **WhatsApp:** `https://wa.me/?text={title} {url}`
3. **Copiar link:** `navigator.clipboard.writeText(url)` con feedback visual.

Reutiliza `CopyIcon.astro` ya existente en `src/components/icons/`.

### `src/layouts/EssayLayout.astro` — MODIFICAR (Fase 4)
Añadir `<ShareButtons title={title} url={Astro.url.href} />` antes de la nav prev/next.

### `src/layouts/BlogPost.astro` — MODIFICAR (opcional)
Si se quiere share también en posts normales, añadir el mismo bloque.

---

## Fase 8 — Enrutamiento por tipo

### `src/pages/blog/[...slug].astro` — MODIFICAR

Cambios en el script del frontmatter:
```ts
// Añadir imports
import EssayLayout from '@layouts/EssayLayout.astro';
import { readingTime } from '@utils/readingTime';

// Después de post.render():
const { Content, headings } = await post.render();
const readingMinutes = readingTime(post.body);
const postType = post.data.type ?? 'post';
```

Template condicional:
```astro
{postType === 'essay' ? (
  <EssayLayout {...post.data} prev={prev} next={next} headings={headings} readingTime={readingMinutes}>
    <Content components={{ pre: Code }} />
  </EssayLayout>
) : (
  <BlogPost {...post.data} prev={prev} next={next}>
    <Content components={{ pre: Code }} />
  </BlogPost>
)}
```

---

## Retrocompatibilidad — garantías

| Escenario | Resultado |
|-----------|-----------|
| Post `.md` sin `type` | `type = 'post'` (Zod default) → `BlogPost.astro` |
| Post `.md` con `type: 'post'` | `BlogPost.astro` |
| Post `.mdx` sin `type` | `type = 'post'` (Zod default) → `BlogPost.astro` |
| Post `.mdx` con `type: 'essay'` | `EssayLayout.astro` |
| Post `.mdx` con `type: 'poem'` | `BlogPost.astro` (se puede añadir `PoemLayout` después) |
| `astro build` sin ningún essay | Compila sin error; `EssayLayout` no se instancia |

---

## Árbol de archivos resultante

```
src/
├── content/
│   └── config.ts                    MODIFICAR — añadir campo type
├── utils/
│   ├── readingTime.ts               CREAR
│   ├── slug.ts                      sin cambios
│   └── getAllTags.ts                 sin cambios
├── layouts/
│   ├── Base.astro                   sin cambios
│   ├── BlogPost.astro               MODIFICAR (opcional: añadir ShareButtons)
│   └── EssayLayout.astro            CREAR
├── components/
│   ├── TableOfContents.astro        CREAR
│   ├── ShareButtons.astro           CREAR
│   └── mdx/
│       ├── Code.astro               sin cambios
│       ├── Divider.astro            CREAR
│       ├── ImageBlock.astro         CREAR
│       ├── PullQuote.astro          CREAR
│       ├── Callout.astro            CREAR
│       └── Footnote.astro           CREAR
└── pages/
    └── blog/
        └── [...slug].astro          MODIFICAR — enrutamiento por tipo
tailwind.config.cjs                  MODIFICAR — fontFamily.serif + prose-essay
```

---

## Riesgos y consideraciones técnicas

### 1. ViewTransitions y scripts de cliente
`Base.astro` usa `<ViewTransitions />`. Los scripts en `EssayLayout` (barra de
progreso, TOC highlight) deben escuchar `astro:page-load` además del
`DOMContentLoaded` implícito. De lo contrario fallan tras la primera navegación SPA.

### 2. `prose-essay` y purging de Tailwind
Tailwind purga clases no encontradas en el HTML estático. Si `prose-essay` solo
aparece en `EssayLayout`, añadir la clase directamente en el template
(no generarla con JS dinámico).

### 3. `post.body` vs contenido renderizado
`post.body` es el Markdown/MDX raw. Para el conteo de palabras es suficiente
y más preciso que contar HTML renderizado.

### 4. Imágenes en `ImageBlock.astro`
El componente `<Image>` de Astro requiere `width` y `height` para imágenes
locales en build time. Para imágenes remotas (strings `https://...`) pasar
como props opcionales. Seguir el mismo patrón que `BlogPost.astro`.

### 5. Conflicto blockquote con `PullQuote`
`tailwind.config.cjs` ya tiene `blockquote::before` con `"`. `PullQuote`
debe usar `not-prose` en su wrapper para escapar estos estilos.

### 6. Orden de implementación es estricto
No implementar Fase 4 antes de Fase 3, ni Fase 8 antes de Fase 4.
Las fases 5, 6 y 7 son independientes entre sí una vez que Fase 4 existe.

---

## Checklist de implementación

- [ ] **Fase 1:** Modificar `src/content/config.ts` — añadir `type` con `.default('post')`
- [ ] **Fase 1:** Verificar `astro build` sin errores de schema
- [ ] **Fase 2:** Crear `src/utils/readingTime.ts`
- [ ] **Fase 3:** Crear `src/components/TableOfContents.astro` con `IntersectionObserver`
- [ ] **Fase 4:** Modificar `tailwind.config.cjs` — serif + prose-essay
- [ ] **Fase 4:** Crear `src/layouts/EssayLayout.astro`
- [ ] **Fase 5:** Crear `src/components/mdx/ImageBlock.astro`
- [ ] **Fase 5:** Crear `src/components/mdx/PullQuote.astro`
- [ ] **Fase 5:** Crear `src/components/mdx/Callout.astro`
- [ ] **Fase 5:** Crear `src/components/mdx/Footnote.astro`
- [ ] **Fase 6:** Crear `src/components/mdx/Divider.astro`
- [ ] **Fase 7:** Crear `src/components/ShareButtons.astro`
- [ ] **Fase 7:** Añadir `ShareButtons` en `EssayLayout.astro`
- [ ] **Fase 8:** Modificar `src/pages/blog/[...slug].astro`
- [ ] **Fase 8:** Crear primer ensayo de prueba con `type: 'essay'` en su frontmatter
- [ ] **Verificación final:** `astro build` limpio · posts anteriores sin cambios visuales
