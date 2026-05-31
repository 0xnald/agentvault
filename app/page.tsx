"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import { formatUnits } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import {
  agentVaultAbi,
  agentVaultAddress,
  demoAction,
  demoRecipient,
} from "../lib/agentVault";

type ActionTone = "approved" | "blocked" | "pending";

type ActionCard = {
  icon: LucideIcon;
  tone: ActionTone;
  type: string;
  title: string;
  body: string;
  amount: string;
  status: string;
  primary: string;
  secondary?: string;
};

type Metric = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

const actionCards: ActionCard[] = [
  {
    icon: FileCheck2,
    tone: "approved",
    type: "Pay Invoice",
    title: "CloudHost invoice due today",
    body: "The finance agent recommends paying an approved vendor while preserving runway.",
    amount: "$250 USDC",
    status: "Policy passed",
    primary: "Approve",
    secondary: "Reject",
  },
  {
    icon: ShieldAlert,
    tone: "blocked",
    type: "Transfer Request",
    title: "Unknown recipient requested $2,000",
    body: "AgentVault blocked this action because the recipient is not allowlisted.",
    amount: "$2,000 USDC",
    status: "Blocked",
    primary: "Review",
  },
  {
    icon: Clock3,
    tone: "pending",
    type: "Reserve Runway",
    title: "Move excess cash to reserve vault",
    body: "The agent recommends protecting 30% of current balance for payroll and infrastructure commitments.",
    amount: "$1,500 USDC",
    status: "Needs approval",
    primary: "Approve",
    secondary: "Edit",
  },
];

const policies = [
  ["Auto-block unknown wallets", "On"],
  ["Minimum runway reserve", "6 months"],
];

