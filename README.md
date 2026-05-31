# AgentVault

Safe treasury execution for AI agents on Arbitrum.

AgentVault lets AI agents propose treasury actions while smart contracts enforce spending limits, recipient allowlists, approval thresholds, and an auditable action log before funds move.

## Demo Pitch

AI agents should not get unrestricted wallets. AgentVault gives founders a safer way to delegate financial operations: agents can propose payments, treasury moves, and runway actions, but every action is checked against onchain policy before execution.

## MVP Flow

1. A founder creates a company vault.
2. The founder configures approved recipients, daily limits, and approval thresholds.
3. An AI finance agent proposes treasury actions.
4. AgentVault checks the action against policy.
5. Safe actions can be approved and executed.
6. Unsafe actions are blocked and logged.

## App

AgentVault is a Next.js App Router project using RainbowKit and wagmi.

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and add a WalletConnect project ID for production-grade wallet support.

## Contract Deployment

Set these values in `.env` or your shell:

```bash
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=your_private_key
```

Then deploy:

```bash
npm run deploy:arbitrum-sepolia
```

Copy the deployed address into:

```bash
NEXT_PUBLIC_AGENTVAULT_ADDRESS=0x...
```

## Arbitrum Direction

- Deploy contracts on Arbitrum Sepolia.
- Use Arbitrum's low fees for frequent audit events.
- Add Stylus later for richer policy scoring or agent risk modules if time allows.
