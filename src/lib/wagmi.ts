import { createConfig, fallback, http } from "wagmi";
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  gnosis,
  ink,
  sepolia,
} from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { RPC_FALLBACKS } from "./chains";

const t = (chainId: number) =>
  fallback((RPC_FALLBACKS[chainId] ?? []).map(u => http(u)), { rank: false });

export const config = createConfig({
  chains: [mainnet, arbitrum, base, optimism, polygon, gnosis, ink, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]:  t(mainnet.id),
    [arbitrum.id]: t(arbitrum.id),
    [base.id]:     t(base.id),
    [optimism.id]: t(optimism.id),
    [polygon.id]:  t(polygon.id),
    [gnosis.id]:   t(gnosis.id),
    [ink.id]:      t(ink.id),
    [sepolia.id]:  t(sepolia.id),
  },
});
