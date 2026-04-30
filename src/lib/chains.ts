import { createPublicClient, http, fallback } from "viem";
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  gnosis,
  ink,
  sepolia,
} from "viem/chains";
import type { Chain } from "viem";

export interface ChainConfig {
  chain: Chain;
  label: string;
  explorer: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  { chain: mainnet, label: "Ethereum", explorer: "https://etherscan.io" },
  { chain: arbitrum, label: "Arbitrum", explorer: "https://arbiscan.io" },
  { chain: base, label: "Base", explorer: "https://basescan.io" },
  {
    chain: optimism,
    label: "Optimism",
    explorer: "https://optimistic.etherscan.io",
  },
  { chain: polygon, label: "Polygon", explorer: "https://polygonscan.com" },
  { chain: gnosis, label: "Gnosis", explorer: "https://gnosisscan.io" },
  { chain: ink, label: "Ink", explorer: "https://explorer.inkonchain.com" },
  {
    chain: sepolia,
    label: "Sepolia",
    explorer: "https://sepolia.etherscan.io",
  },
];

export const RPC_FALLBACKS: Record<number, string[]> = {
  [mainnet.id]: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://eth.meowrpc.com",
    "https://eth.rpc.blxrbdn.com",
    "https://eth-mainnet.rpcfast.com?api_key=xbhWBI1Wkguk8SNMu1bvvLurPGLXmgwYeC4S6g2H7WdwFigZSmPWVZRxrskEQwIf",
  ],
  [arbitrum.id]: [
    "https://arb1.arbitrum.io/rpc",
    "https://1rpc.io/arb",
    "https://arb-one.api.pocket.network",
    "https://arbitrum.api.onfinality.io/public",
    "https://arbitrum-one.public.blastapi.io",
    "https://rpc.ankr.com/arbitrum",
  ],
  [base.id]: [
    "https://1rpc.io/base",
    "https://mainnet.base.org",
    "https://rpc.ankr.com/base",
    "https://base.llamarpc.com",
    "https://base.meowrpc.com",
    "https://base.api.pocket.network",
  ],
  [optimism.id]: [
    "https://optimism.drpc.org",
    "https://mainnet.optimism.io",
    "https://rpc.ankr.com/optimism",
  ],
  [polygon.id]: [
    "https://1rpc.io/matic",
    "https://polygon-public.nodies.app",
    "https://poly.api.pocket.network",
    "https://polygon.drpc.org",
    "https://polygon-public.nodies.app",
    "https://rpc.ankr.com/polygon",
  ],
  [gnosis.id]: [
    "https://1rpc.io/gnosis",
    "https://rpc.gnosischain.com",
    "https://gnosis-public.nodies.app",
    "https://gnosis.api.pocket.network",
    "https://gno-mainnet.gateway.tatum.io",
    "https://rpc.ankr.com/gnosis",
  ],
  [ink.id]: [
    "https://ink.drpc.org",
    "https://rpc-gel.inkonchain.com",
    "https://rpc.inkonchain.com",
  ],
  [sepolia.id]: [
    "https://0xrpc.io/sep",
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.drpc.org",
    // "https://rpc.sepolia.org",
  ],
};

export const publicClients = Object.fromEntries(
  SUPPORTED_CHAINS.map(({ chain }) => [
    chain.id,
    createPublicClient({
      chain,
      transport: fallback(
        (RPC_FALLBACKS[chain.id] ?? []).map((url) => http(url)),
        { rank: false },
      ),
    }),
  ]),
);
