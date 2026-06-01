import { parseUnits, zeroAddress } from "viem";

export const agentVaultAddress = process.env.NEXT_PUBLIC_AGENTVAULT_ADDRESS as
  | `0x${string}`
  | undefined;
export const agentVaultSepoliaAddress = (
  process.env.NEXT_PUBLIC_AGENTVAULT_SEPOLIA_ADDRESS ||
  process.env.NEXT_PUBLIC_AGENTVAULT_ADDRESS
) as `0x${string}` | undefined;
export const agentVaultArbitrumOneAddress = process.env
  .NEXT_PUBLIC_AGENTVAULT_ARBITRUM_ONE_ADDRESS as `0x${string}` | undefined;

export function getAgentVaultAddress(chainId?: number) {
  if (chainId === 421614) return agentVaultSepoliaAddress;
  if (chainId === 42161) return agentVaultArbitrumOneAddress;
  return undefined;
}

export function getAgentVaultEventStartBlock(chainId?: number) {
  const raw =
    chainId === 42161
      ? process.env.NEXT_PUBLIC_AGENTVAULT_ARBITRUM_ONE_EVENT_START_BLOCK
      : process.env.NEXT_PUBLIC_AGENTVAULT_SEPOLIA_EVENT_START_BLOCK ||
        process.env.NEXT_PUBLIC_AGENTVAULT_EVENT_START_BLOCK;

  if (!raw) return undefined;

  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

export const demoRecipient = "0x1111111111111111111111111111111111111111" as const;

export const demoAction = {
  token: zeroAddress,
  recipient: demoRecipient,
  amount: parseUnits("250", 0),
  actionType: "PAY_INVOICE",
  reason: "Pay CloudHost invoice after recipient allowlist policy passes.",
} as const;

export const agentVaultAbi = [
  {
    type: "event",
    name: "AgentUpdated",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RecipientUpdated",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyUpdated",
    inputs: [
      { name: "dailySpendLimit", type: "uint256", indexed: false },
      { name: "approvalThreshold", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActionProposed",
    inputs: [
      { name: "actionId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActionApproved",
    inputs: [{ name: "actionId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "ActionExecuted",
    inputs: [{ name: "actionId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "ActionBlocked",
    inputs: [
      { name: "actionId", type: "uint256", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ActionRejected",
    inputs: [{ name: "actionId", type: "uint256", indexed: true }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "dailySpendLimit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approvalThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "spentToday",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "actionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approvedAgents",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approvedRecipients",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "actions",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "actionType", type: "string" },
      { name: "reason", type: "string" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "setAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setRecipient",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "proposeAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "actionType", type: "string" },
      { name: "reason", type: "string" },
    ],
    outputs: [{ name: "actionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "approveAction",
    stateMutability: "nonpayable",
    inputs: [{ name: "actionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "rejectAction",
    stateMutability: "nonpayable",
    inputs: [{ name: "actionId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "executeAction",
    stateMutability: "nonpayable",
    inputs: [{ name: "actionId", type: "uint256" }],
    outputs: [],
  },
] as const;
