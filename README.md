1. Istotne źródła:

- [https://nextjs.org/docs](https://nextjs.org/docs)
- [https://www.pexels.com/](https://www.pexels.com/)
-

2. Środowisko

- Node24
- npm 11.9
- Next.js 16.3.8

3. Źródła grafik

- cpu.webp - Pixabay Creative Commons Zero, Serwis Pexels
- gpu.webp - Andrey Matveev Creative Commons Zero, Serwis Pexels
- ram.webp - Willaim Warby Creative Commons Zero, Serwis Pexels
- disk.webp - Andrey Matveev Creative Commons Zero, Serwis Pexels

4. Sposób uruchamiania

```
npm run dev

```

5. Wyniki lintera, testów i buildu

```
╰─❯ npm ci && npm run lint && npm run test && npm run build && npm run start
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 378 packages, and audited 379 packages in 6s

151 packages are looking for funding
  run `npm fund` for details

5 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

> computer-shop-2026km@0.1.0 lint
> eslint


> computer-shop-2026km@0.1.0 test
> vitest run

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.3 /Users/imob07/Desktop/Students/MirochaKacper/Sem7 /Lab06/computer-shop-2026km

 ✓ tests/lib/product-validation.test.ts (5 tests) 5ms
 ✓ tests/lib/product-repository.test.ts (6 tests) 11ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  14:38:06
   Duration  164ms (import 41%, transform 36%, tests 10%, setup 8%, worker 4%)


> computer-shop-2026km@0.1.0 build
> next build

▲ Next.js 16.3.8 (Turbopack)
✓ Running next.config.ts took 708ms

  Creating an optimized production build ...
✓ Compiled successfully in 333ms
✓ Finished TypeScript in 773ms
✓ Collecting page data using 7 workers in 409ms
✓ Generating static pages using 7 workers (8/8) in 166ms
✓ Finalizing page optimization in 7ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /basket
├ ○ /order-history
└ ○ /product-list


○  (Static)  prerendered as static content


> computer-shop-2026km@0.1.0 start
> next start

▲ Next.js 16.3.8
- Local:         http://localhost:3000
- Network:       http://192.168.50.193:3000
✓ Ready in 78ms
✓ Running next.config.ts took 22ms
```

6.

- czym różnią się page.tsx i layout.tsx?
- Czy do publicznej strony potrzeba osobnego layoutu?
- Co w nawigacji przez Link pozostaje wspólne?

- Layout definiuje wspólny uklad elementow na stronie, a page content ktory ta strona bedzie zawierala.
- publiczna strona nie potrzebuje osobnego layoutu, wystarczy root
- Podczas nawigacji przez wspólny layout, komponent zawierajacy Link nie zostaje rerenderowany, tylko sam page content

7.

- gdzie wykonuje się funkcja repozytorium?
- Jakie dane trafiają do przeglądarki?
- Dlaczego import całego JSON do komponentu klienta zmienia architekturę?
- Czy use client wyklucza początkowe renderowanie HTML na serwerze?

- Funkcja wykonuje na serwerze Next.js
- Do przegladarki trafia gotowy html oraz payload rsc z wyświetlanymi danymi produktów
- import calego jsona sprawiłby dołączenie go do bundla js wysyłanego do przeglądarki, filtracja i sortowanie działyby się w przeglądarce, blokuje to dyrektywa "server-only"
- nie wyklucza wstepnego renderwowania na serwerze, dalej moze wystepowac hydracja.
