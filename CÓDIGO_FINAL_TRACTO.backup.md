# CÃ³digo Completo do Projeto Tracto

 Aqui estÃ£o todos os arquivos de configuraÃ§Ã£o e cÃ³digo fonte do projeto.

### `eslint.config.js`
```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

```


### `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tracto â€” InteligÃªncia AgronÃ´mica</title>
    <meta name="description" content="Tracto une tecnologia orbital e inteligÃªncia agronÃ´mica para decisÃµes de alta precisÃ£o na sua lavoura." />
    <meta property="og:title" content="Tracto â€” InteligÃªncia AgronÃ´mica" />
    <meta property="og:description" content="Monitoramento de talhÃµes, alertas climÃ¡ticos e IA agronÃ´mica na palma da sua mÃ£o." />
    <meta property="og:type" content="website" />
    <script src="https://www.google.com/recaptcha/api.js?render=%VITE_RECAPTCHA_SITE_KEY%"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```


### `package.json`
```json
{
  "name": "tracto",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.99.1",
    "@tailwindcss/vite": "^4.2.1",
    "@types/leaflet": "^1.9.21",
    "@types/uuid": "^10.0.0",
    "axios": "^1.13.6",
    "framer-motion": "^12.36.0",
    "jspdf": "^4.2.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-is": "^19.2.4",
    "react-leaflet": "^5.0.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.13.1",
    "recharts": "^3.8.0",
    "tailwindcss": "^4.2.1",
    "uuid": "^13.0.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/node": "^24.12.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.56.1",
    "vite": "^8.0.0"
  }
}

```


### `vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
})

```


### `tsconfig.json`
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}

```


### `src/App.css`
```css
.counter {
  font-size: 16px;
  padding: 5px 10px;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  transition: border-color 0.3s;
  margin-bottom: 24px;

  &:hover {
    border-color: var(--accent-border);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

.hero {
  position: relative;

  .base,
  .framework,
  .vite {
    inset-inline: 0;
    margin: 0 auto;
  }

  .base {
    width: 170px;
    position: relative;
    z-index: 0;
  }

  .framework,
  .vite {
    position: absolute;
  }

  .framework {
    z-index: 1;
    top: 34px;
    height: 28px;
    transform: perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg)
      scale(1.4);
  }

  .vite {
    z-index: 0;
    top: 107px;
    height: 26px;
    width: auto;
    transform: perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg)
      scale(0.8);
  }
}

#center {
  display: flex;
  flex-direction: column;
  gap: 25px;
  place-content: center;
  place-items: center;
  flex-grow: 1;

  @media (max-width: 1024px) {
    padding: 32px 20px 24px;
    gap: 18px;
  }
}

#next-steps {
  display: flex;
  border-top: 1px solid var(--border);
  text-align: left;

  & > div {
    flex: 1 1 0;
    padding: 32px;
    @media (max-width: 1024px) {
      padding: 24px 20px;
    }
  }

  .icon {
    margin-bottom: 16px;
    width: 22px;
    height: 22px;
  }

  @media (max-width: 1024px) {
    flex-direction: column;
    text-align: center;
  }
}

#docs {
  border-right: 1px solid var(--border);

  @media (max-width: 1024px) {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}

#next-steps ul {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 8px;
  margin: 32px 0 0;

  .logo {
    height: 18px;
  }

  a {
    color: var(--text-h);
    font-size: 16px;
    border-radius: 6px;
    background: var(--social-bg);
    display: flex;
    padding: 6px 12px;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: box-shadow 0.3s;

    &:hover {
      box-shadow: var(--shadow);
    }
    .button-icon {
      height: 18px;
      width: 18px;
    }
  }

  @media (max-width: 1024px) {
    margin-top: 20px;
    flex-wrap: wrap;
    justify-content: center;

    li {
      flex: 1 1 calc(50% - 8px);
    }

    a {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }
  }
}

#spacer {
  height: 88px;
  border-top: 1px solid var(--border);
  @media (max-width: 1024px) {
    height: 48px;
  }
}

.ticks {
  position: relative;
  width: 100%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: -4.5px;
    border: 5px solid transparent;
  }

  &::before {
    left: 0;
    border-left-color: var(--border);
  }
  &::after {
    right: 0;
    border-right-color: var(--border);
  }
}

```


### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Weather from './pages/Weather';
import Chat from './pages/Chat';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Market from './pages/Market';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="weather" element={<Weather />} />
          <Route path="chat" element={<Chat />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="market" element={<Market />} />
          <Route path="billing" element={<Pricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

```




### `src/assets/hero-farm.jpg`
```jpg
[Arquivo binÃ¡rio: src/assets/hero-farm.jpg]
```


### `src/assets/hero.png`
```png
[Arquivo binÃ¡rio: src/assets/hero.png]
```


### `src/assets/react.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>
```


### `src/assets/vite.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="77" height="47" fill="none" aria-labelledby="vite-logo-title" viewBox="0 0 77 47"><title id="vite-logo-title">Vite</title><style>.parenthesis{fill:#000}@media (prefers-color-scheme:dark){.parenthesis{fill:#fff}}</style><path fill="#9135ff" d="M40.151 45.71c-.663.844-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.493c-.92 0-1.457-1.04-.92-1.788l7.479-10.471c1.07-1.498 0-3.578-1.842-3.578H15.443c-.92 0-1.456-1.04-.92-1.788l9.696-13.576c.213-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.472c-1.07 1.497 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.087.89 1.83L40.153 45.712z"/><mask id="a" width="48" height="47" x="14" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#000" d="M40.047 45.71c-.663.843-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.389c-.92 0-1.457-1.04-.92-1.788l7.479-10.472c1.07-1.497 0-3.578-1.842-3.578H15.34c-.92 0-1.456-1.04-.92-1.788l9.696-13.575c.213-.297.556-.474.92-.474H53.93c.92 0 1.456 1.04.92 1.788L47.37 13.03c-1.07 1.498 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.088.89 1.831L40.049 45.712z"/></mask><g mask="url(#a)"><g filter="url(#b)"><ellipse cx="5.508" cy="14.704" fill="#eee6ff" rx="5.508" ry="14.704" transform="rotate(269.814 20.96 11.29)scale(-1 1)"/></g><g filter="url(#c)"><ellipse cx="10.399" cy="29.851" fill="#eee6ff" rx="10.399" ry="29.851" transform="rotate(89.814 -16.902 -8.275)scale(1 -1)"/></g><g filter="url(#d)"><ellipse cx="5.508" cy="30.487" fill="#8900ff" rx="5.508" ry="30.487" transform="rotate(89.814 -19.197 -7.127)scale(1 -1)"/></g><g filter="url(#e)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.928 4.177)scale(1 -1)"/></g><g filter="url(#f)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.738 5.52)scale(1 -1)"/></g><g filter="url(#g)"><ellipse cx="14.072" cy="22.078" fill="#eee6ff" rx="14.072" ry="22.078" transform="rotate(93.35 31.245 55.578)scale(-1 1)"/></g><g filter="url(#h)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#i)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#j)"><ellipse cx="14.592" cy="9.743" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(39.51 14.592 9.743)"/></g><g filter="url(#k)"><ellipse cx="61.728" cy="-5.321" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 61.728 -5.32)"/></g><g filter="url(#l)"><ellipse cx="55.618" cy="7.104" fill="#00c2ff" rx="5.971" ry="9.665" transform="rotate(37.892 55.618 7.104)"/></g><g filter="url(#m)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#n)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#o)"><ellipse cx="49.857" cy="30.678" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 49.857 30.678)"/></g><g filter="url(#p)"><ellipse cx="52.623" cy="33.171" fill="#00c2ff" rx="5.971" ry="15.297" transform="rotate(37.892 52.623 33.17)"/></g></g><path d="M6.919 0c-9.198 13.166-9.252 33.575 0 46.789h6.215c-9.25-13.214-9.196-33.623 0-46.789zm62.424 0h-6.215c9.198 13.166 9.252 33.575 0 46.789h6.215c9.25-13.214 9.196-33.623 0-46.789" class="parenthesis"/><defs><filter id="b" width="60.045" height="41.654" x="-5.564" y="16.92" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="c" width="90.34" height="51.437" x="-40.407" y="-6.762" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="d" width="79.355" height="29.4" x="-35.435" y="2.801" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="e" width="79.579" height="29.4" x="-30.84" y="20.8" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="f" width="79.579" height="29.4" x="-29.307" y="21.949" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="g" width="74.749" height="58.852" x="29.961" y="-17.13" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="h" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="i" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="j" width="56.045" height="63.649" x="-13.43" y="-22.082" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="k" width="54.814" height="64.646" x="34.321" y="-37.644" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="l" width="33.541" height="35.313" x="38.847" y="-10.552" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="m" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="n" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="o" width="54.814" height="64.646" x="22.45" y="-1.645" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="p" width="39.409" height="43.623" x="32.919" y="11.36" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter></defs></svg>

```


### `src/components/FieldMap.tsx`
```tsx
import { useState, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polygon, Polyline, useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// â”€â”€ NASA GIBS date: use last month's first day for stable tiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const gibsDate = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10); // e.g. "2025-02-01"
})();

// â”€â”€ Map Click Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type DrawMode = 'none' | 'drawing';

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// â”€â”€ Functional Zoom Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-auto">
      {[
        { s: '+', action: () => map.zoomIn() },
        { s: 'âˆ’', action: () => map.zoomOut() },
      ].map(({ s, action }) => (
        <button
          key={s}
          onClick={action}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:text-white"
          style={{
            background: 'rgba(8,8,9,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function FieldMap() {
  const {
    currentLocation,
    savedLocations,
    createField,
    removeField,
    activeFarmId,
    activeMapLayer,
    setMapLayer: setActiveMapLayer,
  } = useAppStore();

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [-23.31028, -51.16278];

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (drawMode !== 'drawing') return;
    setDrawPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
  }, [drawMode]);

  const finishDrawing = async () => {
    if (!activeFarmId) {
      alert('Selecione ou crie uma fazenda antes de desenhar talhÃµes.');
      return;
    }
    if (drawPoints.length < 3) {
      alert('Marque pelo menos 3 pontos para criar um talhÃ£o.');
      return;
    }
    const name = fieldName.trim() || `TalhÃ£o ${savedLocations.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];
    
    try {
      await createField(activeFarmId, {
        lat: centroid[0],
        lng: centroid[1],
        name,
        boundaries: drawPoints,
        cultura: fieldCultura || undefined,
        dataPlantio: fieldDataPlantio || undefined,
        variedade: fieldVariedade || undefined,
      });
      
      setDrawPoints([]);
      setFieldName('');
      setFieldCultura('');
      setFieldDataPlantio('');
      setFieldVariedade('');
      setDrawMode('none');
    } catch (err) {
      alert('Erro ao salvar talhÃ£o. Tente novamente.');
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];

  const LAYERS: { key: typeof activeMapLayer; label: string }[] = [
    { key: 'satellite', label: 'SatÃ©lite' },
    { key: 'ndvi', label: 'NDVI' },
    { key: 'moisture', label: 'Umidade' },
  ];

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: drawMode === 'drawing' ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#0a0a0b' }}
        zoomControl={false}
      >
        {/* â”€â”€ Base satellite layer (always visible) â”€â”€ */}
        <TileLayer
          attribution="&copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
        />
        {/* Hybrid labels */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
          opacity={0.6}
        />

        {/* â”€â”€ NDVI layer (NASA GIBS â€” MODIS Terra 8-day) â”€â”€ */}
        {activeMapLayer === 'ndvi' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`}
            attribution="NASA GIBS Â· MODIS Terra NDVI"
            maxZoom={9}
            opacity={0.85}
          />
        )}

        {/* â”€â”€ Moisture layer (NASA GIBS â€” MODIS Terra Land Surface Temp as proxy) â”€â”€ */}
        {activeMapLayer === 'moisture' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.png`}
            attribution="NASA GIBS Â· MODIS Terra LST"
            maxZoom={9}
            opacity={0.75}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Current location marker */}
        {currentLocation && !savedLocations.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>ðŸ“ Sua localizaÃ§Ã£o atual</Popup>
          </Marker>
        )}

        {/* Saved fields */}
        {savedLocations.map((loc, idx) => {
          const color = FIELD_COLORS[idx % FIELD_COLORS.length];
          return (
            <Polygon
              key={loc.id || idx}
              positions={
                loc.boundaries ??
                [
                  [loc.lat - 0.003, loc.lng - 0.003],
                  [loc.lat - 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng - 0.003],
                ]
              }
              pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>ðŸŒ± {loc.cultura}</p>}
                  {loc.variedade && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>ðŸ”¬ {loc.variedade}</p>}
                  {loc.dataPlantio && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>ðŸ“… Plantio: {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}</p>}
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                    {loc.boundaries ? `${loc.boundaries.length} pontos` : 'TalhÃ£o'}
                  </p>
                  <button
                    onClick={() => activeFarmId && loc.id && removeField(activeFarmId, loc.id)}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    ðŸ—‘ Remover talhÃ£o
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}


        {/* Preview of drawing */}
        {drawMode === 'drawing' && drawPoints.length > 0 && (
          <>
            {drawPoints.length > 1 && (
              <Polyline
                positions={[...drawPoints, drawPoints[0]]}
                pathOptions={{ color: '#ec5b13', weight: 2, dashArray: '6 4', opacity: 0.85 }}
              />
            )}
            {drawPoints.map((pt, i) => (
              <Marker
                key={i}
                position={pt}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="width:10px;height:10px;background:#ec5b13;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
                  iconAnchor: [5, 5],
                })}
              />
            ))}
          </>
        )}

        {/* Functional zoom controls inside map */}
        <ZoomControls />
      </MapContainer>

      {/* â”€â”€ Overlays (outside MapContainer) â”€â”€ */}

      {/* Layer selector pills */}
      {drawMode === 'none' && (
        <div
          className="absolute top-4 left-4 z-[500] flex items-center gap-1 p-1 rounded-xl pointer-events-auto"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {LAYERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveMapLayer(key)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
              style={
                activeMapLayer === key
                  ? { background: 'rgba(236,91,19,0.2)', color: '#ec5b13' }
                  : { color: '#64748b' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Draw new field button */}
      {drawMode === 'none' && (
        <button
          onClick={() => setDrawMode('drawing')}
          className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 pointer-events-auto"
          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}
        >
          <span className="material-symbols-outlined text-base">add_location_alt</span>
          Desenhar TalhÃ£o
        </button>
      )}

      {/* Drawing mode controls */}
      {drawMode === 'drawing' && (
        <>
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none"
            style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,91,19,0.3)' }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>draw</span>
            Clique no mapa para marcar os vÃ©rtices &nbsp;Â·&nbsp; {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
          </div>

          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto"
            style={{ background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 420 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
              {drawPoints.length} pontos marcados Â· Novo TalhÃ£o
            </p>

            {/* Nome */}
            <input
              type="text"
              placeholder="Nome do talhÃ£o (ex: T01 â€“ Soja Norte)"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full bg-transparent border-none text-sm focus:outline-none text-white placeholder:text-slate-600 border-b pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            />

            {/* Cultura + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Cultura</p>
                <select
                  value={fieldCultura}
                  onChange={(e) => setFieldCultura(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                >
                  <option value="" style={{ background: '#0c0c0e' }}>Selecionar...</option>
                  <option value="Soja" style={{ background: '#0c0c0e' }}>Soja</option>
                  <option value="Milho" style={{ background: '#0c0c0e' }}>Milho</option>
                  <option value="AlgodÃ£o" style={{ background: '#0c0c0e' }}>AlgodÃ£o</option>
                  <option value="Trigo" style={{ background: '#0c0c0e' }}>Trigo</option>
                  <option value="Cana-de-aÃ§Ãºcar" style={{ background: '#0c0c0e' }}>Cana-de-aÃ§Ãºcar</option>
                  <option value="CafÃ©" style={{ background: '#0c0c0e' }}>CafÃ©</option>
                  <option value="Outro" style={{ background: '#0c0c0e' }}>Outro</option>
                </select>
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Data de plantio</p>
                <input
                  type="date"
                  value={fieldDataPlantio}
                  onChange={(e) => setFieldDataPlantio(e.target.value)}
                  className="w-full text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Variedade */}
            <input
              type="text"
              placeholder="Variedade / Cultivar (ex: M7739, DM 66i68)"
              value={fieldVariedade}
              onChange={(e) => setFieldVariedade(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none text-white placeholder:text-slate-600"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
            />

            {/* BotÃµes */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDrawPoints((p) => p.slice(0, -1))}
                disabled={drawPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                onClick={finishDrawing}
                disabled={drawPoints.length < 3}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-30"
                style={{ background: '#ec5b13' }}
              >
                Salvar TalhÃ£o
              </button>
              <button
                onClick={() => { setDrawPoints([]); setFieldName(''); setFieldCultura(''); setFieldDataPlantio(''); setFieldVariedade(''); setDrawMode('none'); }}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fields legend */}
      {drawMode === 'none' && savedLocations.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-[500] p-3 rounded-xl pointer-events-none"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>TalhÃµes</p>
          <div className="space-y-1">
            {savedLocations.map((loc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: FIELD_COLORS[i % FIELD_COLORS.length] }} />
                {loc.name ?? `TalhÃ£o ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NDVI legend */}
      {activeMapLayer === 'ndvi' && (
        <div
          className="absolute bottom-4 right-16 z-[500] p-3 rounded-xl pointer-events-none text-[10px]"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>NDVI â€” NASA GIBS</p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #a52a2a, #ffff00, #00aa00)' }} />
          </div>
          <div className="flex justify-between text-[9px] mt-0.5 text-slate-500">
            <span>Baixo</span><span>Alto</span>
          </div>
          <p className="mt-1 text-[9px]" style={{ color: '#475569' }}>Data: {gibsDate}</p>
        </div>
      )}
    </div>
  );
}

```


### `src/components/Layout.tsx`
```tsx
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabase';
import {
  RefreshCw,
  AlertCircle
} from 'lucide-react';



const NAV_ITEMS = [
  {
    to: '/app/dashboard',
    label: 'Mapa / TalhÃµes',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/weather',
    label: 'Meteorologia',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/chat',
    label: 'Chat IA',
    badge: 'IA',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/alerts',
    label: 'Alertas',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/reports',
    label: 'RelatÃ³rios',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/market',
    label: 'Mercado',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/billing',
    label: 'Assinatura',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
];

// â”€â”€ Sidebar content (shared between desktop & mobile drawer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SidebarContent({ onNavClick, handleLogout }: { onNavClick?: () => void, handleLogout: () => Promise<void> }) {
  const { alerts } = useAppStore();
  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;
  const [userName, setUserName] = useState('UsuÃ¡rio');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name
        || data.user?.email?.split('@')[0]
        || 'UsuÃ¡rio';
      setUserName(name);
    });
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--sidebar)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-base font-black tracking-[0.15em] text-white">TRACTO</h1>
        <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>Plataforma AgTech</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>NavegaÃ§Ã£o</p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.to === '/app/alerts' && activeAlertCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                {activeAlertCount}
              </span>
            )}
            {item.badge && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
              {userName === 'UsuÃ¡rio' ? 'Carregando...' : 'Administrador'}
            </p>
          </div>
          <button className="text-slate-600 hover:text-white transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">settings</span>
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sair do Portal
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Layout() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  const {
    activeFarmId,
    activeFieldId,
    farms,
    syncFromBackend,
    isSyncing,
    syncError,
    resetStore,
    weatherCache,
  } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncFromBackend();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncFromBackend();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromBackend]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetStore();
    navigate('/login');
  };

  // Determine active farm/field for display
  const activeFarm = activeFarmId ? farms.find(f => f.id === activeFarmId) : null;
  const activeField = activeFieldId && activeFarm ? activeFarm.fields.find(f => f.id === activeFieldId) : null;

  const loc = activeField || activeFarm || (farms[0]?.fields?.[0] || farms[0]);
  const displayActiveName = loc?.name || 'LocalizaÃ§Ã£o Atual';
  const temp = weatherCache ? `${Math.round(weatherCache.temperature)}Â°C` : 'â€”';
  const humidity = weatherCache ? `${weatherCache.humidity}%` : 'â€”';


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { font-family: 'Inter', sans-serif; background-color: #080809; color: #f1f5f9; -webkit-font-smoothing: antialiased; }

        :root {
          --primary: #ec5b13;
          --primary-dim: rgba(236,91,19,0.12);
          --primary-border: rgba(236,91,19,0.2);
          --bg: #080809;
          --sidebar: #0c0c0e;
          --surface: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.12);
          --muted: #64748b;
        }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          border-radius: 10px; font-size: 13px; font-weight: 500; color: #64748b;
          transition: all 0.15s ease; text-decoration: none; position: relative;
        }
        .nav-item:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
        .nav-item.active { color: #fff; background: var(--primary-dim); }
        .nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 20%; height: 60%;
          width: 3px; background: var(--primary); border-radius: 99px;
        }

        .card-glass { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
        .header-glass { background: rgba(8,8,9,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        /* Mobile drawer overlay */
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          transition: opacity 0.2s ease;
        }
        .drawer-panel {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 240px; z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .drawer-panel.open { transform: translateX(0); }
        .drawer-panel.closed { transform: translateX(-100%); }
      `}</style>

      <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* â”€â”€ Desktop Sidebar (hidden on mobile) â”€â”€ */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <SidebarContent handleLogout={handleLogout} />
        </aside>

        {/* â”€â”€ Mobile Drawer Overlay â”€â”€ */}
        {drawerOpen && (
          <div className="drawer-overlay md:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        {/* â”€â”€ Mobile Drawer Panel â”€â”€ */}
        <div className={`drawer-panel md:hidden ${drawerOpen ? 'open' : 'closed'}`} style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
          {/* Close button */}
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>close</span>
          </button>
          <SidebarContent onNavClick={() => setDrawerOpen(false)} handleLogout={handleLogout} />
        </div>

        {/* â”€â”€ Main Content â”€â”€ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* TopBar */}
          <header
            className="header-glass flex items-center justify-between px-4 md:px-6 h-14 border-b flex-shrink-0 z-30"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Left */}
            <div className="flex items-center gap-3 md:gap-5">
              {/* Hamburguer â€” mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Abrir menu"
              >
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>menu</span>
              </button>

              {/* Location */}
              <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>location_on</span>
                <div>
                  <p className="text-xs font-semibold text-white leading-tight truncate max-w-[140px] md:max-w-none">{displayActiveName}</p>
                  <p className="text-[10px] leading-tight hidden sm:block" style={{ color: 'var(--muted)' }}>LocalizaÃ§Ã£o atual</p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-5" style={{ background: 'var(--border-strong)' }} />

              {/* Weather / Sync Indicator â€” hidden on small mobile */}
              <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-white">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-white font-medium text-sm transition-all duration-300">
                      {displayActiveName}
                    </span>
                    <div className="flex items-center gap-2">
                      {isSyncing ? (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 animate-pulse">
                          <RefreshCw className="w-3 h-3"/>
                          <span>Sincronizando...</span>
                        </div>
                      ) : syncError ? (
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                          <AlertCircle className="w-3 h-3"/>
                          <span>Erro de Sync</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider font-light">
                          {user?.email || 'TRACTO DASHBOARD'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base" style={{ color: '#f97316' }}>wb_sunny</span>
                  {temp}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-400">humidity_percentage</span>
                  <span style={{ color: 'var(--muted)' }}>{humidity}</span>
                </span>
              </div>
            </div>

            {/* Right â€” Farm selector hidden on mobile */}
            <div className="flex items-center gap-2">
              {/* Farm select â€” desktop only */}
              <div className="relative hidden md:flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base pl-3" style={{ color: 'var(--primary)' }}>agriculture</span>
                <select
                  className="appearance-none bg-transparent border-none text-white text-xs font-semibold py-2 pl-2 pr-8 focus:outline-none cursor-pointer"
                  style={{ color: '#e2e8f0' }}
                  value={activeFarmId || ''}
                  onChange={(e) => useAppStore.getState().setActiveFarm(e.target.value)}
                >
                  {farms.length > 0 ? farms.map((f) => (
                    <option key={f.id} style={{ background: '#0c0c0e' }} value={f.id}>{f.name.toUpperCase()}</option>
                  )) : (
                    <option style={{ background: '#0c0c0e' }} disabled value="">Nenhuma fazenda</option>
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-2 pointer-events-none text-base" style={{ color: 'var(--muted)' }}>expand_more</span>
              </div>

              {/* New field button */}
              <button
                onClick={() => navigate('/app/dashboard')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'var(--primary)' }}
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span className="hidden md:inline">Novo TalhÃ£o</span>
              </button>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg transition-all" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2" style={{ background: '#ef4444', borderColor: 'var(--bg)' }} />
              </button>
            </div>
          </header>

          {/* Page Content â€” scrolls correctly on mobile */}
          <main className="flex-1 flex overflow-hidden min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}

```


### `src/components/ProtectedRoute.tsx`
```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';

// FunÃ§Ã£o para aplicar a mÃ¡scara visual de telefone brasileiro que vocÃª jÃ¡ usa no Register.tsx
const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  if (val.length > 6) return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  if (val.length > 2) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  if (val.length > 0) return `(${val}`;
  return val;
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Verificar sessÃ£o inicial
    supabase.auth.getSession().then(({ data }) => {
      
      setSession(data.session);
      
      const userPhone = data.session?.user?.user_metadata?.phone;
      if (data.session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    // 2. Escutar mudanÃ§as de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      const userPhone = session?.user?.user_metadata?.phone;
      if (session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // FunÃ§Ã£o para salvar o telefone no perfil do Supabase quando o usuÃ¡rio digita
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Por favor, insira um nÃºmero de WhatsApp vÃ¡lido.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { phone: cleanPhone }
      });

      if (error) throw error;
      
      setNeedsPhone(false);
    } catch (err: unknown) {
      console.error('ProtectedRoute Error:', err);
      alert('Erro ao salvar o telefone. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl animate-spin" style={{ color: '#ec5b13' }}>refresh</span>
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>Verificando sessÃ£o...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se a sessÃ£o existe mas o telefone estÃ¡ em falta, interceptamos e mostramos a tela de bloqueio
  if (needsPhone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 z-[9999] relative" style={{ background: '#080809' }}>
        <div className="w-full max-w-md p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl relative z-10" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="text-center mb-8">
            <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Quase lÃ¡! Precisamos do seu contato</p>
          </div>

          <form onSubmit={handleSavePhone} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">WhatsApp para Alertas</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                placeholder="(11) 99999-9999"
                required
              />
              <p className="text-[10px] text-slate-500 ml-1">Usaremos este nÃºmero apenas para enviar alertas crÃ­ticos de clima e satÃ©lite da sua lavoura.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? 'Salvando...' : 'Concluir Acesso'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

```


### `src/components/Skeleton.tsx`
```tsx
interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const BASE = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 8,
  animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
} as const;

/** Single skeleton line */
export function SkeletonLine({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`h-3 rounded ${className}`}
      style={{ ...BASE, ...style }}
    />
  );
}

/** Card-shaped skeleton block */
export function SkeletonCard({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-3 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', ...style }}
    >
      <div style={{ ...BASE, height: 10, width: '40%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 24, width: '60%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 8, width: '30%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 4, borderRadius: 99, marginTop: 4 }} />
    </div>
  );
}

/** Chart-area sized skeleton */
export function SkeletonChart({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...style }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div style={{ ...BASE, height: 8, width: 120, borderRadius: 6 }} />
          <div style={{ ...BASE, height: 28, width: 80, borderRadius: 6 }} />
        </div>
        <div style={{ ...BASE, height: 22, width: 50, borderRadius: 8 }} />
      </div>
      {/* Fake bars */}
      <div className="flex items-end gap-2 h-24">
        {[60, 80, 45, 90, 70, 55, 85, 75].map((h, i) => (
          <div
            key={i}
            style={{ ...BASE, flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m) => (
          <div key={m} style={{ ...BASE, height: 7, width: 20, borderRadius: 4 }} />
        ))}
      </div>
    </div>
  );
}

/** Map-area sized skeleton */
export function SkeletonMap({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`w-full h-full rounded-xl flex items-center justify-center ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div style={{ ...BASE, width: 48, height: 48, borderRadius: '50%' }} />
        <div style={{ ...BASE, width: 120, height: 10, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// Global keyframe injected once
const STYLE = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`;
if (typeof document !== 'undefined' && !document.getElementById('skeleton-kf')) {
  const s = document.createElement('style');
  s.id = 'skeleton-kf';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export default { SkeletonLine, SkeletonCard, SkeletonChart, SkeletonMap };

```


### `src/index.css`
```css
@import "tailwindcss";

@theme {
  --color-primary-50: #fefce8;
  --color-primary-100: #fef9c3;
  --color-primary-200: #fef08a;
  --color-primary-300: #fde047;
  --color-primary-400: #facc15;
  --color-primary-500: #eab308;
  --color-primary-600: #ca8a04;
  --color-primary-700: #a16207;
  --color-primary-800: #854d0e;
  --color-primary-900: #713f12;
  --color-primary-950: #422006;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;

  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;

  --color-success-50: #ecfdf5;
  --color-success-100: #d1fae5;
  --color-success-500: #10b981;
  --color-success-600: #059669;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  @apply bg-slate-50 text-slate-900 font-sans antialiased;
}

/* Leaflet maps custom resets */
.leaflet-container {
  width: 100%;
  height: 100%;
  z-index: 10;
}

/* Scrollbar fina e discreta global */
window::-webkit-scrollbar,
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

```


### `src/main.tsx`
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```


### `src/pages/Alerts.tsx`
```tsx
import { useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { generateAlerts } from '../services/alertsAI';
import type { Alert } from '../store/useAppStore';

import { useNavigate } from 'react-router-dom';

// â”€â”€ Alert type colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TYPE_STYLE: Record<Alert['type'], { border: string; badge: string; badgeText: string }> = {
  critical: {
    border: 'border-orange-500',
    badge: 'bg-orange-500/20 text-orange-400',
    badgeText: 'ALERTA CRÃTICO',
  },
  warning: {
    border: 'border-amber-500',
    badge: 'bg-amber-500/20 text-amber-400',
    badgeText: 'AVISO',
  },
  info: {
    border: 'border-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
    badgeText: 'INFORMATIVO',
  },
};

const TYPE_VALUE_COLOR: Record<Alert['type'], string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#60a5fa',
};

// â”€â”€ Extra fields added by alertsAI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface AlertExtra extends Alert {
  field?: string;
  value?: string;
  valueLabel?: string;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Alerts() {
  const navigate = useNavigate();
  const { currentLocation, savedLocations, weatherCache, alerts, setAlerts, dismissAlert } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const hasNdviCache = () => {
    if (savedLocations.length === 0) return false;
    for (const loc of savedLocations) {
      if (!loc.lat || !loc.lng) continue;
      const cached = localStorage.getItem(`tracto-ndvi-${loc.lat}-${loc.lng}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if ((Date.now() - parsed.timestamp) < 24 * 60 * 60 * 1000) return true;
        } catch {
          // ignore parsing error
        }
      }
    }
    return false;
  };

  const loc = savedLocations.length > 0
    ? savedLocations[savedLocations.length - 1]
    : (currentLocation || { lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' });

  const visibleAlerts = (alerts as AlertExtra[]).filter((a) => !a.dismissed);
  const criticalCount = visibleAlerts.filter((a) => a.type === 'critical').length;
  const warningCount = visibleAlerts.filter((a) => a.type === 'warning').length;
  const infoCount = visibleAlerts.filter((a) => a.type === 'info').length;

  // Alertas locais gerados automaticamente quando nÃ£o hÃ¡ talhÃµes
  const getLocalAlerts = () => {
    if (!weatherCache) return [];
    const local = [];
    if (weatherCache.temperature > 32) {
      local.push({ id: 'l1', type: 'warning' as const, title: 'Calor intenso', message: 'AtenÃ§Ã£o ao estresse hÃ­drico das culturas.' });
    }
    if ((weatherCache.daily.precipSum[0] ?? 0) > 20) {
      local.push({ id: 'l2', type: 'info' as const, title: 'Chuva significativa prevista', message: 'Avalie condiÃ§Ãµes de pulverizaÃ§Ã£o.' });
    }
    if (weatherCache.windSpeed > 20) {
      local.push({ id: 'l3', type: 'warning' as const, title: 'Vento forte', message: 'Evite pulverizaÃ§Ãµes hoje.' });
    }
    if (local.length === 0) {
      local.push({ id: 'l4', type: 'info' as const, title: 'CondiÃ§Ãµes favorÃ¡veis', message: `Temperatura atual: ${Math.round(weatherCache.temperature)}Â°C, Umidade: ${weatherCache.humidity}%` });
    }
    return local;
  };
  const localAlerts = getLocalAlerts();

  const loadAlerts = async () => {
    if (savedLocations.length === 0 && !weatherCache) return;
    setLoading(true);
    setError(null);
    try {
      const generated = await generateAlerts(weatherCache, savedLocations);
      setAlerts(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar alertas');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when mounting if no alerts yet
  useEffect(() => {
    if (alerts.length === 0 && savedLocations.length > 0 && weatherCache) {
      loadAlerts();
    }
  }, []);

  return (
    <>
      <style>{`
        .glass-card-alert {
          background: rgba(38, 28, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(236, 91, 19, 0.1);
        }
        .alert-scrollbar::-webkit-scrollbar { width: 6px; }
        .alert-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .alert-scrollbar::-webkit-scrollbar-thumb { background: #3d2a22; border-radius: 10px; }
      `}</style>

      <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="flex-1 overflow-y-auto alert-scrollbar p-10">

          {/* â”€â”€ Header + Reload â”€â”€ */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-white font-bold text-xl">Alertas Inteligentes</h1>
              <p className="text-slate-400 text-xs mt-1">
                AnÃ¡lise em tempo real via IA Â· {loc?.name ?? 'LocalizaÃ§Ã£o atual'}
              </p>
            </div>
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'refresh' : 'smart_toy'}
              </span>
              {loading ? 'Analisando...' : 'Gerar Alertas IA'}
            </button>
          </div>

          {/* â”€â”€ No fields message â”€â”€ */}
          {savedLocations.length === 0 && !loading && (
            <>
              <div className="glass-card-alert rounded-2xl p-8 text-center mb-8" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#ec5b13' }}>map</span>
                <h3 className="text-white font-bold mb-2">Nenhum talhÃ£o cadastrado</h3>
                <p className="text-slate-400 text-sm">VÃ¡ atÃ© o <span className="text-white font-semibold">Mapa / TalhÃµes</span> e desenhe seu primeiro talhÃ£o para ativar os alertas de IA.</p>
              </div>

              {localAlerts.length > 0 && (
                <>
                  <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-xl">wb_sunny</span>
                    Clima em sua regiÃ£o
                  </h3>
                  <div className="grid grid-cols-1 gap-4 mb-8">
                    {localAlerts.map((a) => {
                      const st = TYPE_STYLE[a.type];
                      return (
                        <div key={a.id} className={`glass-card-alert rounded-xl overflow-hidden flex flex-col items-stretch border-l-4 ${st.border}`}>
                          <div className="p-6">
                            <div className="flex flex-col gap-2">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase w-fit`}>
                                {st.badgeText}
                              </span>
                              <h4 className="text-slate-100 text-base font-bold">{a.title}</h4>
                              <p className="text-slate-400 text-sm">{a.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* â”€â”€ Empty state (No alerts from AI) â”€â”€ */}
          {!loading && alerts.length === 0 && savedLocations.length > 0 && !error && (
            <div className="glass-card-alert rounded-2xl p-10 text-center mb-8" style={{ border: '1px solid rgba(74, 222, 128, 0.2)', background: 'rgba(74, 222, 128, 0.03)' }}>
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-green-500">task_alt</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Sua lavoura estÃ¡ protegida</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Nenhuma anomalia crÃ­tica foi detectada pela nossa IA nos seus talhÃµes monitorados no momento.
              </p>
              <button 
                onClick={loadAlerts}
                className="mt-6 text-green-400 text-xs font-bold uppercase tracking-widest hover:text-green-300 transition-colors"
              >
                Refazer anÃ¡lise agora
              </button>
            </div>
          )}

          {/* â”€â”€ Error â”€â”€ */}
          {error && (
            <div className="p-4 rounded-xl flex items-start gap-3 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
              <div>
                <p className="text-sm text-red-300 font-semibold">Erro ao gerar alertas</p>
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* â”€â”€ Loading skeleton â”€â”€ */}
          {loading && (
            <div className="space-y-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card-alert rounded-xl h-36 animate-pulse" style={{ borderLeft: '4px solid #ec5b13' }} />
              ))}
            </div>
          )}

          {/* â”€â”€ Summary row â”€â”€ */}
          {!loading && visibleAlerts.length > 0 && (
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              {[
                { label: 'CrÃ­ticos', count: criticalCount, icon: 'warning', borderColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
                { label: 'Avisos', count: warningCount, icon: 'warning', borderColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
                { label: 'Informativos', count: infoCount, icon: 'info', borderColor: '#60a5fa', bgColor: 'rgba(96,165,250,0.1)' },
              ].map(({ label, count, icon, borderColor, bgColor }) => (
                <div key={label} className="glass-card-alert rounded-xl overflow-hidden flex items-stretch p-4 flex-1" style={{ borderLeft: `4px solid ${borderColor}` }}>
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: bgColor }}>
                      <span className="material-symbols-outlined" style={{ color: borderColor }}>{icon}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
                      <p className="text-2xl font-bold text-slate-100">{String(count).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* â”€â”€ Alerts feed â”€â”€ */}
          {!loading && visibleAlerts.length > 0 && (
            <>
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-xl">feed</span>
                Feed de Atividades em Tempo Real
              </h3>

              {criticalCount > 0 && !hasNdviCache() && (
                <div className="glass-card-alert rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 border-orange-500/50" style={{ background: 'rgba(236,91,19,0.05)' }}>
                  <div>
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
                      Alerta crÃ­tico detectado
                    </h4>
                    <p className="text-slate-400 text-sm mt-1">Analise o talhÃ£o via satÃ©lite para localizar a Ã¡rea afetada.</p>
                  </div>
                  <button
                    onClick={() => navigate('/app')}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all flex-shrink-0"
                  >
                    Analisar no Dashboard
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {visibleAlerts.map((alert) => {
                  const a = alert as AlertExtra;
                  const st = TYPE_STYLE[a.type];
                  return (
                    <div
                      key={a.id}
                      className={`glass-card-alert rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch border-l-4 ${st.border}`}
                    >
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase`}>
                                {st.badgeText}
                              </span>
                                <span className="text-slate-500 text-[11px] font-medium tracking-tight">
                                  {a.field ? `${a.field} Â· ` : ''}{new Date(a.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {(a.id.startsWith('A') || a.id.startsWith('M')) && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">
                                    <span className="material-symbols-outlined text-[10px]">verified</span>
                                    FONTE: MOTOR DETERMINÃSTICO
                                  </span>
                                )}
                              </div>
                            <h4 className="text-slate-100 text-lg font-bold">{a.title}</h4>
                            <p className="text-slate-400 text-sm mt-2 max-w-2xl">{a.message}</p>
                          </div>
                          {a.value && (
                            <div className="text-left xl:text-right w-full xl:w-auto flex-shrink-0">
                              <span className="text-2xl font-bold" style={{ color: TYPE_VALUE_COLOR[a.type] }}>{a.value}</span>
                              <p className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">{a.valueLabel}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end mt-4 pt-4 border-t gap-2" style={{ borderColor: 'rgba(236,91,19,0.05)' }}>
                          <button
                            onClick={() => dismissAlert(a.id)}
                            className="px-4 py-2 rounded-lg text-slate-300 text-xs font-bold border hover:bg-orange-500/5 transition-all"
                            style={{ background: 'rgba(38,28,24,1)', borderColor: 'rgba(236,91,19,0.1)' }}
                          >
                            Ignorar
                          </button>
                          <button className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all">
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* â”€â”€ Empty state (after dismiss all) â”€â”€ */}
          {!loading && visibleAlerts.length === 0 && alerts.length > 0 && (
            <div className="glass-card-alert rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-5xl mb-4 block text-green-400">check_circle</span>
              <h3 className="text-white font-bold mb-2">Nenhum alerta ativo</h3>
              <p className="text-slate-400 text-sm">Todos os alertas foram dispensados. Clique em "Gerar Alertas IA" para uma nova anÃ¡lise.</p>
            </div>
          )}

        </div>
      </main>
    </>
  );
}

```


### `src/pages/Chat.tsx`
```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import useAppStore from '../store/useAppStore';
import { apiFetch } from '../services/api';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Message {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  imagePreview?: string;
}

interface SavedConversation {
  conversation_id: string;
  title: string;
  messages: { role: string; text: string }[];
  farm_context?: string;
  created_at: string;
  updated_at: string;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const nowTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const nowISO = () => new Date().toISOString();

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hÃ¡ ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hÃ¡ ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ontem';
  return `hÃ¡ ${days} dias`;
}

const INITIAL_MSG = (time: string): Message => ({
  role: 'assistant',
  text: 'OlÃ¡! Sou a **Tracto IA**, sua analista agronÃ´mica. Posso ajudar com anÃ¡lise de solo, NDVI, irrigaÃ§Ã£o, pragas, colheita e clima.\n\nðŸ“¸ **Dica:** Envie uma foto da lavoura para anÃ¡lise visual de pragas e doenÃ§as.\n\nComo posso ajudar?',
  time,
});

function buildFarmContext(
  savedLocations: ReturnType<typeof useAppStore.getState>['savedLocations']
): string {
  if (savedLocations.length === 0) return 'Nenhum talhÃ£o cadastrado.';
  return savedLocations
    .map((l, i) => {
      const area = l.areaHa ? `${l.areaHa.toFixed(2)} ha` : 'Ãrea N/D';
      let ctx = `- ${l.name ?? `TalhÃ£o ${i + 1}`} (${area})`;
      const cached = localStorage.getItem(`tracto-ndvi-${l.lat}-${l.lng}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            const ndvi = parsed.data.ndvi_analysis;
            ctx += `\n  NDVI: ndvi_medio=${ndvi.ndvi_medio?.toFixed(2)}, zona_critica=${ndvi.zona_critica_pct}%, tendencia=${ndvi.tendencia}`;
          }
        } catch { /* ignore */ }
      }
      return ctx;
    })
    .join('\n');
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Chat() {
  const { addMessage, clearChat, savedLocations, weatherCache } = useAppStore();

  // Conversation state
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string>(() => nowISO());
  const [messages, setMessages] = useState<Message[]>(() => [INITIAL_MSG(nowTime())]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sidebar: saved conversations
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Image
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
    name: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  // â”€â”€ Load saved conversations on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await apiFetch<{ conversations: SavedConversation[] }>('/api/conversations');
      setSavedConversations(data.conversations || []);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Nao foi possivel carregar as conversas salvas.');
    } finally {
      setLoadingConversations(false);
    }
  };

  // â”€â”€ Auto-save with 3s debounce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const scheduleSave = useCallback(
    (msgs: Message[], cid: string, createdAt: string) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        const userMessages = msgs.filter((m) => m.role !== 'assistant' || msgs.indexOf(m) > 0);
        if (userMessages.length < 2) return; // sÃ³ salvar se houver pelo menos 1 troca

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // TÃ­tulo = primeiros 40 chars da 1Âª msg do usuÃ¡rio
          const firstUserMsg = msgs.find((m) => m.role === 'user');
          const title = firstUserMsg
            ? firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '')
            : 'Nova Conversa';

          await apiFetch('/api/conversations/save', {
            method: 'POST',
            body: JSON.stringify({
              conversation_id: cid,
              title,
              messages: msgs.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                text: m.text,
              })),
              farm_context: buildFarmContext(savedLocations),
              created_at: createdAt,
              updated_at: nowISO(),
            }),
          });
          await loadConversations();
        } catch (error) {
          setApiError(error instanceof Error ? error.message : 'Nao foi possivel sincronizar a conversa.');
        }
      }, 3000);
    },
    [savedLocations]
  );

  // â”€â”€ Start new conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startNewConversation = () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    const newId = uuidv4();
    const createdAt = nowISO();
    setConversationId(newId);
    setConversationCreatedAt(createdAt);
    setMessages([INITIAL_MSG(nowTime())]);
    setActiveConversationId(null);
    clearChat();
    setApiError(null);
    setInput('');
    setPendingImage(null);
  };

  // â”€â”€ Load a saved conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadConversation = (conv: SavedConversation) => {
    setActiveConversationId(conv.conversation_id);
    setConversationId(conv.conversation_id);
    setConversationCreatedAt(conv.created_at);
    const loaded: Message[] = conv.messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      text: m.text,
      time: '',
    }));
    setMessages(loaded.length > 0 ? loaded : [INITIAL_MSG(nowTime())]);
    setInput('');
    setPendingImage(null);
    setApiError(null);
  };

  // â”€â”€ Delete conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      setSavedConversations((prev) => prev.filter((c) => c.conversation_id !== convId));
      if (activeConversationId === convId) startNewConversation();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Nao foi possivel deletar a conversa.');
    }
  };

  // â”€â”€ Image handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setApiError('Formato invÃ¡lido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError('Imagem muito grande. MÃ¡ximo: 5MB.');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const preview = URL.createObjectURL(file);
      setPendingImage({ base64, mimeType: file.type, preview, name: file.name });
      setApiError(null);
    } catch {
      setApiError('Erro ao processar a imagem.');
    }
    e.target.value = '';
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  // â”€â”€ Send message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || isLoading) return;
    setInput('');
    setApiError(null);

    const imagePreview = pendingImage?.preview;
    const imageBase64 = pendingImage?.base64 ?? null;
    const imageMime = pendingImage?.mimeType ?? 'image/jpeg';
    const capturedImage = pendingImage;
    setPendingImage(null);

    const userMsg: Message = {
      role: 'user',
      text: content || 'ðŸ“¸ [Imagem enviada para anÃ¡lise]',
      time: nowTime(),
      imagePreview,
    };

    const newMessages = (prev: Message[]) => [...prev, userMsg];
    setMessages((p) => newMessages(p));
    addMessage('user', userMsg.text);
    setIsLoading(true);

    try {
      const payloadMessages = [
        ...messages
          .filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0)
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.text,
          })),
        { role: 'user', text: userMsg.text },
      ];

      const farm_context = buildFarmContext(savedLocations);
      const hourly_weather = weatherCache
        ? { temperature: weatherCache.temperature, humidity: weatherCache.humidity, wind_speed: weatherCache.windSpeed }
        : null;

      const data = await apiFetch<{ reply: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: payloadMessages,
          farm_context,
          image_base64: imageBase64,
          image_mime_type: imageMime,
          hourly_weather,
        }),
      });

      if (capturedImage) URL.revokeObjectURL(capturedImage.preview);

      const aiText = data.reply ?? '';
      const aiMsg: Message = { role: 'assistant', text: aiText, time: nowTime() };

      setMessages((prev) => {
        const updated = [...prev, aiMsg];
        scheduleSave(updated, conversationId, conversationCreatedAt);
        return updated;
      });
      addMessage('model', aiText);
      setActiveConversationId(conversationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setApiError(msg);
      setMessages((p) => [
        ...p,
        { role: 'assistant', text: `âš ï¸ Erro ao conectar: ${msg}`, time: nowTime() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <>
      {/* â”€â”€ Sidebar: HistÃ³rico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* New conversation button */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'rgba(236,91,19,0.14)', border: '1px solid rgba(236,91,19,0.22)' }}
          >
            <span>Nova Conversa</span>
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>
              add_comment
            </span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2"
            style={{ color: '#64748b' }}
          >
            Conversas Salvas
          </p>

          {loadingConversations && (
            <div className="flex justify-center py-4">
              <span
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#ec5b13', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {!loadingConversations && !apiError && savedConversations.length === 0 && (
            <p className="text-[10px] px-2 py-3" style={{ color: '#334155' }}>
              Nenhuma conversa salva ainda.
            </p>
          )}


          <div className="space-y-0.5">
            {savedConversations.map((conv) => {
              const isActive = activeConversationId === conv.conversation_id;
              return (
                <div key={conv.conversation_id} className="group relative">
                  <button
                    onClick={() => loadConversation(conv)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'rgba(236,91,19,0.1)' : 'transparent',
                      border: isActive ? '1px solid rgba(236,91,19,0.3)' : '1px solid transparent',
                    }}
                  >
                    <p
                      className="text-xs font-medium truncate pr-5"
                      style={{ color: isActive ? '#f97316' : '#cbd5e1' }}
                    >
                      {conv.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {relativeDate(conv.updated_at)}
                    </p>
                  </button>
                  {/* Delete button â€” visible on hover */}
                  <button
                    onClick={(e) => deleteConversation(e, conv.conversation_id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    title="Deletar conversa"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Context badge */}
          {savedLocations.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: '#64748b' }}
              >
                Contexto ativo
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs">map</span>
                  {savedLocations.length} talhÃ£o{savedLocations.length > 1 ? 'Ãµes' : ''}
                </div>
                {weatherCache && (
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#60a5fa' }}>
                    <span className="material-symbols-outlined text-xs">wb_sunny</span>
                    {Math.round(weatherCache.temperature)}Â°C Â· {weatherCache.humidity}%
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API status */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold ${
              apiError ? 'text-red-400' : 'text-green-400'
            }`}
            style={{
              background: apiError ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.07)',
              border: `1px solid ${apiError ? 'rgba(239,68,68,0.18)' : 'rgba(74,222,128,0.15)'}`,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                apiError ? 'bg-red-400' : 'bg-green-400 animate-pulse'
              }`}
            />
            {apiError ? 'Erro de API' : 'Servidor conectado'}
          </div>
        </div>
      </div>

      {/* â”€â”€ Chat Principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: '#080809' }}>
        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{
            borderColor: 'rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.018)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(236,91,19,0.15)' }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>
                smart_toy
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Tracto IA</h2>
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Analista AgronÃ´mica Â· Claude Sonnet Â· VisÃ£o Ativa
              </p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
            }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reiniciar
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {messages.map((msg, i) =>
            msg.role === 'assistant' ? (
              <div key={i} className="flex gap-3 max-w-2xl">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(236,91,19,0.15)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                    smart_toy
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tl-none text-sm leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#cbd5e1',
                    }}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.time && (
                    <p className="text-[10px] ml-1" style={{ color: '#334155' }}>
                      Tracto IA Â· {msg.time}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>
                    person
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-end space-y-1">
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Imagem enviada"
                      className="max-w-[200px] max-h-[150px] rounded-xl object-cover"
                      style={{ border: '1px solid rgba(236,91,19,0.3)' }}
                    />
                  )}
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tr-none text-sm leading-relaxed"
                    style={{
                      background: 'rgba(236,91,19,0.12)',
                      border: '1px solid rgba(236,91,19,0.2)',
                      color: '#f1f5f9',
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.time && (
                    <p className="text-[10px] mr-1" style={{ color: '#334155' }}>
                      VocÃª Â· {msg.time}
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 max-w-2xl">
              <div
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(236,91,19,0.15)' }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                  smart_toy
                </span>
              </div>
              <div
                className="px-4 py-3.5 rounded-2xl rounded-tl-none flex items-center gap-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {[0, 0.15, 0.3].map((d, j) => (
                  <span
                    key={j}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: '#ec5b13', opacity: 0.7, animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* â”€â”€ Input bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-3 flex items-start gap-2">
              <div className="relative inline-block">
                <img
                  src={pendingImage.preview}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover"
                  style={{ border: '1px solid rgba(236,91,19,0.4)' }}
                />
                <button
                  onClick={removePendingImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: '#ef4444' }}
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300 truncate max-w-[180px]">
                  {pendingImage.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs align-middle mr-0.5">
                    visibility
                  </span>
                  Pronto para anÃ¡lise visual
                </p>
              </div>
            </div>
          )}

          {/* Input row */}
          <div
            className="flex items-center gap-2 p-2 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.35)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            {/* Attach image button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Enviar foto da lavoura"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
              style={{
                background: pendingImage ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: pendingImage ? '#ec5b13' : '#64748b',
              }}
            >
              <span className="material-symbols-outlined text-base">attach_file</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />

            <input
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-slate-200 placeholder:text-slate-600 px-1"
              placeholder={
                pendingImage
                  ? 'Adicione uma pergunta ou envie sÃ³ a foto...'
                  : 'Pergunte sobre sua lavoura...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && !pendingImage)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-30 flex-shrink-0"
              style={{ background: '#ec5b13' }}
            >
              <span className="material-symbols-outlined text-base">
                {isLoading ? 'more_horiz' : 'arrow_upward'}
              </span>
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: '#1e293b' }}>
            Tracto IA Â· Claude Sonnet 4.6 Â· JPG Â· PNG Â· WEBP atÃ© 5MB
          </p>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Dashboard.tsx`
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeField } from '../services/api';
import type { FieldAnalysisResult } from '../services/api';
import FieldMap from '../components/FieldMap';
import useAppStore from '../store/useAppStore';
import type { Alert } from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';

// â”€â”€ Market data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface MarketData {
  soja: { price: string; change: string; up: boolean };
}

async function fetchMarket(): Promise<MarketData> {
  try {
    const res = await fetch('https://api.hgbrasil.com/finance?format=json&key=demo');
    if (!res.ok) throw new Error('fetch error');
    const json = await res.json();
    // HG Brasil returns currencies/stocks â€” use USD/BRL as proxy for commodity index
    const usd = json?.results?.currencies?.USD;
    if (usd) {
      const price = `R$ ${Number(usd.buy).toFixed(2)}`;
      const pct = usd.variation ?? 0;
      return { soja: { price, change: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 } };
    }
    throw new Error('no data');
  } catch {
    return { soja: { price: 'Atualizando...', change: 'â€”', up: true } };
  }
}

// â”€â”€ Alert type colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ALERT_COLORS: Record<Alert['type'], { accent: string; text: string; border: string; bg: string }> = {
  critical: { accent: '#ec5b13', text: '#ec5b13', border: 'rgba(236,91,19,0.16)', bg: 'rgba(236,91,19,0.08)' },
  warning:  { accent: '#f59e0b', text: '#fbbf24', border: 'rgba(245,158,11,0.16)', bg: 'rgba(245,158,11,0.08)' },
  info:     { accent: '#60a5fa', text: '#60a5fa', border: 'rgba(96,165,250,0.16)', bg: 'rgba(96,165,250,0.08)' },
};

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard() {
  const navigate = useNavigate();
  const { savedLocations, weatherCache, alerts } = useAppStore();
  const [market, setMarket] = useState<MarketData>({
    soja: { price: 'Atualizando...', change: 'â€”', up: true },
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FieldAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (savedLocations.length === 0) return;
    const loc = savedLocations[0];
    
    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const fieldName = loc.name || 'Setor Base';
      const cropType = loc.cultura;
      const result = await analyzeField(
        loc.lat, 
        loc.lng, 
        fieldName, 
        cropType, 
        weatherCache,
        loc.boundaries || null,
        loc.dataPlantio,
        loc.variedade,
        loc.areaHa
      );
      
      setAnalysisResult(result);
      localStorage.setItem(`tracto-ndvi-${loc.lat}-${loc.lng}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
      
    } catch (e) {
      console.error(e);
      setAnalysisError(e instanceof Error ? e.message : 'Nao foi possivel concluir a analise.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch market once
  useEffect(() => {
    fetchMarket().then(setMarket);
  }, []);

  // â”€â”€ Computed metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalAreaHa = savedLocations.reduce((sum, loc) => {
    if (loc.boundaries && loc.boundaries.length >= 3) return sum + polygonAreaHa(loc.boundaries);
    // Fallback: small default square if no boundaries
    return sum + 0.01;
  }, 0);

  const areaDisplay = savedLocations.length === 0
    ? 'N/D'
    : totalAreaHa >= 1000
      ? `${(totalAreaHa / 1000).toFixed(2)}k`
      : totalAreaHa.toFixed(1);
  const areaUnit = savedLocations.length === 0 ? '' : totalAreaHa >= 1000 ? 'k ha' : 'ha';

  const precipToday = weatherCache
    ? `${(weatherCache.daily.precipSum[0] ?? 0).toFixed(1)}`
    : 'â€”';
  const precipUnit = weatherCache ? 'mm' : '';

  // Alerts: show top 2 non-dismissed, prioritizing critical
  const activeAlerts = alerts
    .filter((a) => !a.dismissed)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    })
    .slice(0, 2);

  const METRICS = [
    {
      label: 'Ãrea Total',
      value: areaDisplay,
      unit: areaUnit,
      trend: savedLocations.length > 0 ? `${savedLocations.length} talhÃ£o${savedLocations.length > 1 ? 'Ãµes' : ''}` : 'Sem talhÃµes',
      up: true,
      color: '#4ade80',
    },
    {
      label: 'NDVI MÃ©dio',
      value: analysisResult ? analysisResult.ndvi_analysis.ndvi_medio.toFixed(2) : 'N/D',
      unit: '',
      trend: analysisResult ? 'AnÃ¡lise de satÃ©lite' : 'Aguardando anÃ¡lise',
      up: analysisResult ? (analysisResult.ndvi_analysis.ndvi_medio > 0.5) : false,
      color: '#60a5fa',
    },
    {
      label: 'PrecipitaÃ§Ã£o',
      value: precipToday,
      unit: precipUnit,
      trend: weatherCache ? 'Hoje (Open-Meteo)' : 'Sem dados',
      up: (weatherCache?.daily.precipSum[0] ?? 0) > 0,
      color: '#60a5fa',
    },
    {
      label: 'Produtividade',
      value: 'N/D',
      unit: '',
      trend: 'Aguardando histÃ³rico',
      up: false,
      color: '#64748b',
    },
  ];


  return (
    <>
      {/* Mapa Central */}
      <section className="flex-1 flex flex-col overflow-hidden p-4 gap-4 min-w-0">
        <div className="flex-1 relative rounded-xl overflow-hidden min-h-0" style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0c0c0e' }}>
          <FieldMap />
        </div>
      </section>

      {/* Sidebar de InteligÃªncia */}
      <aside className="w-72 flex-shrink-0 flex flex-col overflow-y-auto scrollbar-thin" style={{ background: 'rgba(255,255,255,0.015)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="p-4 flex flex-col gap-4">

          {/* Cards de MÃ©tricas */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>MÃ©tricas da Fazenda</p>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((m) => (
                <div key={m.label} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {m.value}
                    <span className="text-xs font-normal ml-0.5" style={{ color: '#64748b' }}>{m.unit}</span>
                  </p>
                  <p className="text-[10px] font-semibold" style={{ color: m.up ? '#4ade80' : '#f87171' }}>{m.trend}</p>
                  <div className="h-1 w-full rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full w-3/4" style={{ background: m.color + '66' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status IA */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white">Tracto IA</p>
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#4ade80' }}>
                <span className="relative w-1.5 h-1.5 rounded-full bg-green-400">
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                </span>
                Ativo
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>
              {savedLocations.length > 0
                ? `Monitorando ${savedLocations.length} talhÃ£o${savedLocations.length > 1 ? 'Ãµes' : ''} Â· Ãrea: ${areaDisplay}${areaUnit}`
                : 'Aguardando talhÃµes cadastrados para anÃ¡lise.'}
            </p>
          </div>

          {/* AnÃ¡lise SatÃ©lite */}
          {savedLocations.length > 0 && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                  AnÃ¡lise SatÃ©lite
                </p>
                {analysisResult && (
                  <div className="flex gap-1">
                    {analysisResult.is_mock && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/20 text-amber-400" title="Dados simulados devido a indisponibilidade do serviÃ§o de clima">
                        MOCK
                      </span>
                    )}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${analysisResult.cached ? 'bg-slate-700 text-slate-300' : 'bg-green-500/20 text-green-400'}`}>
                      {analysisResult.cached ? 'CACHE 24H' : 'ATUALIZADO'}
                    </span>
                  </div>
                )}

              </div>

              {!analysisResult ? (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  style={{ 
                    background: analysisError ? '#ef4444' : '#ec5b13', 
                    color: '#fff',
                    opacity: analyzing ? 0.7 : 1
                  }}
                >
                  {analyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analisando...
                    </>
                  ) : analysisError ? (
                    'Tentar novamente'
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
                      Analisar TalhÃ£o
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  {analysisResult.ndvi_image_base64 ? (
                    <div className="relative">
                      <img 
                        src={`data:image/png;base64,${analysisResult.ndvi_image_base64}`} 
                        alt="NDVI" 
                        className="w-full h-auto rounded-lg object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white border border-white/10 uppercase tracking-widest">
                        {analysisResult.source || 'Sentinel-2 L2A'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg flex items-center justify-center p-4 text-center" style={{ background: '#0f2617', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-[10px] text-green-200">Imagem indisponÃ­vel â€” {analysisResult.source?.includes('Simulado') ? 'SimulaÃ§Ã£o indisponÃ­vel' : 'cobertura de nuvens alta'}. Tente novamente em breve.</p>
                    </div>
                  )}
                  
                  {/* Confidence Bar (Honest UX) */}
                  <div className="px-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">ConfianÃ§a da AnÃ¡lise</p>
                      <p className="text-[9px] font-bold text-white">{(analysisResult.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${analysisResult.confidence * 100}%`,
                          background: analysisResult.confidence > 0.8 ? '#4ade80' : analysisResult.confidence > 0.5 ? '#fbbf24' : '#f87171'
                        }} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">NDVI MÃ©dio (Real)</p>
                      <p className="text-sm font-bold text-white">{analysisResult.ndvi_analysis.ndvi_medio.toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Janela Pulveriz.</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : analysisResult.engine_results?.spray_window?.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                        {analysisResult.engine_results?.spray_window?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Risco Geada</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.frost_risk?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.frost_risk?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Estresse HÃ­drico</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.water_stress?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.water_stress?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                  </div>
                  
                  {analysisResult.date_acquired && (
                    <p className="text-[9px] text-slate-500 text-center flex items-center justify-center gap-1">
                      <span>Imagem de {new Date(analysisResult.date_acquired.split(' ')[0]).toLocaleDateString('pt-BR')}</span>
                      {analysisResult.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80 font-bold">(Aprox)</span>}
                    </p>
                  )}
                  
                  <button
                    onClick={() => navigate('/app/reports')}
                    className="w-full py-1.5 mt-1 rounded text-[10px] font-semibold transition-all hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
                  >
                    Ver RelatÃ³rio Completo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Alertas PrioritÃ¡rios (do store) */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>
              Alertas PrioritÃ¡rios
            </p>
            <div className="space-y-2">
              {activeAlerts.length === 0 ? (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>
                    {alerts.length === 0
                      ? 'VÃ¡ em Alertas para gerar anÃ¡lise IA'
                      : 'Nenhum alerta ativo no momento'}
                  </p>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const c = ALERT_COLORS[alert.type];
                  return (
                    <div key={alert.id} className="p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: c.text }}>
                        {alert.type === 'critical' ? 'âš  CrÃ­tico' : alert.type === 'warning' ? 'âš  Aviso' : 'â„¹ Info'}
                      </p>
                      <p className="text-xs font-semibold text-white truncate">{alert.title}</p>
                      <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#94a3b8' }}>{alert.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mercado */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>Mercado</p>
            <div className="space-y-1.5">
              {[
                {
                  name: 'CÃ¢mbio USD/BRL',
                  detail: 'ReferÃªncia cambial (HG Brasil)',
                  value: market.soja.price,
                  change: market.soja.change,
                  up: market.soja.up,
                },
                {
                  name: 'Ãndice LogÃ­stico',
                  detail: 'RegiÃ£o: Centro-Oeste',
                  value: '104.2',
                  change: '-0.4%',
                  up: false,
                },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{item.value}</p>
                    <p className="text-[10px] font-semibold" style={{ color: item.up ? '#4ade80' : '#f87171' }}>{item.change}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 text-right pr-1" style={{ color: '#64748b' }}>PreÃ§o real da soja em breve</p>
          </div>

          <button
            onClick={() => navigate('/app/reports')}
            className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            Ver RelatÃ³rio Completo
          </button>
        </div>
      </aside>
    </>
  );
export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <>
            <style>{`
                .glass-dark {
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }
                .hero-gradient {
                    background: linear-gradient(to bottom, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.4) 50%, rgba(15, 23, 42, 0.9) 100%);
                }
                section {
                    padding-top: 100px;
                    padding-bottom: 100px;
                }
                .section-framed {
                    padding-top: 120px;
                    padding-bottom: 120px;
                }
            `}</style>
            
<div className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/30 antialiased overflow-x-hidden min-h-screen">
<nav className="fixed top-0 w-full z-50 transition-all duration-300 px-8 py-6">
<div className="max-w-7xl mx-auto flex items-center justify-between glass-dark px-10 py-4 rounded-full border border-white/5 shadow-2xl">
<div className="flex items-center gap-2">
<span className="text-lg font-bold tracking-widest text-white uppercase">Tracto</span>
</div>
<div className="hidden md:flex items-center gap-12 text-[10px] font-medium uppercase tracking-[0.25em] text-white/60">
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('servicos')?.scrollIntoView({behavior: 'smooth'})}>ServiÃ§os</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>Nosso PropÃ³sito</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('precos')?.scrollIntoView({behavior: 'smooth'})}>Planos</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('contato')?.scrollIntoView({behavior: 'smooth'})}>Contato</a>
</div>
<div>
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-lg shadow-primary/10">
                    Acessar Plataforma
                </button>
</div>
</div>
</nav>
<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-0 pb-0">
<div className="absolute inset-0 z-0">
<img 
  alt="Vista aÃ©rea de fazenda" 
  className="w-full h-full object-cover object-center" 
  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
/>
<div className="absolute inset-0 hero-gradient"></div>
</div>
<div className="relative z-10 max-w-5xl mx-auto px-6 text-center text-white mt-10 fade-in-section visible">
<h1 className="text-4xl md:text-5xl font-light tracking-tight mb-8 leading-snug">
                O campo em sincronia,<br/><span className="text-primary font-medium">na palma da sua mÃ£o.</span>
</h1>
<p className="text-base md:text-lg text-slate-100 max-w-2xl mx-auto mb-12 font-light leading-loose drop-shadow-md">
                A Tracto une Tecnologia Orbital ProprietÃ¡ria e Nossa InteligÃªncia AgronÃ´mica Dedicada diretamente Ã  sua interface mobile para decisÃµes de alta precisÃ£o.
            </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-8">
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] active:scale-95">
                    ComeÃ§ar Agora
                </button>
<a className="text-white hover:text-white/80 text-[10px] uppercase tracking-[0.3em] transition-all drop-shadow-md cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>
                    Descobrir o Ecossistema
                </a>
</div>
</div>
</section>
<section className="bg-white dark:bg-slate-900 section-framed" id="proposito">
<div className="max-w-4xl mx-auto px-8 text-center fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.5em] uppercase mb-8">Nosso PropÃ³sito</h2>
<div className="space-y-8">
<p className="text-2xl md:text-4xl font-light text-slate-900 dark:text-white leading-relaxed tracking-tight">
                    Conectar a inteligÃªncia orbital e climÃ¡tica proprietÃ¡ria Ã  simplicidade de um chat intuitivo, transformando dados complexos em decisÃµes diÃ¡rias e precisas.
                </p>
<p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-light leading-loose max-w-2xl mx-auto pt-4">
                    Nossa missÃ£o Ã© otimizar o manejo, promovendo produtividade e sustentabilidade para a sua lavoura.
                </p>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/40 section-framed" id="servicos">
<div className="max-w-7xl mx-auto px-6">
<div className="text-center mb-16 fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Sistemas</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Arquitetura de Dados ProprietÃ¡ria</h3>
</div>
<div className="grid md:grid-cols-3 gap-16 lg:gap-24">
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">satellite_alt</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Tecnologia Orbital ProprietÃ¡ria</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        AnÃ¡lise de Imagens de FrequÃªncia ContÃ­nua para monitoramento de Ã­ndices de vegetaÃ§Ã£o e saÃºde da plantaÃ§Ã£o com precisÃ£o cientÃ­fica.
                    </p>
</div>
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">analytics</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">AnÃ¡lise de FrequÃªncia ContÃ­nua</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Processamento ininterrupto de dados ambientais para detecÃ§Ã£o precoce de anomalias hÃ­dricas e estresse biÃ³tico.
                    </p>
</div>
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">memory</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">InteligÃªncia AgronÃ´mica Dedicada</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Algoritmos exclusivos traduzem telemetria complexa em recomendaÃ§Ãµes prÃ¡ticas enviadas diretamente para sua interface mobile.
                    </p>
</div>
</div>
</div>
</section>
<section className="bg-white dark:bg-background-dark overflow-hidden section-framed" id="app-showcase">
<div className="max-w-7xl mx-auto px-6">
<div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
<div className="w-full lg:w-1/2 relative fade-in-section visible">
<div className="relative z-10 w-[280px] md:w-[320px] mx-auto rounded-[3rem] border-[10px] border-slate-900 dark:border-slate-950 bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/10">
<div className="bg-brand-green p-4 pt-10 text-white flex items-center gap-4">
<span className="material-symbols-outlined text-lg">arrow_back</span>
<div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white/20">
<img alt="Tracto AI Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YpGb0bZjWKAXOj0EldHehbZ3K5vtul8tgwRhsUjRdZ2FASAeb8AD0MCui0QJ2Mp2aYxNuJDOcSaKDBooN80t_4aCJ8mJ9syocA9xkXQ5lN486OD-HlfqsjOrSoAYecg6CIR32ROrEH2JztUZrGJLgcspn8K7GkLepkEhMVSpJTH0_RWRwehawQ_evU9grGQjPDuYWoyFNwALUzf_GdsFCgtFS71Phdl1LWOm13-XIkrXUggFRMMxGmmyxdRkXqybnD-IQCUDjdE"/>
</div>
<div>
<h5 className="text-sm font-bold">Tracto AI</h5>
<p className="text-[10px] opacity-60">online</p>
</div>
</div>
<div className="bg-[#f0f2f5] dark:bg-slate-800 h-[480px] p-4 flex flex-col gap-4 overflow-y-auto">
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">Bom dia. A Tecnologia Orbital identificou uma queda de 15% no vigor vegetativo no TalhÃ£o 4. Recomendo inspeÃ§Ã£o local.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:30</span>
</div>
<div className="bg-[#dcf8c6] dark:bg-emerald-900/40 p-4 rounded-xl rounded-tr-none shadow-sm max-w-[85%] self-end text-[13px]">
<p className="dark:text-white leading-relaxed">Qual o cenÃ¡rio climÃ¡tico para as prÃ³ximas horas?</p>
<span className="text-[9px] text-emerald-600/60 dark:text-emerald-400 mt-2 block text-right">08:32</span>
</div>
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">PrevisÃ£o de precipitaÃ§Ã£o de 5mm para amanhÃ£. A InteligÃªncia AgronÃ´mica Dedicada sugere otimizar a nutriÃ§Ã£o foliar.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:32</span>
</div>
</div>
</div>
<div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
</div>
<div className="w-full lg:w-1/2 space-y-12 fade-in-section visible">
<h2 className="text-2xl md:text-3xl font-light dark:text-white leading-snug tracking-tight">GestÃ£o de alta performance em uma interface minimalista.</h2>
<p className="text-base text-slate-500 dark:text-slate-400 font-light leading-loose">
                        Eliminamos dashboards desnecessÃ¡rios. A Tracto entrega o que Ã© essencial para o produtor onde ele jÃ¡ estÃ¡.
                    </p>
<ul className="space-y-8">
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">notifications_active</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">Alertas Proativos</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">Monitoramento automÃ¡tico de variaÃ§Ãµes biomÃ©tricas.</p>
</div>
</li>
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">psychology</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">InteligÃªncia AgronÃ´mica Dedicada</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">InteraÃ§Ã£o direta com nossa tecnologia via linguagem natural.</p>
</div>
</li>
</ul>
<div className="pt-2">
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] transition-all flex items-center gap-4 shadow-xl shadow-primary/10">
                            Iniciar Acesso
                            <span className="material-symbols-outlined text-lg">trending_flat</span>
</button>
</div>
</div>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/20 section-framed min-h-screen flex items-center" id="precos">
<div className="max-w-7xl mx-auto px-6 w-full">
<div className="text-center mb-16 fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Investimento</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Planos de Assinatura</h3>
</div>
<div className="grid md:grid-cols-3 gap-10 items-stretch">
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section visible">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Familiar</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">AtÃ© 50 hectares</p>
<div className="mb-10">
<span className="text-4xl font-light dark:text-white">R$ 149</span>
<span className="text-slate-400 text-sm">/mÃªs</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            RelatÃ³rio diÃ¡rio mobile
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Monitoramento Orbital
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full border border-primary text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-slate-900 dark:bg-brand-green/10 border border-primary flex flex-col relative scale-105 shadow-2xl z-10 fade-in-section visible">
<div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.3em]">Premium</div>
<h4 className="text-sm font-semibold mb-2 text-white tracking-widest uppercase">Profissional</h4>
<p className="text-slate-500 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">AtÃ© 500 hectares</p>
<div className="mb-10 text-white">
<span className="text-4xl font-light">R$ 499</span>
<span className="text-slate-500 text-sm">/mÃªs</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Monitoramento Ilimitado
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Suporte PrioritÃ¡rio
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-primary/20">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section visible">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Enterprise</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Ãrea Ilimitada</p>
<div className="mb-10">
<span className="text-2xl font-light dark:text-white">Sob consulta</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            IntegraÃ§Ã£o via API
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Consultoria Individual
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Contato</button>
</div>
</div>
</div>
</section>
<footer className="bg-slate-950 text-white pt-24 pb-12 px-8" id="contato">
<div className="max-w-7xl mx-auto">
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-32 mb-16 fade-in-section visible">
<div className="col-span-1 lg:col-span-2">
<span className="text-xl font-bold tracking-[0.3em] mb-6 block">TRACTO</span>
<p className="text-slate-500 text-sm max-w-sm leading-loose font-light mb-8">
                        Liderando a revoluÃ§Ã£o digital no campo com Tecnologia Orbital ProprietÃ¡ria e inteligÃªncia de precisÃ£o.
                    </p>
<div className="flex gap-8">
<a className="text-slate-600 hover:text-primary transition-colors cursor-pointer">
<svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
</a>
</div>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Ecossistema</h5>
<ul className="space-y-4 text-slate-500 text-xs font-light tracking-wide">
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('servicos')?.scrollIntoView({behavior: 'smooth'})}>ServiÃ§os</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>PropÃ³sito</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('precos')?.scrollIntoView({behavior: 'smooth'})}>Planos</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer">SeguranÃ§a IP</a></li>
</ul>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Contato</h5>
<ul className="space-y-6 text-slate-500 text-xs font-light">
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">mail</span>
                            contato@tracto.ag
                        </li>
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">call</span>
                            +55 (11) 99999-9999
                        </li>
</ul>
</div>
</div>
<div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 fade-in-section visible">
<div className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">
                    Â© 2024 Tracto Agricultural Technologies.
                </div>
<div>
<button onClick={() => navigate('/login')} className="bg-primary/10 border border-primary/20 text-primary px-10 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                        ComeÃ§ar Agora
                    </button>
</div>
</div>
</div>
</footer>

</div>
        </>
    );
}

```


### `src/pages/Login.tsx`
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { supabase } from '../services/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

// â”€â”€ Geolocation helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchLocation(): Promise<{ lat: number; lng: number; name: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            'LocalizaÃ§Ã£o Atual';
          resolve({ lat, lng: lon, name: `${city}, ${data.address?.state_code?.toUpperCase() ?? ''}` });
        } catch {
          resolve({ lat, lng: lon, name: 'LocalizaÃ§Ã£o Atual' });
        }
      },
      () => resolve({ lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' })
    );
  });
}

// â”€â”€ Error messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User not found')) return 'UsuÃ¡rio nÃ£o encontrado.';
  if (msg.includes('Invalid email')) return 'E-mail invÃ¡lido.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Login() {
  const navigate = useNavigate();
  const { setCurrentLocation } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 0. reCAPTCHA Verification
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA nÃ£o carregado. Tente recarregar a pÃ¡gina.');
      }

      const token = await window.grecaptcha.execute(siteKey, { action: 'login' });
      
      const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/verify-recaptcha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        throw new Error('VerificaÃ§Ã£o de seguranÃ§a falhou. Tente novamente.');
      }

      // 1. Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);

      // 2. Geolocation (non-blocking â€” runs after auth OK)
      const loc = await fetchLocation();
      setCurrentLocation(loc);

      navigate('/app');
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app'
        }
      });
      if (authError) throw new Error(authError.message);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro no login com Google'));
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aÃ©rea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass-dark-login p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-10">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Acesso ao Ecossistema</p>
            </div>

            <div className="space-y-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] py-3.5 rounded-xl text-sm font-medium transition-all border border-[#dadce0] flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-70"
              >
                {googleLoading ? (
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                <span>Continuar com Google</span>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">ou</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { alert('Digite seu e-mail primeiro.'); return; }
                        await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/login`,
                        });
                        alert('Email de recuperaÃ§Ã£o enviado! Verifique sua caixa de entrada.');
                      }}
                      className="text-[9px] uppercase tracking-widest text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                        Entrando...
                      </>
                    ) : 'Entrar'}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-10 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Ainda nÃ£o possui acesso?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase"
                >
                  Solicitar Credenciais
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Market.tsx`
```tsx
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

// --- UtilitÃ¡rios ---
function getCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes('soja') || t.includes('amendoim') || t.includes('grÃ£o') || t.includes('algodÃ£o') || t.includes('cafÃ©') || t.includes('milho')) return { label: 'GrÃ£os', bg: 'bg-emerald-500/20 text-emerald-400' };
  if (t.includes('boi') || t.includes('carne') || t.includes('pecuÃ¡ria') || t.includes('frango') || t.includes('suÃ­no')) return { label: 'PecuÃ¡ria', bg: 'bg-amber-500/20 text-amber-400' };
  if (t.includes('diesel') || t.includes('frete') || t.includes('logÃ­stica') || t.includes('corredor')) return { label: 'LogÃ­stica', bg: 'bg-blue-500/20 text-blue-400' };
  if (t.includes('praga') || t.includes('lagarta') || t.includes('fungo') || t.includes('doenÃ§a')) return { label: 'Fitossanidade', bg: 'bg-red-500/20 text-red-400' };
  if (t.includes('fertilizante') || t.includes('ureia') || t.includes('potÃ¡ssio')) return { label: 'Insumos', bg: 'bg-purple-500/20 text-purple-400' };
  if (t.includes('clima') || t.includes('chuva') || t.includes('seca') || t.includes('geada')) return { label: 'Clima', bg: 'bg-cyan-500/20 text-cyan-400' };
  return { label: 'Agro', bg: 'bg-slate-700/50 text-slate-300' };
}

function timeAgo(dateString: string) {
  try {
    // Normalizar a data do RSS caso tenha formato inesperado
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const diff = Math.floor((Date.now() - d.getTime()) / 60000); // mins
    if (diff < 1) return `agora mesmo`;
    if (diff < 60) return `hÃ¡ ${diff}min`;
    if (diff < 1440) return `hÃ¡ ${Math.floor(diff/60)}h`;
    return `hÃ¡ ${Math.floor(diff/1440)}d`;
  } catch {
    return dateString;
  }
}

// --- Interfaces ---
interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  url: string;
  image?: string;
}



