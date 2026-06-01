import { defineChain } from "viem";

export const arbitrumSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
  "https://api.zan.top/arb-sepolia";
export const arbitrumOneRpcUrl =
  process.env.NEXT_PUBLIC_ARBITRUM_ONE_RPC_URL ||
  "https://arb1.arbitrum.io/rpc";

export const agentVaultArbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Arbitrum Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [arbitrumSepoliaRpcUrl],
    },
    public: {
      http: [arbitrumSepoliaRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan Sepolia",
      url: "https://sepolia.arbiscan.io",
    },
  },
  testnet: true,
});

export const agentVaultArbitrumOne = defineChain({
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [arbitrumOneRpcUrl],
    },
    public: {
      http: [arbitrumOneRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://arbiscan.io",
    },
  },
});

export const supportedAgentVaultChains = [
  agentVaultArbitrumSepolia,
  agentVaultArbitrumOne,
] as const;

export function getSupportedAgentVaultChain(chainId?: number) {
  return supportedAgentVaultChains.find((chain) => chain.id === chainId);
}
