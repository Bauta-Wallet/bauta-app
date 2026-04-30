# bauta.wallet

Privacy-first stealth payments. Make the trace meaningless.

Live at [bautawallet.com](https://bautawallet.com) *(coming soon)*

## What it is

Web app for sending ETH privately using stealth addresses — ERC-5564 + ERC-6538.

- `/` — landing page
- `/lookup` — stealth address lookup & send

Supports Classic (secp256k1) and Post-Quantum (ML-KEM-768) schemes across 8 EVM chains.

## Without wallet mode

Send from any wallet — a relay handles the on-chain announce. The relay is configurable: use the official one or [run your own](https://github.com/ivanmmurciaua/bauta-wallet).

## Tech stack

- React 19 + TypeScript + Vite
- Viem + Wagmi + React Router
- @noble/secp256k1, @noble/post-quantum, @noble/hashes

## Dev

```bash
bun install
bun run dev       # http://localhost:5173
bun run build
```

## Environment variables

```bash
VITE_RELAY_URL    # URL of bauta-relay instance (default: official relay)
```

## Related

- [bauta-wallet](https://github.com/Bauta-Wallet/bauta-wallet) — self-host service (stealth wallet + watcher + relay + RAILGUN)
- [bauta-lookup-ipfs](https://codeberg.org/ivanmmurcia/bauta-lookup) — IPFS version (no relay, fully decentralized)

## License

MIT
