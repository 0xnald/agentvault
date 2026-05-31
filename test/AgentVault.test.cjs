const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

const Status = {
  Proposed: 0n,
  Approved: 1n,
  Executed: 2n,
  Rejected: 3n,
  Blocked: 4n,
};

describe("AgentVault", () => {
  let owner;
  let agent;
  let recipient;
  let stranger;
  let vault;

  const dailySpendLimit = ethers.parseEther("1");
  const approvalThreshold = ethers.parseEther("0.5");
  const paymentAmount = ethers.parseEther("0.25");

  beforeEach(async () => {
    [owner, agent, recipient, stranger] = await ethers.getSigners();

    const AgentVault = await ethers.getContractFactory("AgentVault");
    vault = await AgentVault.deploy(dailySpendLimit, approvalThreshold);
    await vault.waitForDeployment();
  });

  it("stores the initial owner and policy", async () => {
    assert.equal(await vault.owner(), owner.address);
    assert.equal(await vault.dailySpendLimit(), dailySpendLimit);
    assert.equal(await vault.approvalThreshold(), approvalThreshold);
  });

  it("only lets approved agents propose actions", async () => {
    await assert.rejects(
      vault
        .connect(stranger)
        .proposeAction(ethers.ZeroAddress, recipient.address, paymentAmount, "PAY_INVOICE", "Blocked"),
      /AGENT_NOT_APPROVED/,
    );

    await vault.setAgent(agent.address, true);
    await vault.setRecipient(recipient.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, recipient.address, paymentAmount, "PAY_INVOICE", "Allowed");

    assert.equal(await vault.actionCount(), 1n);
    const action = await vault.actions(0);
    assert.equal(action.agent, agent.address);
    assert.equal(action.recipient, recipient.address);
    assert.equal(action.status, Status.Proposed);
  });

  it("blocks proposals to unknown recipients while keeping an audit record", async () => {
    await vault.setAgent(agent.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, stranger.address, paymentAmount, "TRANSFER_REQUEST", "Suspicious");

    const action = await vault.actions(0);
    assert.equal(action.recipient, stranger.address);
    assert.equal(action.status, Status.Blocked);
  });

  it("lets the owner approve and reject proposed actions", async () => {
    await vault.setAgent(agent.address, true);
    await vault.setRecipient(recipient.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, recipient.address, paymentAmount, "PAY_INVOICE", "CloudHost");

    await vault.approveAction(0);
    let action = await vault.actions(0);
    assert.equal(action.status, Status.Approved);

    await vault.rejectAction(0);
    action = await vault.actions(0);
    assert.equal(action.status, Status.Rejected);
  });

  it("does not approve blocked actions", async () => {
    await vault.setAgent(agent.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, stranger.address, paymentAmount, "TRANSFER_REQUEST", "Suspicious");

    await assert.rejects(vault.approveAction(0), /ACTION_NOT_PROPOSED/);
  });

  it("executes approved ETH actions and tracks daily spend", async () => {
    await owner.sendTransaction({
      to: await vault.getAddress(),
      value: ethers.parseEther("1"),
    });

    await vault.setAgent(agent.address, true);
    await vault.setRecipient(recipient.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, recipient.address, paymentAmount, "PAY_INVOICE", "CloudHost");
    await vault.approveAction(0);

    const balanceBefore = await ethers.provider.getBalance(recipient.address);
    await vault.executeAction(0);
    const balanceAfter = await ethers.provider.getBalance(recipient.address);

    const action = await vault.actions(0);
    assert.equal(action.status, Status.Executed);
    assert.equal(await vault.spentToday(), paymentAmount);
    assert.equal(balanceAfter - balanceBefore, paymentAmount);
  });

  it("blocks execution above the daily spend limit", async () => {
    const oversizedAmount = ethers.parseEther("1.5");

    await owner.sendTransaction({
      to: await vault.getAddress(),
      value: oversizedAmount,
    });

    await vault.setAgent(agent.address, true);
    await vault.setRecipient(recipient.address, true);

    await vault
      .connect(agent)
      .proposeAction(ethers.ZeroAddress, recipient.address, oversizedAmount, "PAY_INVOICE", "Too much");
    await vault.approveAction(0);

    await assert.rejects(vault.executeAction(0), /DAILY_LIMIT_EXCEEDED/);
  });
});