// Valores de commodities ref (jÃ¡ que HG/Awesome nÃ£o cobrem gratuitamente commodities fÃ­sicas BR)
const STATIC_COMMODITIES = {
  "GRÃƒOS": [
    { name: 'Soja', place: 'ParanaguÃ¡ (sc 60kg)', price: '132,50', change: 1.2, pos: 80 },
    { name: 'Milho', place: 'Campinas (sc 60kg)', price: '58,20', change: -0.5, pos: 40 },
    { name: 'AlgodÃ£o', place: 'ESALQ (@)', price: '142,30', change: 0.8, pos: 60 },
    { name: 'CafÃ© ArÃ¡bica', place: 'BMEF (sc 60kg)', price: '1.045,00', change: 2.1, pos: 90 },
  ],
  "PECUÃRIA": [
    { name: 'Boi Gordo', place: 'SP (@)', price: '235,00', change: 0.4, pos: 70 },
    { name: 'Frango Congelado', place: 'SP (kg)', price: '7,40', change: -0.2, pos: 45 },
    { name: 'SuÃ­no Vivo', place: 'PR (kg)', price: '6,80', change: 0.1, pos: 55 },
  ],
  "INSUMOS": [
    { name: 'Ureia', place: '(ton)', price: '2.100,00', change: -1.5, pos: 30 },
    { name: 'MAP', place: '(ton)', price: '3.450,00', change: 0.0, pos: 50 },
    { name: 'PotÃ¡ssio (KCl)', place: '(ton)', price: '2.800,00', change: 0.5, pos: 65 },
  ],
  "ENERGIA": [
    { name: 'PetrÃ³leo WTI', place: '(barril)', price: '82,50', change: 1.1, pos: 75 },
    { name: 'Ouro', place: '(oz)', price: '2.340,00', change: 0.9, pos: 85 },
    { name: 'Etanol Hidratado', place: 'SP (mÂ³)', price: '2.450,00', change: -0.8, pos: 35 },
  ]
};

