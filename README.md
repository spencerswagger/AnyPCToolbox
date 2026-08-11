# AnyPCToolbox

A cross-platform PC toolbox built with Vue 3 + TypeScript, featuring a Markdown editor and a JSON editor. Pure frontend SPA, fully offline-capable, no backend required.

## Features

- **Markdown Editor** - Write and preview Markdown in real-time, with syntax highlighting and HTML export
- **JSON Editor** - Format, compress, validate JSON data with syntax-colored tree preview
- **Dark/Light Theme** - One-click theme toggle with system preference auto-detection
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Fully Offline** - All dependencies installed locally, runs entirely in the browser
- **File Operations** - Import/export files and copy to clipboard

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Build | Vite 6 | Fast HMR and production builds |
| Framework | Vue 3 + TypeScript | Composition API component system |
| Routing | Vue Router 4 | Hash-based SPA routing |
| Styling | Tailwind CSS 3.4 + shadcn/ui | Utility-first CSS with Radix UI primitives |
| Markdown | markdown-it 14 + highlight.js 11 | Markdown parsing with code highlighting |
| Icons | Lucide Vue Next | Consistent icon set |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

The output will be in the `dist/` directory, ready to be served by any static file server.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
anypctoolbox/
├── src/
│   ├── App.vue                  # Root component (layout + router-view)
│   ├── main.ts                  # Entry point
│   ├── style.css                # Global styles + Tailwind directives + JSON syntax colors
│   ├── router/
│   │   └── index.ts             # Route configuration (hash history)
│   ├── views/
│   │   ├── Home.vue             # Tool card grid landing page
│   │   ├── Markdown.vue         # Markdown editor with split-pane preview
│   │   └── Json.vue             # JSON editor with format/validate/tree preview
│   ├── components/
│   │   ├── AppLayout.vue        # Shared layout with header and theme toggle
│   │   ├── ThemeToggle.vue      # Sun/Moon theme toggle button
│   │   └── ToolCard.vue         # Clickable tool card with icon, name, description
│   ├── composables/
│   │   └── useTheme.ts          # Theme state management with localStorage persistence
│   └── lib/
│       ├── utils.ts             # cn() helper for Tailwind class merging
│       ├── markdown.ts          # markdown-it parser with highlight.js integration
│       └── json.ts              # JSON validation, formatting, and syntax highlighting
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
└── components.json              # shadcn/ui configuration
```

## Available Tools

### Markdown Editor (`/markdown`)

- Real-time preview with split-pane layout (side-by-side on desktop, stacked on mobile)
- GitHub Flavored Markdown support
- Code syntax highlighting via highlight.js
- Import `.md` files from local filesystem
- Export content as `.md` files
- Copy content to clipboard

### JSON Editor (`/json`)

- Format (pretty-print with indentation) and compress (single-line) JSON
- JSON validation with error message display
- Syntax-colored tree preview (keys, strings, numbers, booleans, null)
- Status bar with validation status, line count, character count, and byte size
- Import `.json` files from local filesystem
- Export content as `.json` files
- Copy content to clipboard

## Theme

The application supports both light and dark modes:

- Theme preference is persisted in `localStorage`
- Defaults to system preference via `prefers-color-scheme`
- Toggle via the sun/moon button in the header
- CSS variable-driven theming through shadcn/ui design tokens

## Deployment

Since this is a pure static SPA, you can deploy the `dist/` folder to any static hosting:

```bash
npm run build
# Serve dist/ via any static file server
```

## License

MIT