const metrics: Metric[] = [
  {
    label: "Vault Balance",
    value: "$18,420",
    hint: "USDC on Arbitrum",
    icon: WalletCards,
  },
  {
    label: "Runway",
    value: "7.8 months",
    hint: "Target reserve protected",
    icon: Gauge,
  },
  {
    label: "Daily Limit",
    value: "$750",
    hint: "$250 used today",
    icon: LockKeyhole,
  },
  {
    label: "Policy Blocks",
    value: "2",
    hint: "Prevented this week",
    icon: ShieldCheck,
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  const isArbitrumSepolia = chainId === arbitrumSepolia.id;
  const hasContract = Boolean(agentVaultAddress);
  const canUseVault = isConnected && isArbitrumSepolia && hasContract;

  const contractQuery = {
    address: agentVaultAddress,
    abi: agentVaultAbi,
    query: { enabled: hasContract },
  } as const;

  const { data: owner } = useReadContract({
    ...contractQuery,
    functionName: "owner",
  });
  const { data: dailySpendLimit } = useReadContract({
    ...contractQuery,
    functionName: "dailySpendLimit",
  });
  const { data: approvalThreshold } = useReadContract({
    ...contractQuery,
    functionName: "approvalThreshold",
  });
  const { data: spentToday } = useReadContract({
    ...contractQuery,
    functionName: "spentToday",
  });
  const { data: actionCount } = useReadContract({
    ...contractQuery,
    functionName: "actionCount",
  });
  const { data: isApprovedAgent } = useReadContract({
    ...contractQuery,
    functionName: "approvedAgents",
    args: address ? [address] : undefined,
    query: { enabled: hasContract && Boolean(address) },
  });
  const { data: isDemoRecipientApproved } = useReadContract({
    ...contractQuery,
    functionName: "approvedRecipients",
    args: [demoRecipient],
  });

  const connectedOwner =
    owner && address ? owner.toLowerCase() === address.toLowerCase() : false;
  const latestActionId =
    typeof actionCount === "bigint" && actionCount > 0n ? actionCount - 1n : undefined;

  const onchainMetrics: Metric[] = [
    {
      label: "Vault Contract",
      value: hasContract ? "Connected" : "Not deployed",
      hint: hasContract ? shortAddress(agentVaultAddress) : "Set NEXT_PUBLIC_AGENTVAULT_ADDRESS",
      icon: WalletCards,
    },
    {
      label: "Actions",
      value: actionCount?.toString() ?? "0",
      hint: "Proposed onchain",
      icon: Gauge,
    },
    {
      label: "Daily Limit",
      value: formatPolicyAmount(dailySpendLimit),
      hint: `${formatPolicyAmount(spentToday)} used today`,
      icon: LockKeyhole,
    },
    {
      label: "Policy Blocks",
      value: isDemoRecipientApproved ? "Ready" : "Strict",
      hint: isDemoRecipientApproved ? "Demo recipient allowlisted" : "Unknown wallets blocked",
      icon: ShieldCheck,
    },
  ];

  const setSelfAsAgent = () => {
    if (!agentVaultAddress || !address) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "setAgent",
      args: [address, true],
    });
  };

  const allowDemoRecipient = (approved: boolean) => {
    if (!agentVaultAddress) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "setRecipient",
      args: [demoRecipient, approved],
    });
  };

  const proposeDemoAction = () => {
    if (!agentVaultAddress) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "proposeAction",
      args: [
        demoAction.token,
        demoAction.recipient,
        demoAction.amount,
        demoAction.actionType,
        demoAction.reason,
      ],
    });
  };

  const approveAction = (actionId: bigint) => {
    if (!agentVaultAddress) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "approveAction",
      args: [actionId],
    });
  };

  const rejectAction = (actionId: bigint) => {
    if (!agentVaultAddress) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "rejectAction",
      args: [actionId],
    });
  };

  const executeAction = (actionId: bigint) => {
    if (!agentVaultAddress) return;
    writeContract({
      address: agentVaultAddress,
      abi: agentVaultAbi,
      functionName: "executeAction",
      args: [actionId],
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AgentVault home">
          <Image src="/agentvault-logo.svg" alt="" width={44} height={44} priority />
          <span>AgentVault</span>
        </a>

        <nav className="nav-list" aria-label="Primary">
          <a className="active" href="#">Command</a>
          <a href="#">Vault</a>
          <a href="#">Policies</a>
          <a href="#">Agents</a>
          <a href="#">Audit</a>
        </nav>

        <div className={`network-pill ${isArbitrumSepolia ? "online" : "warning"}`}>
          <span className="status-dot" />
          {isArbitrumSepolia ? "Arbitrum Sepolia" : "Wrong network"}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI treasury control layer</p>
            <h1>Safe execution for agent-run operations.</h1>
          </div>
          <div className="wallet-area">
            <ConnectButton />
            {isConnected && !isArbitrumSepolia ? (
              <button
                className="switch-button"
                type="button"
                onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
              >
                Switch to Arbitrum
              </button>
            ) : null}
          </div>
        </header>

        <section className="metrics-grid" aria-label="Vault metrics">
          {onchainMetrics.map(({ label, value, hint, icon: Icon }) => (
            <article className="metric" key={label}>
              <div className="metric-icon">
                <Icon size={18} />
              </div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <div className="action-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Onchain queue</p>
                <h2>Contract Actions</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={!connectedOwner || !address || isPending || isConfirming}
                onClick={setSelfAsAgent}
              >
                <ShieldCheck size={17} />
                Approve Wallet As Agent
              </button>
            </div>

            <div className="contract-banner">
              <strong>{hasContract ? "Vault address loaded" : "Deploy required"}</strong>
              <span>
                {hasContract
                  ? `Owner ${owner ? shortAddress(owner) : "loading"} controls policy.`
                  : "Deploy AgentVault and set NEXT_PUBLIC_AGENTVAULT_ADDRESS before sending transactions."}
              </span>
            </div>

            {actionCards.map((action) => {
              const Icon = action.icon;
              return (
                <article className={`action ${action.tone}`} key={action.title}>
                  <div className="action-icon">
                    <Icon size={20} />
                  </div>
                  <div className="action-main">
                    <span className="action-type">{action.type}</span>
                    <h3>{action.title}</h3>
                    <p>{action.body}</p>
                  </div>
                  <div className="action-meta">
                    <strong>{action.amount}</strong>
                    <span>{action.status}</span>
                  </div>
                  <div className="action-controls">
                    <button
                      type="button"
                      disabled={!canUseVault || isPending || isConfirming}
                      onClick={() => {
                        if (action.type === "Pay Invoice") {
                          proposeDemoAction();
                          return;
                        }

                        if (action.type === "Transfer Request") {
                          allowDemoRecipient(false);
                          return;
                        }

                        if (latestActionId !== undefined) {
                          approveAction(latestActionId);
                        }
                      }}
                    >
                      {action.type === "Pay Invoice" ? "Propose Onchain" : action.primary}
                    </button>
                    {action.secondary ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={!canUseVault || latestActionId === undefined || isPending || isConfirming}
                        onClick={() => {
                          if (latestActionId !== undefined) {
                            rejectAction(latestActionId);
                          }
                        }}
                      >
                        {action.secondary}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="policy-panel">
            <div className="agent-card">
              <div className="agent-icon">
                <Bot size={24} />
              </div>
              <div>
                <p className="eyebrow">Active agent</p>
                <h2>Finance Operator</h2>
                <span>Can propose payments, reserves, and vendor actions.</span>
              </div>
            </div>

            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Guardrails</p>
                <h2>Active Policy</h2>
              </div>
            </div>

            <ul className="policy-list">
              <li>
                <span>Daily spend cap</span>
                <strong>{formatPolicyAmount(dailySpendLimit)}</strong>
              </li>
              <li>
                <span>Human approval above</span>
                <strong>{formatPolicyAmount(approvalThreshold)}</strong>
              </li>
              {policies.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </li>
              ))}
              <li>
                <span>Connected wallet agent</span>
                <strong>{isApprovedAgent ? "Approved" : "Not approved"}</strong>
              </li>
            </ul>

            <div className="audit-box">
              <p className="eyebrow">Transaction status</p>
              <ol>
                <li>
                  <span>Hash</span>
                  {hash ? shortAddress(hash) : "No transaction submitted yet."}
                </li>
                <li>
                  <span>State</span>
                  {isPending
                    ? "Waiting for wallet signature."
                    : isConfirming
                      ? "Waiting for Arbitrum confirmation."
                      : isConfirmed
                        ? "Transaction confirmed."
                        : "Idle."}
                </li>
                <li>
                  <span>Error</span>
                  {writeError?.message ?? "None."}
                </li>
              </ol>
            </div>

            <div className="vault-controls">
              <button
                type="button"
                disabled={!connectedOwner || isPending || isConfirming}
                onClick={() => allowDemoRecipient(true)}
              >
                Allow Demo Recipient
              </button>
              <button
                type="button"
                disabled={!canUseVault || latestActionId === undefined || isPending || isConfirming}
                onClick={() => {
                  if (latestActionId !== undefined) {
                    executeAction(latestActionId);
                  }
                }}
              >
                Execute Latest Action
              </button>
            </div>

            <div className="contract-status">
              <Activity size={18} />
              <span>
                Contract target:{" "}
                {agentVaultAddress ? shortAddress(agentVaultAddress) : "deploy to Arbitrum Sepolia"}
              </span>
              <CheckCircle2 size={18} />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function shortAddress(value?: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatPolicyAmount(value?: bigint) {
  if (value === undefined) return "--";
  return formatUnits(value, 0);
}