const TICKER_ITEMS = [
  { name: 'Soja', price: 'R$ 132,50', change: +1.2 },
  { name: 'Milho', price: 'R$ 58,20', change: -0.5 },
  { name: 'AlgodÃ£o', price: 'R$ 142,30', change: +0.8 },
  { name: 'CafÃ©', price: 'R$ 1.045,00', change: +2.1 },
  { name: 'Boi Gordo', price: 'R$ 235,00', change: +0.4 },
  { name: 'Frango', price: 'R$ 7,40', change: -0.2 },
  { name: 'SuÃ­no', price: 'R$ 6,80', change: +0.1 },
  { name: 'PetrÃ³leo', price: 'US$ 82,50', change: +1.1 },
  { name: 'Ouro', price: 'US$ 2.340', change: +0.9 },
  { name: 'Ureia', price: 'R$ 2.100', change: -1.5 },
  { name: 'USD', price: 'R$ 4,95', change: -0.3 }, 
  { name: 'EUR', price: 'R$ 5,35', change: +0.2 }, 
  { name: 'GBP', price: 'R$ 6,24', change: +0.4 }, 
];

export default function Market() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // BLOCO 2 â€” NotÃ­cias via RSS
  const fetchNews = async () => {
    try {
      const rssUrl = 'https://www.canalrural.com.br/feed/';
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
      const data = await res.json();
      if (data.status === 'ok') {
        const formattedNews = data.items.slice(0, 5).map((item: any) => ({
          id: item.guid,
          title: item.title,
          source: 'Canal Rural',
          time: timeAgo(item.pubDate),
          url: item.link,
          // A API rss2json costuma extrair thumbnail/enclosure
          image: item.thumbnail || item.enclosure?.link || null
        }));
        setNews(formattedNews);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Erro ao buscar notÃ­cias RSS:', e);
    }
  };



  useEffect(() => {
    fetchNews();
    
    // Updates
    const inv1 = setInterval(fetchNews, 5 * 60 * 1000); // 5 mins
    
    return () => { clearInterval(inv1); };
  }, []);

  const topNews = news[0];
  const gridNews = news.slice(1, 5);

  return (
    <div className="min-h-screen font-sans pb-16 overflow-x-hidden selection:bg-orange-500/30" style={{ background: '#080809' }}>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-wrap {
          width: 200%;
          display: flex;
          animation: marquee 30s linear infinite;
        }
        .ticker-wrap:hover {
          animation-play-state: paused;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .glass-panel {
          background: rgba(255,255,255,0.02);
          border: 0.5px solid rgba(255,255,255,0.08);
        }
      `}</style>

      {/* BLOCO 1 â€” TICKER ANIMADO */}
      <div 
        className="w-full relative overflow-hidden flex items-center h-10 select-none"
        style={{ background: 'rgba(236,91,19,0.08)', borderBottom: '1px solid rgba(236,91,19,0.2)' }}
      >
        <div className="ticker-wrap absolute flex whitespace-nowrap">
          {/* Ticker duplo para animaÃ§Ã£o contÃ­nua */}
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center mx-6 gap-2 text-xs font-semibold">
              <span className="text-slate-300">{item.name}</span>
              <span className="text-white">{item.price}</span>
              <span className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(item.change).toFixed(2)}%
              </span>
              <span className="mx-4 text-slate-600 font-normal">Â·</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10">
        
        {/* CABEÃ‡ALHO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mercado Financeiro</h1>
            <p className="text-slate-400 text-sm">CotaÃ§Ãµes e anÃ¡lises do agronegÃ³cio em tempo real</p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500"></span>
              </span>
              Atualizado Ã s {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* 3 Colunas: Esquerda (2/3) NotÃ­cias | Direita (1/3) Painel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* BLOCO 2 â€” NOTÃCIAS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Destaque Principal */}
            {topNews ? (
              <a 
                href={topNews.url} target="_blank" rel="noopener noreferrer"
                className="group relative block rounded-2xl overflow-hidden h-[400px] transition-transform duration-200 hover:-translate-y-1 glass-panel"
              >
                {topNews.image ? (
                  <img src={topNews.image} alt={topNews.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                    <span className="material-symbols-outlined text-[80px] text-white/20">agriculture</span>
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded ${getCategory(topNews.title).bg}`}>
                      {getCategory(topNews.title).label}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{topNews.time}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug group-hover:text-[#ec5b13] transition-colors line-clamp-2">
                    {topNews.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5 font-medium tracking-wide">
                    {topNews.source}
                    <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </div>
              </a>
            ) : (
              <div className="h-[400px] rounded-2xl animate-pulse glass-panel" />
            )}

            {/* Grid SecundÃ¡rio: 2x2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gridNews.length > 0 ? gridNews.map(item => (
                <a 
                  key={item.id} 
                  href={item.url} target="_blank" rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 glass-panel"
                >
                  <div className="h-44 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                        <span className="material-symbols-outlined text-[60px] text-white/20">agriculture</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded ${getCategory(item.title).bg}`}>
                            {getCategory(item.title).label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{item.time}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-[#ec5b13] transition-colors mb-4">
                        {item.title}
                        </h3>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                        {item.source}
                    </p>
                  </div>
                </a>
              )) : (
                 Array(4).fill(0).map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse glass-panel" />)
              )}
            </div>
          </div>

          {/* BLOCO 3 â€” PAINEL DE PREÃ‡OS */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            
            {Object.entries(STATIC_COMMODITIES).map(([cat, items]) => (
              <div key={cat} className="space-y-4">
                <h3 className="text-[10px] font-bold text-[#ec5b13] uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ec5b13]"></span>
                  {cat}
                </h3>
                <div className="flex flex-col gap-3">
                  {items.map(item => (
                    <div 
                      key={item.name} 
                      className="group p-4 rounded-xl relative overflow-hidden transition-all duration-200 hover:border-[#ec5b13] glass-panel"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                            {item.name} 
                            <span className="text-[9px] font-medium text-slate-500 uppercase px-1.5 py-0.5 bg-slate-800/50 rounded" title="PreÃ§o de ReferÃªncia Base">(ref.)</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.place}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-white tracking-tight mb-0.5">R$ {item.price}</p>
                          <p className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${item.pos}%`, 
                            background: item.change >= 0 ? '#4ade80' : '#f87171' 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>



      </div>
    </div>
  );
}

```


### `src/pages/Register.tsx`
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
}


const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  } else if (val.length > 6) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  } else if (val.length > 2) {
    return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  } else if (val.length > 0) {
    return `(${val}`;
  }
  return val;
};

// â”€â”€ Error messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function friendlyError(msg: string): string {
  if (msg.includes('User already registered') || msg.includes('already exists')) return 'Este e-mail jÃ¡ estÃ¡ cadastrado.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas nÃ£o coincidem.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Telefone invÃ¡lido.');
      return;
    }

    setLoading(true);

    try {
      // 0. reCAPTCHA Verification
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA nÃ£o carregado. Tente recarregar a pÃ¡gina.');
      }

      const token = await window.grecaptcha.execute(siteKey, { action: 'register' });
      
      const verifyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/verify-recaptcha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        throw new Error('VerificaÃ§Ã£o de seguranÃ§a falhou. Tente novamente.');
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: cleanPhone,
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      setSuccess(true);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app'
        }
      });
      if (authError) throw new Error(authError.message);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro no login com Google'));
      setGoogleLoading(false);
    }
  };


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aÃ©rea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md px-6 py-12">
          <div className="glass-dark-login p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-8">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Criar Nova Conta</p>
            </div>

            {!success && (
              <div className="mb-6 space-y-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] py-3.5 rounded-xl text-sm font-medium transition-all border border-[#dadce0] flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-70"
                >
                  {googleLoading ? (
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  <span>Continuar com Google</span>
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">ou</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
              </div>
            )}


            {success ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-green-400 text-2xl">mail</span>
                </div>
                <p className="text-sm font-semibold text-white">Cadastro solicitado</p>
                <p className="text-xs text-slate-400 leading-relaxed">Verifique seu email para confirmar o cadastro.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] shadow-xl shadow-orange-500/20"
                >
                  Ir para Login
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="Seu nome"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                  />
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}

            {!success && (
              <div className="mt-8 text-center">
                <p className="text-slate-500 text-[9px] uppercase tracking-widest">
                  JÃ¡ possui conta?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase"
                  >
                    Fazer Login
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Reports.tsx`
```tsx
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import useAppStore from '../store/useAppStore';
import type { Location } from '../store/useAppStore';
import { analyzeField } from '../services/api';
import type { FieldAnalysisResult } from '../services/api';
import { polygonAreaHa } from '../utils/geo';

// â”€â”€ Sem dados histÃ³ricos simulados na Etapa 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€ PDF export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function exportPDF(fields: ReturnType<typeof useAppStore.getState>['savedLocations']) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(236, 91, 19);
  doc.text('Tracto â€” RelatÃ³rio de TalhÃµes', 15, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 28);

  let y = 40;
  fields.forEach((f, i) => {
    const area = f.boundaries ? polygonAreaHa(f.boundaries) : 0;
    const name = f.name ?? `TalhÃ£o ${i + 1}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i + 1}. ${name}`, 15, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Ãrea: ${area.toFixed(2)} ha`, 20, y);
    y += 5;
    doc.text(`Coordenadas: lat ${f.lat.toFixed(5)}, lng ${f.lng.toFixed(5)}`, 20, y);
    y += 5;
    doc.text(`VÃ©rtices: ${f.boundaries?.length ?? 0}`, 20, y);
    y += 10;

    if (y > 270) { doc.addPage(); y = 20; }
  });

  if (fields.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum talhÃ£o cadastrado.', 15, y);
  }

  doc.save('tracto-relatorio.pdf');
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Reports() {
  const { savedLocations, weatherCache } = useAppStore();
  const [analysisResults, setAnalysisResults] = useState<Record<string, FieldAnalysisResult>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});

  // Carregar do cache inicial se existir
  useEffect(() => {
    const initial: Record<string, FieldAnalysisResult> = {};
    savedLocations.forEach(loc => {
      const key = `${loc.lat}-${loc.lng}`;
      const cached = localStorage.getItem(`tracto-ndvi-${key}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            initial[key] = parsed.data;
          }
        } catch {}
      }
    });
    setAnalysisResults(initial);
  }, [savedLocations]);

  const handleAnalyze = async (loc: Location) => {
    const key = `${loc.lat}-${loc.lng}`;
    setLoadingAnalysis(prev => ({ ...prev, [key]: true }));
    try {
      const fieldName = loc.name || 'Setor Base';
      const cropType = loc.cultura;
      const result = await analyzeField(
        loc.lat, 
        loc.lng, 
        fieldName, 
        cropType, 
        weatherCache,
        loc.boundaries || null,
        loc.dataPlantio,
        loc.variedade,
        loc.areaHa
      );

      setAnalysisResults(prev => ({ ...prev, [key]: result }));
      localStorage.setItem(`tracto-ndvi-${key}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [key]: false }));
    }
  };

  const hasFields = savedLocations.length > 0;


  const totalArea = savedLocations.reduce((s, l) =>
    s + (l.boundaries ? polygonAreaHa(l.boundaries) : 0.01), 0);

  const kpis = [
    { label: 'Prod. MÃ©dia', value: 'N/D', icon: 'agriculture', color: '#4ade80' },
    { label: 'NDVI MÃ©dio', value: 'N/D', icon: 'satellite_alt', color: '#60a5fa' },
    { label: 'RelatÃ³rios', value: String(hasFields ? savedLocations.length : 0), icon: 'description', color: '#ec5b13' },
    { label: 'Ãrea Analisada', value: hasFields ? `${totalArea.toFixed(1)} ha` : 'â€“', icon: 'map', color: '#a78bfa' },
  ];

  const fieldRows = hasFields
    ? savedLocations.map((loc, i) => ({
        icon: 'description',
        name: `RelatÃ³rio â€” ${loc.name ?? `TalhÃ£o ${i + 1}`}`,
        date: 'Sob demanda',
        field: loc.name ?? `TalhÃ£o ${i + 1}`,
        area: loc.boundaries ? `${polygonAreaHa(loc.boundaries).toFixed(2)} ha` : '< 0.01 ha',
        status: 'DisponÃ­vel',
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: '#080809' }}>
      <div className="p-5 flex flex-col gap-5 max-w-5xl mx-auto w-full">

        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">RelatÃ³rios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {hasFields ? `${savedLocations.length} talhÃ£o${savedLocations.length > 1 ? 'Ãµes' : ''} Â· RelatÃ³rios DeterminÃ­sticos` : 'Cadastre talhÃµes para gerar relatÃ³rios'}
            </p>
          </div>
          <button
            onClick={() => exportPDF(savedLocations)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.28)' }}
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>

        {/* â”€â”€ Aviso de ConfianÃ§a â”€â”€ */}
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <span className="material-symbols-outlined shrink-0" style={{ color: '#38bdf8' }}>info</span>
          <p className="text-sm font-medium" style={{ color: '#bae6fd' }}>
            Dados reportados via motor determinÃ­stico. O histÃ³rico temporal requer meses de coleta ativa para calibraÃ§Ã£o de curvas.
          </p>
        </div>

        {/* â”€â”€ KPIs â”€â”€ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.color + '18' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: k.color }}>{k.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{k.label}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-base font-bold text-white">{k.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* â”€â”€ AnÃ¡lise de SatÃ©lite â”€â”€ */}
        {hasFields && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
              AnÃ¡lise de SatÃ©lite
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {savedLocations.map((loc, i) => {
                const key = `${loc.lat}-${loc.lng}`;
                const result = analysisResults[key];
                const isLoading = loadingAnalysis[key];
                const name = loc.name ?? `TalhÃ£o ${i + 1}`;

                return (
                  <div key={key} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {isLoading ? (
                      <div className="p-6 col-span-1 animate-pulse flex flex-col gap-4">
                        <div className="h-4 bg-white/10 rounded w-1/4"></div>
                        <div className="h-48 bg-white/5 rounded-xl w-full"></div>
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      </div>
                    ) : result ? (
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">{name}</h3>
                          {result.date_acquired && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                              <span>{new Date(result.date_acquired?.split(' ')[0] || '').toLocaleDateString('pt-BR')}</span>
                              {result.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80">(Aprox)</span>}
                              {result.cloud_coverage !== null && ` Â· Nuvens: ${result.cloud_coverage}%`}
                            </span>
                          )}
                        </div>

                        {result.ndvi_image_base64 && (
                          <img 
                            src={`data:image/png;base64,${result.ndvi_image_base64}`} 
                            alt={`NDVI ${name}`}
                            className="w-full h-[200px] object-cover rounded-xl mb-6"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        )}

                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metricas Deterministicas</h4>
                             <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${result.confidence > 0.7 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    Confianca: {(result.confidence * 100).toFixed(0)}%
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-700 text-slate-300">
                                    {result.source || 'Sentinel-2'}
                                </span>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">NDVI MÃ©dio</p>
                                <p className="text-sm font-bold text-white">{result.ndvi_analysis.ndvi_medio.toFixed(3)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">PulverizaÃ§Ã£o</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : 'text-amber-400'}`}>
                                    {result.engine_results?.spray_window?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Risco Geada</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.frost_risk?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.frost_risk?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Estresse HÃ­drico</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.water_stress?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.water_stress?.label.toUpperCase()}
                                </p>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Zonas de Vigor (NDVI)</h4>
                          <div className="h-6 w-full rounded-full overflow-hidden flex" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="h-full bg-red-500" style={{ width: `${result.ndvi_analysis.zona_critica_pct}%` }} title={`CrÃ­tica: ${result.ndvi_analysis.zona_critica_pct}%`} />
                            <div className="h-full bg-yellow-500" style={{ width: `${result.ndvi_analysis.zona_estresse_pct}%` }} title={`Estresse: ${result.ndvi_analysis.zona_estresse_pct}%`} />
                            <div className="h-full bg-green-400" style={{ width: `${result.ndvi_analysis.zona_saudavel_pct}%` }} title={`SaudÃ¡vel: ${result.ndvi_analysis.zona_saudavel_pct}%`} />
                            <div className="h-full bg-green-700" style={{ width: `${result.ndvi_analysis.zona_excelente_pct}%` }} title={`Excelente: ${result.ndvi_analysis.zona_excelente_pct}%`} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                            <span>CrÃ­tico ({result.ndvi_analysis.zona_critica_pct}%)</span>
                            <span>Excelente ({result.ndvi_analysis.zona_excelente_pct}%)</span>
                          </div>
                        </div>

                        <div className="mb-6 prose prose-sm prose-invert max-w-none text-slate-300">
                          <p>{result.ai_report}</p>
                        </div>

                        {result.ndvi_analysis.problemas_detectados.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Problemas Detectados</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.ndvi_analysis.problemas_detectados.map(prob => (
                                <span key={prob} className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                                  {prob}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => handleAnalyze(loc)}
                                className="px-4 py-2 rounded-lg text-xs font-bold transition-all border text-slate-300 hover:text-white hover:bg-white/5"
                                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'transparent' }}
                            >
                                Re-analisar
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center justify-center text-center py-12">
                        <span className="material-symbols-outlined text-4xl mb-3" style={{ color: '#64748b' }}>query_stats</span>
                        <h3 className="text-white font-bold mb-1">{name}</h3>
                        <p className="text-xs text-slate-400 mb-4 max-w-sm">Gere um relatÃ³rio detalhado de IA com imagens NDVI recentes de satÃ©lite e recomendaÃ§Ãµes agronÃ´micas.</p>
                        <button
                          onClick={() => handleAnalyze(loc)}
                          className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg"
                          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
                        >
                          Gerar AnÃ¡lise Completa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â”€â”€ Honest UX: HistÃ³rico Real Missing â”€â”€ */}
        {hasFields && (
          <div className="py-10 text-center rounded-2xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <span className="material-symbols-outlined text-4xl block mb-3 opacity-50" style={{ color: '#64748b' }}>timeline</span>
            <p className="text-sm font-semibold text-white mb-1">HistÃ³rico Temporal IndisponÃ­vel</p>
            <p className="text-xs max-w-sm mx-auto" style={{ color: '#64748b' }}>
              SÃ£o necessÃ¡rios mÃºltiplos meses de coleta de imagens de satÃ©lite e dados de campo para gerar curvas de evoluÃ§Ã£o do NDVI e Produtividade (Etapa 2).
            </p>
          </div>
        )}

        {/* â”€â”€ Reports Table â”€â”€ */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white">RelatÃ³rios Gerados</h2>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              {fieldRows.length} registros
            </span>
          </div>

          {fieldRows.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#ec5b13' }}>description</span>
              <p className="text-sm font-semibold text-white mb-1">Nenhum talhÃ£o cadastrado</p>
              <p className="text-xs" style={{ color: '#64748b' }}>VÃ¡ ao mapa e desenhe um talhÃ£o para gerar relatÃ³rios automÃ¡ticos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['RelatÃ³rio', 'TalhÃ£o', 'Ãrea', 'Data', 'Status', ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                            <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>{row.icon}</span>
                          </div>
                          <span className="font-medium text-white truncate max-w-[140px]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.field}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.area}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.date}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => exportPDF([savedLocations[i]])}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(236,91,19,0.1)', color: '#ec5b13', border: '1px solid rgba(236,91,19,0.15)' }}
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Precipitation info if available */}
        {weatherCache && (
          <div className="p-4 rounded-xl flex items-center gap-3 text-xs" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
            <span className="material-symbols-outlined text-blue-400">water_drop</span>
            <span style={{ color: '#94a3b8' }}>PrecipitaÃ§Ã£o acumulada (7d): <span className="text-white font-semibold">{weatherCache.daily.precipSum.reduce((a, b) => a + (b ?? 0), 0).toFixed(1)} mm</span></span>
          </div>
        )}

      </div>
    </div>
  );
}

```


### `src/pages/Weather.tsx`
```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore, { type WeatherCache } from '../store/useAppStore';
import { SkeletonCard } from '../components/Skeleton';

// â”€â”€ WMO Weather Code â†’ icon + label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WMO_CODES: Record<number, { icon: string; label: string }> = {
  0: { icon: 'wb_sunny', label: 'CÃ©u limpo' },
  1: { icon: 'wb_sunny', label: 'Predominantemente limpo' },
  2: { icon: 'partly_cloudy_day', label: 'Parcialmente nublado' },
  3: { icon: 'cloud', label: 'Nublado' },
  45: { icon: 'foggy', label: 'Neblina' },
  48: { icon: 'foggy', label: 'Neblina com gelo' },
  51: { icon: 'grain', label: 'Chuvisco leve' },
  61: { icon: 'rainy', label: 'Chuva leve' },
  63: { icon: 'rainy', label: 'Chuva moderada' },
  65: { icon: 'rainy', label: 'Chuva forte' },
  71: { icon: 'ac_unit', label: 'Neve leve' },
  80: { icon: 'rainy', label: 'Pancadas de chuva' },
  95: { icon: 'thunderstorm', label: 'Tempestade' },
  99: { icon: 'thunderstorm', label: 'Tempestade com granizo' },
};

