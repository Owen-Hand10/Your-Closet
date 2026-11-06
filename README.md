# Your Closet

A small, local-first wardrobe app for cataloging the clothes you already own and making outfits from them. Built with React and Vite to keep the first version straightforward to run and extend.

## Run locally

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To create and preview a production build, run `npm run build` and then `npm run preview`.

## What works

- Add clothing photos and record type, color, season, occasion, and notes. Edit, search, filter, sort, and remove closet items.
- Compare the original upload with a crop preview. The crop controls create a real cropped image in the browser; background removal is not connected.
- Select specific closet pieces, arrange them in an outfit preview, and save looks with an optional name and notes. Reopen or delete a saved look with confirmation.
- Closet items and saved looks are separate collections. They persist in this browser using localStorage; uploaded images are resized and compressed before saving.

## Prototype limits and next integrations

There is no server or account in this version. Data stays in the current browser and is not synced or backed up. Clearing site data removes it, and browser storage limits mean this is not a substitute for cloud photo storage. `src/data/store.js` is the persistence boundary to replace with an authenticated API later. The optional profile preferences shape (sizing, fit preferences, region, currency, and budget) is defined separately in that module; no profile or body information is collected by this MVP.

The image-cleanup interface is an honest crop-only prototype. Real background removal would need an image segmentation service or an on-device segmentation model. AI outfit suggestions would need a separately integrated recommendation service; none are generated in this version. Accounts and cross-device closet storage would need an authentication provider and a backend with private object storage. Shopping is intentionally not part of this app; a future shopping feature should be a separate module and only display verified store data, not invented listings or prices.
