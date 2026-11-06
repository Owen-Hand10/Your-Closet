# Your Closet

A local-first wardrobe app for cataloging the clothes you already own and making outfits from them. Its dark, high-contrast fashion-editorial theme gives clothing photography room to lead. Built with React and Vite.

## Run locally

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build, run `npm run build` and then `npm run preview`.

## What works

- Add clothing photos and record type, color, season, occasion, and notes. Edit, search, filter, sort, and remove closet items.
- Compare the original upload with an exact live crop preview. Zoom and position sliders update the frame immediately; confirming the item saves that same crop.
- Remove the background with `@imgly/background-removal`, an in-browser segmentation model. The result is shown over a transparency grid and saved as alpha-capable WebP or PNG, never JPEG. The original upload remains available to compare, retry, or keep instead.
- Select specific closet pieces, arrange them in an outfit preview, and save looks with an optional name and notes. Reopen or delete a saved look with confirmation.
- Closet items and saved looks are separate collections. They persist in this browser using localStorage; photos are resized and compressed before saving.

## Background-removal requirements

No API key or image upload service is used. On the first removal, the browser downloads the quantized model (about 40 MB) and ONNX/WASM runtime assets from IMG.LY; the image itself is processed locally. A connection to those assets is needed until the browser has cached them. Processing speed and results vary by device and photo; failures are shown in the editor and leave the original intact. The browser-side provider is isolated in `src/services/backgroundRemoval.js` so it can be replaced without changing closet or outfit data.

`@imgly/background-removal` is licensed under AGPL-3.0. Review its terms against your distribution and deployment before publishing; use a separately licensed provider behind the adapter if those terms are not appropriate.

## Data and future integrations

There is no server or account in this version. Data stays in the current browser and is not synced or backed up. Clearing site data removes it, and browser storage limits mean this is not a substitute for cloud photo storage. `src/data/store.js` is the persistence boundary to replace with an authenticated API later. The optional profile preferences shape (sizing, fit preferences, region, currency, and budget) remains separate; no profile or body information is collected by this MVP.

AI outfit suggestions are not connected. Accounts and cross-device closet storage would need an authentication provider and a backend with private object storage. Shopping is intentionally not part of this app; a future shopping feature should be a separate module and only display verified store data, not invented listings or prices.