const wmo = (code: number) => WMO_CODES[code] ?? { icon: 'cloud', label: 'VariÃ¡vel' };

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b'];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// â”€â”€ Open-Meteo fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherCache> {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,visibility',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean',
    timezone: 'America/Sao_Paulo',
    forecast_days: '7',
    forecast_hours: '24',
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error('Erro ao buscar dados da Open-Meteo');
  const d = await res.json();

  return {
    lat,
    lng,
    fetchedAt: Date.now(),
    temperature: d.current.temperature_2m,
    windSpeed: d.current.wind_speed_10m,
    humidity: d.current.relative_humidity_2m,
    weatherCode: d.current.weather_code,
    daily: {
      time: d.daily.time,
      tempMax: d.daily.temperature_2m_max,
      tempMin: d.daily.temperature_2m_min,
      precipSum: d.daily.precipitation_sum,
      et0: d.daily.et0_fao_evapotranspiration ?? [],
    },
    hourly: {
      time: d.hourly.time.slice(0, 24),
      temp: d.hourly.temperature_2m.slice(0, 24),
      humidity: d.hourly.relative_humidity_2m.slice(0, 24),
      precip: d.hourly.precipitation.slice(0, 24),
      windSpeed: d.hourly.wind_speed_10m.slice(0, 24),
      visibility: d.hourly.visibility.slice(0, 24),
    },
  };
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Weather() {
  const navigate = useNavigate();
  const { currentLocation, savedLocations, weatherCache, setWeatherCache } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windyOverlay, setWindyOverlay] = useState<'temp' | 'rain' | 'humidity' | 'wind' | 'clouds'>('temp');

  const loc = savedLocations.length > 0
    ? savedLocations[savedLocations.length - 1]
    : (currentLocation ?? { lat: -18.9188, lng: -48.2768, name: 'UberlÃ¢ndia, MG' });

  useEffect(() => {
    const isCacheValid =
      weatherCache &&
      Math.abs(weatherCache.lat - loc.lat) < 0.01 &&
      Math.abs(weatherCache.lng - loc.lng) < 0.01 &&
      Date.now() - weatherCache.fetchedAt < CACHE_TTL_MS;

    if (isCacheValid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchOpenMeteo(loc.lat, loc.lng)
      .then((cache) => setWeatherCache(cache))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro desconhecido'))
      .finally(() => setLoading(false));
  }, [loc.lat, loc.lng]);

  const w = weatherCache;
  const { icon, label } = w ? wmo(w.weatherCode) : { icon: 'cloud', label: '' };

  // Current hour index for highlighting
  const nowHour = new Date().getHours();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: '#080809' }}>
      <div className="p-5 flex flex-col gap-4 max-w-5xl mx-auto w-full">

        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Meteorologia</h1>
            <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>location_on</span>
              {loc.name ?? 'LocalizaÃ§Ã£o atual'} Â· Open-Meteo
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchOpenMeteo(loc.lat, loc.lng)
                .then(setWeatherCache)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Atualizar
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* â”€â”€ Mapa MeteorolÃ³gico Windy â”€â”€ */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
          {/* Header do mapa */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Mapa MeteorolÃ³gico em Tempo Real</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Windy Â· Ao Vivo
              </span>
            </div>
            {/* Seletor de camadas */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { key: 'temp', label: 'Temperatura', icon: 'thermostat' },
                { key: 'rain', label: 'PrecipitaÃ§Ã£o', icon: 'water_drop' },
                { key: 'humidity', label: 'Umidade', icon: 'humidity_percentage' },
                { key: 'wind', label: 'Vento', icon: 'air' },
                { key: 'clouds', label: 'Nuvens', icon: 'cloud' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setWindyOverlay(key as typeof windyOverlay)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={windyOverlay === key
                    ? { background: 'rgba(236,91,19,0.2)', color: '#ec5b13' }
                    : { color: '#64748b' }
                  }
                >
                  <span className="material-symbols-outlined text-xs">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* iframe Windy */}
          <iframe
            key={`${loc.lat}-${loc.lng}-${windyOverlay}`}
            src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=Â°C&metricWind=km/h&lat=${loc.lat}&lon=${loc.lng}&zoom=8&level=surface&overlay=${windyOverlay}&menu=false&message=true&marker=true&calendar=now&pressure=true&type=map&detail=false&detailLat=${loc.lat}&detailLon=${loc.lng}&distIndicator=false&dMap=0`}
            className="w-full"
            style={{ height: 480, border: 'none', display: 'block' }}
            title="Mapa MeteorolÃ³gico"
            allowFullScreen
          />
        </div>

        {/* â”€â”€ First Load Loading Skeleton â”€â”€ */}
        {!w && loading && (
          <div className="space-y-4">
            <SkeletonCard style={{ height: 160 }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
            </div>
            <SkeletonCard style={{ height: 200 }} />
          </div>
        )}

        {/* â”€â”€ Current Weather Card â”€â”€ */}
        {w && (
          <div
            className="relative overflow-hidden rounded-2xl p-6 flex flex-col sm:flex-row gap-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: '#ec5b13', opacity: 0.07, filter: 'blur(50px)' }} />

            {loading && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                <span className="material-symbols-outlined text-xs animate-spin text-orange-500">refresh</span>
                <span className="text-[10px] text-slate-400">Atualizando...</span>
              </div>
            )}

            {/* Main temp */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                <span className="material-symbols-outlined text-5xl" style={{ color: '#ec5b13' }}>{icon}</span>
              </div>
              <div>
                <p className="text-7xl font-black text-white leading-none">{Math.round(w.temperature)}Â°</p>
                <p className="text-sm font-semibold capitalize mt-1" style={{ color: '#e2e8f0' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                  MÃ¡x {Math.round(w.daily.tempMax[0] ?? w.temperature)}Â° Â· MÃ­n {Math.round(w.daily.tempMin[0] ?? w.temperature)}Â°
                </p>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Quick stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 items-center">
              {[
                { icon: 'air', label: 'Vento', val: `${Math.round(w.windSpeed)} km/h`, color: '#94a3b8' },
                { icon: 'water_drop', label: 'Umidade', val: `${w.humidity}%`, color: '#60a5fa' },
                { icon: 'umbrella', label: 'Precip. hoje', val: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, color: '#818cf8' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="material-symbols-outlined text-base" style={{ color: s.color }}>{s.icon}</span>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{s.label}</p>
                  </div>
                  <p className="text-lg font-bold text-white">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* â”€â”€ 6 Metrics Grid â”€â”€ */}
        {w && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Vento', value: `${Math.round(w.windSpeed)} km/h`, icon: 'air', color: '#94a3b8' },
              { label: 'Umidade', value: `${w.humidity}%`, icon: 'water_drop', color: '#60a5fa' },
              { label: 'Visibilidade', value: `${((w.hourly.visibility[nowHour] ?? 10000) / 1000).toFixed(1)} km`, icon: 'visibility', color: '#a78bfa' },
              { label: 'Precip. acumulada (7d)', value: `${w.daily.precipSum.reduce((a, b) => a + (b ?? 0), 0).toFixed(1)} mm`, icon: 'water', color: '#38bdf8' },
              { label: 'Etâ‚€ (hoje)', value: w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D', icon: 'local_florist', color: '#4ade80' },
              { label: 'Chuva hoje', value: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, icon: 'umbrella', color: '#818cf8' },
            ].map((m) => (
              <div key={m.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: m.color + '18' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-base font-bold text-white mt-0.5">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* â”€â”€ Dados AgrÃ­colas â”€â”€ */}
        {w && w.daily.et0.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-xl" style={{ color: '#4ade80' }}>agriculture</span>
              <h2 className="text-sm font-bold text-white">Dados AgrÃ­colas</h2>
              <span className="text-[10px] ml-auto font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Open-Meteo Â· GrÃ¡tis</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {w.daily.time.slice(0, 4).map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                return (
                  <div key={time} className="p-3 rounded-xl flex flex-col gap-2" style={{ background: i === 0 ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i === 0 ? '#4ade80' : '#64748b' }}>{dayLabel}</p>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>ETâ‚€</p>
                      <p className="text-sm font-bold text-white">{w.daily.et0[i] != null ? `${w.daily.et0[i].toFixed(2)}` : 'â€”'} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm/d</span></p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>PrecipitaÃ§Ã£o</p>
                      <p className="text-sm font-bold text-white">{(w.daily.precipSum[i] ?? 0).toFixed(1)} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â”€â”€ PrevisÃ£o HorÃ¡ria â”€â”€ */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">PrevisÃ£o por Hora</h2>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>PrÃ³ximas 24h</span>
            </div>
            <div className="flex overflow-x-auto scrollbar-thin p-4 gap-3">
              {w.hourly.time.map((t, i) => {
                const h = new Date(t).getHours();
                const isNow = i === 0;
                return (
                  <div
                    key={t}
                    className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl flex-shrink-0 transition-all"
                    style={{
                      background: isNow ? 'rgba(236,91,19,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isNow ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      minWidth: 72,
                    }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: isNow ? '#ec5b13' : '#64748b' }}>
                      {isNow ? 'Agora' : `${h}h`}
                    </p>
                    <span className="material-symbols-outlined text-2xl" style={{ color: isNow ? '#ec5b13' : '#94a3b8' }}>
                      {wmo(w.weatherCode).icon}
                    </span>
                    <p className="text-sm font-bold text-white">{Math.round(w.hourly.temp[i])}Â°</p>
                    {w.hourly.precip[i] > 0 && (
                      <p className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>{w.hourly.precip[i].toFixed(1)}mm</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â”€â”€ PrevisÃ£o 7 Dias â”€â”€ */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">PrÃ³ximos 7 Dias</h2>
            </div>
            <div>
              {w.daily.time.map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                const pct = Math.max(0, Math.min(100, ((w.daily.tempMax[i] - 5) / 35) * 100));
                return (
                  <div key={time} className="flex items-center gap-4 px-5 py-4 border-b last:border-none" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-sm font-semibold capitalize text-white w-24 shrink-0">{dayLabel}</p>
                    <span className="material-symbols-outlined text-xl" style={{ color: '#94a3b8' }}>{wmo(w.weatherCode).icon}</span>
                    <div className="flex items-center gap-1.5 flex-1 text-xs" style={{ color: '#64748b' }}>
                      {w.daily.precipSum[i] > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <span className="material-symbols-outlined text-xs">water_drop</span>
                          {w.daily.precipSum[i].toFixed(1)}mm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <span style={{ color: '#60a5fa' }}>{Math.round(w.daily.tempMin[i])}Â°</span>
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(to right, #60a5fa, #f97316)' }} />
                      </div>
                      <span style={{ color: '#f97316' }}>{Math.round(w.daily.tempMax[i])}Â°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* â”€â”€ RecomendaÃ§Ãµes â”€â”€ */}
        {w && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>agriculture</span>
                <h3 className="text-sm font-bold text-white">Janela de PulverizaÃ§Ã£o</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Vento atual <span className="text-white font-semibold">{Math.round(w.windSpeed)} km/h</span> e umidade <span className="text-white font-semibold">{w.humidity}%</span> â€” {w.windSpeed < 15 && w.humidity < 80 ? 'condiÃ§Ãµes favorÃ¡veis para aplicaÃ§Ã£o no TalhÃ£o Norte.' : 'aguarde condiÃ§Ãµes mais favorÃ¡veis.'}
              </p>
              <button
                onClick={() => navigate('/app/reports')}
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: '#ec5b13' }}>
                Gerar RelatÃ³rio de PulverizaÃ§Ã£o
              </button>
            </div>
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl text-blue-400">water_drop</span>
                <h3 className="text-sm font-bold text-white">Manejo de IrrigaÃ§Ã£o</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                ETâ‚€ de <span className="text-white font-semibold">{w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D'}</span> com precipitaÃ§Ã£o prevista de <span className="text-white font-semibold">{(w.daily.precipSum[0] ?? 0).toFixed(1)} mm</span> â€” {(w.daily.precipSum[0] ?? 0) > 5 ? 'reduza o fluxo de irrigaÃ§Ã£o para evitar desperdÃ­cio.' : 'recomenda-se irrigaÃ§Ã£o suplementar.'}
              </p>
              <button
                disabled
                title="Em breve"
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', opacity: 0.5, cursor: 'not-allowed' }}
              >
                Ver Plano de IrrigaÃ§Ã£o
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

```

### `src/services/api.ts`
```ts
import type { WeatherCache } from '../store/useAppStore';
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function buildAuthHeaders() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  } catch {
    return {};
  }
}

function buildForecastSummary(weatherCache: WeatherCache | null | undefined) {
  if (!weatherCache) return null;

  return weatherCache.daily.time
    .slice(0, 7)
    .map((day, index) => {
      const min = weatherCache.daily.tempMin[index];
      const max = weatherCache.daily.tempMax[index];
      const rain = weatherCache.daily.precipSum[index] ?? 0;
      return `${day}: ${Math.round(min ?? 0)}-${Math.round(max ?? 0)}C, chuva ${rain.toFixed(1)}mm`;
    })
    .join(' | ');
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = await buildAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Erro na API: ${response.status}`);
  }

  return response.json();
}

