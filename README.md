# bauta · app

The public landing for **Bauta**, the privacy engine for apps & AI agents.
Deployed at [bautawallet.com](https://bautawallet.com).

> **Status: repurposed, work in progress.**
> This repo used to be a stealth-payments web app. It is being turned into the
> showcase site for the [Bauta SDK](https://github.com/bauta-labs/sdk).
> Right now it is a single landing page, nothing more.

## What it is (today)

- `/` renders the landing (`src/Landing.tsx`), "Built on Ethereum's Kohaku".
- Every other path redirects back to `/`.

The landing is the whole product surface for now.

## Where things live

- **SDK + docs:** the sibling repo [`bauta-labs/sdk`](https://github.com/bauta-labs/sdk).
- **This repo (`app`):** just the landing / showcase.
- The `bautawallet.com` domain keeps the word "wallet". That gets reconciled
  later by shipping a small demo / PoC here that runs on the Bauta SDK.

## Tech stack

- React 19 + TypeScript + Vite, React Router
- Viem + Wagmi
- `@vercel/analytics`

## Dev

Plain Vite app, so `dev` is fine here.

```bash
bun install
bun run dev       # http://localhost:5173
bun run build
```

## License

MIT
