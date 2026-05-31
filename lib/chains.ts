import { defineChain } from "viem";

export const arbitrumSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
  "https://api.zan.top/arb-sepolia";

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