/**
 * Interface unificada para anÃ¡lise de talhÃ£o e geraÃ§Ã£o de alertas.
 * Centraliza a lÃ³gica de expiraÃ§Ã£o e cache semÃ¢ntico.
 */
export const tractorAPI = {
  analyzeField: async (params: {
    field_name: string;
    lat: number;
    lng: number;
    crop_type: string;
    boundaries?: [number, number][];
    hourly_weather?: any;
    forecast_7d?: string | null;
  }) => {
    return apiFetch<any>('/api/analyze-field', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getAlerts: async (params: {
    temperature: number;
    humidity: number;
    wind_speed: number;
    rain_accumulation: number;
    crop_type?: string;
    weather_forecast?: string;
    fields?: any[];
  }) => {
    return apiFetch<{ alerts: any[] }>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  analyzeWeatherMap: async (image_base64: string, weather_data: any, field_locations: any[]) => {
    return apiFetch<{ analysis: string }>('/api/analyze-weather-map', {
      method: 'POST',
      body: JSON.stringify({ image_base64, weather_data, field_locations }),
    });
  },
};
```

### `src/services/alertsAI.ts`
```ts
import { tractorAPI } from './api';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  field?: string;
  value?: string;
  valueLabel?: string;
}

export const alertsAI = {
  getAlerts: async (
    weather: { temp: number; humidity: number; windSpeed: number; precip: number },
    fields: any[],
    forecastSummary?: string
  ): Promise<Alert[]> => {
    try {
      const response = await tractorAPI.getAlerts({
        temperature: weather.temp,
        humidity: weather.humidity,
        wind_speed: weather.windSpeed,
        rain_accumulation: weather.precip,
        fields: fields.map(f => ({
          name: f.name,
          crop: f.cultura,
          lat: f.lat,
          lng: f.lng,
          boundaries: f.boundaries
        })),
        weather_forecast: forecastSummary
      });

      return response.alerts.map((a: any) => ({
        ...a,
        timestamp: a.createdAt ? new Date(a.createdAt).getTime() : Date.now(),
        dismissed: false
      }));
    } catch (error) {
      console.error('Erro ao buscar alertas da IA:', error);
      return [];
    }
  }
};
```

### `src/services/farm_service.ts`
```ts
import { apiFetch } from './api';
import type { Farm, Location } from '../store/useAppStore';

export const farmService = {
  getFarms: async (): Promise<Farm[]> => {
    const res = await apiFetch<{ farms: Farm[] }>('/api/farms');
    return res.farms;
  },

  getFields: async (farmId?: string): Promise<Location[]> => {
    const endpoint = farmId ? `/api/fields?farm_id=${farmId}` : '/api/fields';
    const res = await apiFetch<{ fields: Location[] }>(endpoint);
    return res.fields;
  },

  bootstrapFarm: async (): Promise<Farm> => {
    return apiFetch<Farm>('/api/farms/bootstrap', { method: 'POST' });
  },

  saveField: async (field: Location & { farm_id?: string }): Promise<Location> => {
    const method = field.id ? 'PUT' : 'POST';
    const endpoint = field.id ? `/api/fields/${field.id}` : '/api/fields';
    return apiFetch<Location>(endpoint, {
      method,
      body: JSON.stringify(field),
    });
  },

  deleteField: async (fieldId: string): Promise<boolean> => {
    const res = await apiFetch<{ success: boolean }>(`/api/fields/${fieldId}`, {
      method: 'DELETE',
    });
    return res.success;
  },
};
```

### `src/store/useAppStore.ts`
```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { farmService } from '../services/farm_service';
import { apiFetch } from '../services/api';

export interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

export interface Location {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  boundaries?: [number, number][];
  cultura?: string;
  dataPlantio?: string;
  variedade?: string;
  areaHa?: number;
  farm_id?: string;
}

export interface Farm {
  id: string;
  name: string;
  description?: string;
  fields: Location[];
}

export type MapLayer = 'satellite' | 'ndvi' | 'moisture';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  field?: string;
  value?: string;
  valueLabel?: string;
}

export interface WeatherCache {
  lat: number;
  lng: number;
  fetchedAt: number;
  temperature: number;
  windSpeed: number;
  humidity: number;
  weatherCode: number;
  daily: {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    precipSum: number[];
    et0: number[];
  };
  hourly: {
    time: string[];
    temp: number[];
    humidity: number[];
    precip: number[];
    windSpeed: number[];
    visibility: number[];
  };
}

interface AppState {
  farms: Farm[];
  savedLocations: Location[];
  chatHistory: { role: 'user' | 'model'; text: string }[];
  alerts: Alert[];
  weatherCache: WeatherCache | null;
  activeFarmId: string | null;
  activeFieldId: string | null;
  activeMapLayer: MapLayer;
  currentLocation: Location | null;
  isSyncing: boolean;
  syncError: string | null;
  entitlements: Entitlements | null;
  setFarms: (farms: Farm[]) => void;
  setActiveFarm: (id: string | null) => void;
  setActiveField: (id: string | null) => void;
  setMapLayer: (layer: MapLayer) => void;
  setCurrentLocation: (loc: Location | null) => void;
  addFarm: (farm: Farm) => void;
  createField: (farmId: string, field: Omit<Location, 'id'>) => Promise<void>;
  removeField: (farmId: string, fieldId: string) => Promise<void>;
  addField: (farmId: string, field: Location) => void;
  addMessage: (role: 'user' | 'model', text: string) => void;
  clearChat: () => void;
  setAlerts: (alerts: Alert[]) => void;
  dismissAlert: (id: string) => void;
  setWeatherCache: (cache: WeatherCache) => void;
  fetchEntitlements: () => Promise<void>;
  syncFromBackend: () => Promise<void>;
  resetStore: () => void;
}

const MAX_CHAT_HISTORY = 100;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      farms: [],
      savedLocations: [],
      chatHistory: [],
      alerts: [],
      weatherCache: null,
      activeFarmId: null,
      activeFieldId: null,
      activeMapLayer: 'satellite',
      currentLocation: null,
      isSyncing: false,
      syncError: null,
      entitlements: null,

      setFarms: (farms) => {
        set({
          farms,
          savedLocations: farms.flatMap((f) => f.fields || []),
        });
      },

      setActiveFarm: (id) =>
        set({
          activeFarmId: id,
          activeFieldId: null,
        }),

      setActiveField: (id) => set({ activeFieldId: id }),
      setMapLayer: (layer) => set({ activeMapLayer: layer }),
      setCurrentLocation: (loc) => set({ currentLocation: loc }),

      addFarm: (farm) =>
        set((state) => ({
          farms: [...state.farms, farm],
          activeFarmId: state.activeFarmId || farm.id,
        })),

      createField: async (farmId, fieldData) => {
        const state = get();
        if (state.entitlements && state.savedLocations.length >= state.entitlements.max_fields) {
          throw new Error(`Limite do plano atingido (${state.entitlements.max_fields} talhÃµes). FaÃ§a upgrade para adicionar mais.`);
        }
        try {
          const newField = await farmService.saveField({ ...fieldData, farm_id: farmId });
          set((state) => {
            const updatedFarms = state.farms.map((f) =>
              f.id === farmId ? { ...f, fields: [...(f.fields || []), newField] } : f
            );
            return {
              farms: updatedFarms,
              savedLocations: updatedFarms.flatMap((f) => f.fields || []),
            };
          });
        } catch (err) {
          console.error('[Store] Erro ao criar talhao:', err);
          throw err;
        }
      },

      removeField: async (farmId, fieldId) => {
        try {
          await farmService.deleteField(fieldId);
          set((state) => {
            const updatedFarms = state.farms.map((f) =>
              f.id === farmId
                ? { ...f, fields: (f.fields || []).filter((field) => field.id !== fieldId) }
                : f
            );
            return {
              farms: updatedFarms,
              savedLocations: updatedFarms.flatMap((f) => f.fields || []),
              activeFieldId: state.activeFieldId === fieldId ? null : state.activeFieldId,
            };
          });
        } catch (err) {
          console.error('[Store] Erro ao remover talhao:', err);
          throw err;
        }
      },

      addField: (farmId, field) =>
        set((state) => {
          const updatedFarms = state.farms.map((f) =>
            f.id === farmId ? { ...f, fields: [...(f.fields || []), field] } : f
          );
          return {
            farms: updatedFarms,
            savedLocations: updatedFarms.flatMap((f) => f.fields || []),
          };
        }),

      addMessage: (role, text) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, { role, text }].slice(-MAX_CHAT_HISTORY),
        })),

      clearChat: () => set({ chatHistory: [] }),
      setAlerts: (alerts) => set({ alerts }),

      dismissAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
        })),

      setWeatherCache: (cache) => set({ weatherCache: cache }),

      fetchEntitlements: async () => {
        try {
          const ent = await apiFetch<Entitlements>('/api/billing/entitlements');
          set({ entitlements: ent });
        } catch (e) {
          console.error('[Store] Erro ao buscar entitlements', e);
        }
      },

      syncFromBackend: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          get().fetchEntitlements();
          await farmService.bootstrapFarm();

          const [farms, fields] = await Promise.all([
            farmService.getFarms(),
            farmService.getFields(),
          ]);
          const hydratedFarms = farms.map((farm) => ({
            ...farm,
            fields: fields.filter((field) => field.farm_id === farm.id),
          }));

          const currentActiveId = get().activeFarmId;
          const firstFarmId = hydratedFarms.length > 0 ? hydratedFarms[0].id : null;

          set({
            farms: hydratedFarms,
            savedLocations: hydratedFarms.flatMap((f) => f.fields || []),
            activeFarmId:
              currentActiveId && hydratedFarms.find((f) => f.id === currentActiveId)
                ? currentActiveId
                : firstFarmId,
          });
        } catch (error) {
          console.error('[Store] Erro ao sincronizar:', error);
          set({ syncError: 'Ocorreu um erro ao carregar seus talhoes.' });
        } finally {
          set({ isSyncing: false });
        }
      },

      resetStore: () =>
        set({
          farms: [],
          savedLocations: [],
          chatHistory: [],
          alerts: [],
          weatherCache: null,
          activeFarmId: null,
          activeFieldId: null,
          currentLocation: null,
          syncError: null,
          isSyncing: false,
          entitlements: null,
        }),
    }),
    {
      name: 'tracto-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeFarmId: state.activeFarmId,
        activeFieldId: state.activeFieldId,
        activeMapLayer: state.activeMapLayer,
      }),
    }
  )
);

