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
import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseEventLogs } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  agentVaultArbitrumOne,
  agentVaultArbitrumSepolia,
  getSupportedAgentVaultChain,
} from "../lib/chains";
import {
  agentVaultAbi,
  demoAction,
  demoRecipient,
  getAgentVaultAddress,
  getAgentVaultEventStartBlock,
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

type AuditEvent = {
  blockNumber: bigint;
  eventName: string;
  message: string;
  transactionHash: string;
};

type ViewId = "command" | "vault" | "policies" | "agents" | "audit";

const views: Array<{ id: ViewId; label: string }> = [
  { id: "command", label: "Command" },
  { id: "vault", label: "Vault" },
  { id: "policies", label: "Policies" },
  { id: "agents", label: "Agents" },
  { id: "audit", label: "Audit" },
];

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
  const activeChain = getSupportedAgentVaultChain(chainId);
  const targetChain =
    activeChain ??
    (getAgentVaultAddress(agentVaultArbitrumOne.id) ? agentVaultArbitrumOne : agentVaultArbitrumSepolia);
  const activeContractAddress = getAgentVaultAddress(chainId);
  const publicClient = usePublicClient({ chainId: targetChain.id });
  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditError, setAuditError] = useState<string>();
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("command");
  const isSupportedNetwork = Boolean(activeChain);
  const hasContract = Boolean(activeContractAddress);
  const canUseVault = isConnected && isSupportedNetwork && hasContract;

  const contractQuery = {
    address: activeContractAddress,
    abi: agentVaultAbi,
    query: { enabled: hasContract },
  } as const;

  const { data: owner, refetch: refetchOwner } = useReadContract({
    ...contractQuery,
    functionName: "owner",
  });
  const { data: dailySpendLimit, refetch: refetchDailySpendLimit } = useReadContract({
    ...contractQuery,
    functionName: "dailySpendLimit",
  });
  const { data: approvalThreshold, refetch: refetchApprovalThreshold } = useReadContract({
    ...contractQuery,
    functionName: "approvalThreshold",
  });
  const { data: spentToday, refetch: refetchSpentToday } = useReadContract({
    ...contractQuery,
    functionName: "spentToday",
  });
  const { data: actionCount, refetch: refetchActionCount } = useReadContract({
    ...contractQuery,
    functionName: "actionCount",
  });
  const { data: isApprovedAgent, refetch: refetchApprovedAgent } = useReadContract({
    ...contractQuery,
    functionName: "approvedAgents",
    args: address ? [address] : undefined,
    query: { enabled: hasContract && Boolean(address) },
  });
  const { data: isDemoRecipientApproved, refetch: refetchDemoRecipient } = useReadContract({
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
      hint: hasContract ? shortAddress(activeContractAddress) : `Deploy on ${targetChain.name}`,
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
    if (!activeContractAddress || !address) return;
    writeContract({
      address: activeContractAddress,
      abi: agentVaultAbi,
      functionName: "setAgent",
      args: [address, true],
    });
  };

  const allowDemoRecipient = (approved: boolean) => {
    if (!activeContractAddress) return;
    writeContract({
      address: activeContractAddress,
      abi: agentVaultAbi,
      functionName: "setRecipient",
      args: [demoRecipient, approved],
    });
  };

  const proposeDemoAction = () => {
    if (!activeContractAddress) return;
    writeContract({
      address: activeContractAddress,
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
    if (!activeContractAddress) return;
    writeContract({
      address: activeContractAddress,
      abi: agentVaultAbi,
      functionName: "approveAction",
      args: [actionId],
    });
  };

  const rejectAction = (actionId: bigint) => {
    if (!activeContractAddress) return;
    writeContract({
      address: activeContractAddress,
      abi: agentVaultAbi,
      functionName: "rejectAction",
      args: [actionId],
    });
  };

  const executeAction = (actionId: bigint) => {
    if (!activeContractAddress) return;
    writeContract({
      address: activeContractAddress,
      abi: agentVaultAbi,
      functionName: "executeAction",
      args: [actionId],
    });
  };

  const loadAuditEvents = useCallback(async () => {
    if (!activeContractAddress || !publicClient) return;

    setIsLoadingAudit(true);
    setAuditError(undefined);

    try {
      const latestBlock = await publicClient.getBlockNumber();
      const configuredStartBlock = getAgentVaultEventStartBlock(targetChain.id);
      const fromBlock = configuredStartBlock ?? (latestBlock > 5_000n ? latestBlock - 5_000n : 0n);
      const logs = await publicClient.getLogs({
        address: activeContractAddress,
        fromBlock,
        toBlock: "latest",
      });
      const parsedLogs = parseEventLogs({
        abi: agentVaultAbi,
        logs,
      });

      const nextEvents = parsedLogs
        .map((log) => {
          const args = log.args as Record<string, unknown>;
          return {
            blockNumber: log.blockNumber ?? 0n,
            eventName: log.eventName ?? "ContractEvent",
            message: formatAuditEvent(log.eventName ?? "ContractEvent", args),
            transactionHash: log.transactionHash ?? "",
          };
        })
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, 8);

      setAuditEvents(nextEvents);
    } catch (error) {
      setAuditError(formatAuditError(error));
    } finally {
      setIsLoadingAudit(false);
    }
  }, [activeContractAddress, publicClient, targetChain.id]);

  useEffect(() => {
    if (isConfirmed || activeView === "audit") {
      void loadAuditEvents();
    }
  }, [activeView, loadAuditEvents, isConfirmed]);

  useEffect(() => {
    if (!isConfirmed) return;

    void refetchOwner();
    void refetchDailySpendLimit();
    void refetchApprovalThreshold();
    void refetchSpentToday();
    void refetchActionCount();
    void refetchApprovedAgent();
    void refetchDemoRecipient();
  }, [
    isConfirmed,
    refetchActionCount,
    refetchApprovalThreshold,
    refetchApprovedAgent,
    refetchDailySpendLimit,
    refetchDemoRecipient,
    refetchOwner,
    refetchSpentToday,
  ]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AgentVault home">
          <Image src="/agentvault-logo.svg" alt="" width={44} height={44} priority />
          <span>AgentVault</span>
        </a>

        <nav className="nav-list" aria-label="Primary">
          {views.map((view) => (
            <button
              className={activeView === view.id ? "active" : ""}
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </nav>

        <div className={`network-pill ${isSupportedNetwork ? "online" : "warning"}`}>
          <span className="status-dot" />
          {activeChain?.name ?? "Wrong network"}
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
            {isConnected && !isSupportedNetwork ? (
              <button
                className="switch-button"
                type="button"
                onClick={() => switchChain({ chainId: targetChain.id })}
              >
                Switch to {targetChain.name}
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

        {activeView === "command" ? <CommandView /> : null}
        {activeView === "vault" ? <VaultView /> : null}
        {activeView === "policies" ? <PoliciesView /> : null}
        {activeView === "agents" ? <AgentsView /> : null}
        {activeView === "audit" ? <AuditView /> : null}
      </main>
    </div>
  );

  function CommandView() {
    return (
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
                disabled={!canUseVault || !address || isPending || isConfirming}
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
                  : `Deploy AgentVault on ${targetChain.name} and set its address before sending transactions.`}
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
              <div className="audit-heading">
                <p className="eyebrow">Onchain audit</p>
                <button type="button" onClick={() => void loadAuditEvents()}>
                  Refresh
                </button>
              </div>
              <ol>
                {auditEvents.length > 0 ? (
                  auditEvents.map((event) => (
                    <li key={`${event.transactionHash}-${event.eventName}-${event.blockNumber}`}>
                      <span>{event.eventName}</span>
                      <div>
                        {event.message}
                        <small>
                          Block {event.blockNumber.toString()} · {shortAddress(event.transactionHash)}
                        </small>
                      </div>
                    </li>
                  ))
                ) : (
                  <li>
                    <span>{isLoadingAudit ? "Loading" : "Empty"}</span>
                    {auditError ?? "No AgentVault events found yet. Run an action, then refresh."}
                  </li>
                )}
              </ol>
            </div>

            <div className="audit-box transaction-box">
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
                disabled={!canUseVault || isPending || isConfirming}
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
                {activeContractAddress ? shortAddress(activeContractAddress) : `deploy to ${targetChain.name}`}
              </span>
              <CheckCircle2 size={18} />
            </div>
          </aside>
        </section>
    );
  }

  function VaultView() {
    return (
      <section className="single-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vault</p>
            <h2>Contract State</h2>
          </div>
        </div>
        <div className="detail-grid">
          <Detail label="Contract" value={activeContractAddress ? shortAddress(activeContractAddress) : "Not deployed"} />
          <Detail label="Owner" value={owner ? shortAddress(owner) : "Loading"} />
          <Detail label="Actions proposed" value={actionCount?.toString() ?? "0"} />
          <Detail label="Connected wallet" value={address ? shortAddress(address) : "Not connected"} />
        </div>
      </section>
    );
  }

  function PoliciesView() {
    return (
      <section className="single-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Policies</p>
            <h2>Guardrails</h2>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={!canUseVault || isPending || isConfirming}
            onClick={() => allowDemoRecipient(true)}
          >
            <ShieldCheck size={17} />
            Allow Demo Recipient
          </button>
        </div>
        <div className="detail-grid">
          <Detail label="Daily spend cap" value={formatPolicyAmount(dailySpendLimit)} />
          <Detail label="Human approval above" value={formatPolicyAmount(approvalThreshold)} />
          <Detail label="Spent today" value={formatPolicyAmount(spentToday)} />
          <Detail label="Demo recipient" value={isDemoRecipientApproved ? "Allowlisted" : "Blocked"} />
        </div>
      </section>
    );
  }

  function AgentsView() {
    return (
      <section className="single-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agents</p>
            <h2>Finance Operator</h2>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={!canUseVault || !address || isPending || isConfirming}
            onClick={setSelfAsAgent}
          >
            <ShieldCheck size={17} />
            Approve Wallet As Agent
          </button>
        </div>
        <div className="detail-grid">
          <Detail label="Connected wallet" value={address ? shortAddress(address) : "Not connected"} />
          <Detail label="Agent status" value={isApprovedAgent ? "Approved" : "Not approved"} />
          <Detail label="Vault owner" value={connectedOwner ? "Connected wallet" : owner ? shortAddress(owner) : "Loading"} />
          <Detail label="Permissions" value="Can propose payments, reserves, and vendor actions" />
        </div>
      </section>
    );
  }

  function AuditView() {
    return (
      <section className="single-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit</p>
            <h2>Onchain History</h2>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadAuditEvents()}>
            <Activity size={17} />
            Refresh
          </button>
        </div>
        <AuditList />
      </section>
    );
  }

  function AuditList() {
    return (
      <div className="audit-box wide-audit">
        <ol>
          {auditEvents.length > 0 ? (
            auditEvents.map((event) => (
              <li key={`${event.transactionHash}-${event.eventName}-${event.blockNumber}`}>
                <span>{event.eventName}</span>
                <div>
                  {event.message}
                  <small>
                    Block {event.blockNumber.toString()} · {shortAddress(event.transactionHash)}
                  </small>
                </div>
              </li>
            ))
          ) : (
            <li>
              <span>{isLoadingAudit ? "Loading" : "Empty"}</span>
              {auditError ?? "No AgentVault events found yet. Run an action, then refresh."}
            </li>
          )}
        </ol>
      </div>
    );
  }

  function Detail({ label, value }: { label: string; value: string }) {
    return (
      <article className="detail-card">
        <span>{label}</span>
        <strong>{value}</strong>
      </article>
    );
  }
}

function shortAddress(value?: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatPolicyAmount(value?: bigint) {
  if (value === undefined) return "--";
  return formatUnits(value, 0);
}

function formatAuditEvent(eventName: string, args: Record<string, unknown>) {
  switch (eventName) {
    case "AgentUpdated":
      return `${shortAddress(String(args.agent))} ${args.approved ? "approved" : "removed"} as agent.`;
    case "RecipientUpdated":
      return `${shortAddress(String(args.recipient))} ${
        args.approved ? "allowlisted" : "removed from allowlist"
      }.`;
    case "PolicyUpdated":
      return `Policy set: daily ${formatPolicyAmount(args.dailySpendLimit as bigint)}, approval ${formatPolicyAmount(
        args.approvalThreshold as bigint,
      )}.`;
    case "ActionProposed":
      return `Action #${String(args.actionId)} proposed for ${shortAddress(
        String(args.recipient),
      )}, amount ${formatPolicyAmount(args.amount as bigint)}.`;
    case "ActionApproved":
      return `Action #${String(args.actionId)} approved.`;
    case "ActionExecuted":
      return `Action #${String(args.actionId)} executed.`;
    case "ActionBlocked":
      return `Action #${String(args.actionId)} blocked: ${String(args.reason)}.`;
    case "ActionRejected":
      return `Action #${String(args.actionId)} rejected.`;
    default:
      return eventName;
  }
}

function formatAuditError(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not load audit events.";

  if (message.toLowerCase().includes("limit exceeded") || message.includes("eth_getLogs")) {
    return "Audit history could not load because the RPC limited log queries. The transaction may still be confirmed; try Refresh or use a higher-limit RPC.";
  }

  return message;
}