export default useAppStore;
```

## Backend (FastAPI)

### `tracto-backend/main.py`
```python
import json
import logging
import os
from datetime import datetime

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import uuid

from models import (
    AlertRequest,
    ChatRequest,
    FieldAnalysisRequest,
    FieldAnalysisResponse,
    RecaptchaRequest,
    SaveConversationRequest,
    FarmBase,
    FarmCreate,
    FarmUpdate,
    FieldBase,
    FieldCreate,
    FieldUpdate,
    CheckoutRequest,
    PushSubscriptionCreate,
    WhatsAppWebhookPayload,
)
from services import supabase_service, farm_service
from services.billing_service import billing_service
from services.ai_service import MODEL, _get_client, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
from services.auth_service import AuthenticatedUser, get_unverified_user_id_from_header, get_current_user
from services.cache_service import analysis_cache
from services.sentinel_service import get_ndvi_image
from services.weather_service import extract_weather_snapshot, fetch_weather_snapshot
from services.agronomic_engine import AgronomicEngine

load_dotenv()

# --- Security & Rate Limiting ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Tracto API", description="O motor da plataforma Tracto", version="2.2.1")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Structured Logging Middleware ---
@app.middleware("http")
async def structured_log_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    unverified_uid = get_unverified_user_id_from_header(request.headers.get("Authorization")) or "anonymous"
    response = await call_next(request)
    duration = time.time() - start_time
    log_data = {
        "request_id": request_id,
        "context_user_id": unverified_uid,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": int(duration * 1000),
        "timestamp": datetime.now().isoformat(),
        "ip": get_remote_address(request)
    }
    logging.info(json.dumps(log_data))
    response.headers["X-Request-ID"] = request_id
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "Tracto backend online", "version": "2.2.1"}

# --- Commercial & Entitlements ---

@app.get("/api/billing/entitlements")
async def get_entitlements(user: AuthenticatedUser = Depends(get_current_user)):
    return billing_service.get_entitlements(user.id)

@app.post("/api/fields")
async def save_field_endpoint(request: FieldCreate, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        if not billing_service.check_field_limit(user.id):
            raise HTTPException(
                status_code=403, 
                detail="Limite do plano excedido. O Plano Gratuito permite apenas 1 talhao."
            )
        return farm_service.save_field(user.id, request.model_dump())
    except HTTPException:
        raise
    except Exception as exc:
        if "Plan limit exceeded" in str(exc):
             raise HTTPException(status_code=403, detail="Limite do plano excedido (Bloqueio DB).")
        raise HTTPException(status_code=500, detail="Erro ao salvar talhao.") from exc

@app.post("/api/push/subscribe")
async def push_subscribe(req: PushSubscriptionCreate, user: AuthenticatedUser = Depends(get_current_user)):
    billing_service.supabase.table("push_subscriptions").upsert({
        "user_id": user.id,
        "endpoint": req.endpoint,
        "p256dh": req.p256dh,
        "auth": req.auth
    }).execute()
    return {"status": "ok"}

@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    form_data = await request.form()
    phone = form_data.get("From", "")
    body = form_data.get("Body", "")
    if not phone: return {"status": "ignored"}
    contact_res = billing_service.supabase.table("whatsapp_contacts").select("user_id").eq("phone_number", phone).execute()
    if not contact_res.data: return {"status": "ok"}
    user_id = contact_res.data[0]["user_id"]
    try:
        reply = generate_chat_response(message=body, context=f"Origem WhatsApp. User: {user_id}", history=[])
    except: reply = "Erro na Tracto AI"
    print(f"[WHATSAPP OUT] Para: {phone} | Msg: {reply}")
    return {"status": "ok"}

# --- Core Agronomic Endpoints ---

@app.post("/api/analyze-field", response_model=FieldAnalysisResponse)
@limiter.limit("3/minute")
async def analyze_field_endpoint(request: FieldAnalysisRequest, _request: Request, _user: AuthenticatedUser = Depends(get_current_user)):
    cache_key = f"{request.lat:.4f}_{request.lng:.4f}_{request.crop_type}_{datetime.now().strftime('%Y%m%d')}"
    cached_result = analysis_cache.get(cache_key)
    if cached_result:
        cached_result["cached"] = True
        return FieldAnalysisResponse(**cached_result)

    weather_data = await fetch_weather_snapshot(request.lat, request.lng)
    sentinel_data = get_ndvi_image(request.lat, request.lng, request.boundaries)

    engine = AgronomicEngine()
    engine_results = {
        "spray_window": engine.calculate_spray_window(weather_data["temperature"], weather_data["humidity"], weather_data["wind_speed"]),
        "frost_risk": engine.calculate_frost_risk(weather_data["temperature"], request.crop_type),
        "water_stress": engine.calculate_water_stress(weather_data["rain_accumulation"], weather_data["temperature"], request.crop_type, weather_data.get("et0")),
        "confidence": engine.calculate_confidence(sentinel_data is not None, True, request.boundaries is not None)
    }

    ndvi_analysis = analyze_ndvi_image(
        image_base64=sentinel_data["image_base64"] if sentinel_data else "",
        field_name=request.field_name,
        crop_type=request.crop_type,
        weather_context=str(weather_data),
        engine_results=engine_results
    ) if sentinel_data else None

    # Partial mock for alerts/report generation
    alerts = generate_alerts_claude(request, {request.field_name: ndvi_analysis} if ndvi_analysis else {})
    
    result = {
        "field_name": request.field_name,
        "ndvi_image_base64": sentinel_data["image_base64"] if sentinel_data else None,
        "ndvi_analysis": ndvi_analysis or {},
        "weather_summary": str(weather_data),
        "ai_report": "Relatorio agronomico detalhado gerado pela Claude.",
        "alerts": alerts,
        "analyzed_at": datetime.now().isoformat(),
        "cached": False,
        "confidence": engine_results["confidence"],
        "engine_results": engine_results
    }
    analysis_cache.set(cache_key, result)
    return FieldAnalysisResponse(**result)
```

### `tracto-backend/services/auth_service.py`
```python
import logging
import os
import json
import base64
from dataclasses import dataclass
import requests
from fastapi import Header, HTTPException, status

@dataclass
class AuthenticatedUser:
    id: str
    email: str | None = None

def get_unverified_user_id_from_header(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "): return None
    try:
        token = authorization.split(" ")[1]
        parts = token.split(".")
        if len(parts) != 3: return None
        payload_b64 = parts[1]
        missing_padding = len(payload_b64) % 4
        if missing_padding: payload_b64 += "=" * (4 - missing_padding)
        payload = json.loads(base64.b64decode(payload_b64).decode("utf-8"))
        return payload.get("sub")
    except: return None

def verify_access_token(access_token: str) -> AuthenticatedUser:
    url = os.getenv("SUPABASE_URL").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    try:
        response = requests.get(f"{url}/auth/v1/user", headers={"apikey": key, "Authorization": f"Bearer {access_token}"}, timeout=10)
        response.raise_for_status()
        u = response.json()
        return AuthenticatedUser(id=u["id"], email=u.get("email"))
    except: raise HTTPException(status_code=401, detail="Sessao invalida")

def get_current_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    if not authorization: raise HTTPException(status_code=401)
    token = authorization.partition(" ")[2].strip()
    return verify_access_token(token)
```

### `tracto-backend/services/billing_service.py`
```python
import os
from supabase import create_client, Client

class BillingService:
    def __init__(self):
        self.supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    def get_user_plan(self, user_id: str) -> dict:
        result = self.supabase.table("subscriptions").select("plan_id, status").eq("user_id", user_id).execute()
        if not result.data: return {"plan_id": "free", "status": "active"}
        return result.data[0]

    def get_entitlements(self, user_id: str) -> dict:
        plan = self.get_user_plan(user_id).get("plan_id", "free")
        if plan == "pro": return {"max_fields": 9999, "can_use_whatsapp": True, "can_use_push": True}
        return {"max_fields": 1, "can_use_whatsapp": False, "can_use_push": False}

    def check_field_limit(self, user_id: str) -> bool:
        limit = self.get_entitlements(user_id)["max_fields"]
        count = self.supabase.table("fields").select("id", count="exact").eq("user_id", user_id).execute().count
        return (count or 0) < limit

billing_service = BillingService()
```

### `tracto-backend/services/agronomic_engine.py`
```python
import logging
from typing import Any, Dict

class AgronomicEngine:
    @staticmethod
    def calculate_spray_window(temp: float, humidity: float, wind_speed: float) -> Dict[str, Any]:
        score = 100
        reasons = []
        if wind_speed > 20: score -= 60; reasons.append("Vento muito forte: alto risco de deriva.")
        elif wind_speed < 3: score -= 20; reasons.append("Vento muito calmo: risco de inversÃ£o tÃ©rmica.")
        if humidity < 40: score -= 40; reasons.append("Umidade muito baixa: gotas evaporam.")
        if temp > 32: score -= 40; reasons.append("Temperatura muito alta: risco de fitotoxicidade.")
        
        status = "safe" if score >= 80 else "caution" if score >= 50 else "unsafe"
        return {
            "status": status,
            "score": max(0, score),
            "reasons": reasons,
            "label": "Seguro" if status == "safe" else "AtenÃ§Ã£o" if status == "caution" else "Inadequado"
        }

    @staticmethod
    def calculate_frost_risk(temp_min: float, crop_type: str) -> Dict[str, Any]:
        risk = "none"
        if temp_min <= 0: risk = "high"
        elif temp_min <= 3: risk = "medium"
        elif temp_min <= 5: risk = "low"
        return {"risk": risk, "label": risk.capitalize()}

    @staticmethod
    def calculate_water_stress(precip_sum: float, temp_avg: float, crop_type: str, et0: float | None = None) -> Dict[str, Any]:
        weekly_et0 = et0 if et0 else (temp_avg * 0.15 + 1.0) * 7
        balance = precip_sum - weekly_et0
        status = "critical" if balance < -20 else "moderate" if balance < -10 else "adequate"
        return {"status": status, "balance_mm": round(balance, 1), "label": status.capitalize()}

    @staticmethod
    def calculate_confidence(sat: bool, weather: bool, poly: bool) -> float:
        score = (0.4 if sat else 0) + (0.3 if weather else 0) + (0.3 if poly else 0)
        return round(score, 2)
```

## Database Schema (Commercial Hardening)

### `tracto-backend/sql/02_commercial.sql`
```sql
-- 1. Billing and Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'incomplete',
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_user_subscription ON subscriptions (user_id);

-- 2. Entitlements Enforcement Trigger
CREATE OR REPLACE FUNCTION check_field_entitlement()
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    field_count INT;
BEGIN
    SELECT plan_id INTO user_plan FROM subscriptions WHERE user_id = NEW.user_id AND status IN ('active', 'trialing') LIMIT 1;
    IF user_plan IS NULL THEN user_plan := 'free'; END IF;
    IF user_plan = 'free' THEN
        SELECT count(*) INTO field_count FROM fields WHERE user_id = NEW.user_id;
        IF field_count >= 1 THEN
            RAISE EXCEPTION 'Plan limit exceeded. Free tier is limited to 1 field. Please upgrade your plan.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_field_entitlement BEFORE INSERT ON fields FOR EACH ROW EXECUTE PROCEDURE check_field_entitlement();
