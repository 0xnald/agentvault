// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AgentVault {
    enum ActionStatus {
        Proposed,
        Approved,
        Executed,
        Rejected,
        Blocked
    }

    struct Action {
        address agent;
        address token;
        address recipient;
        uint256 amount;
        string actionType;
        string reason;
        ActionStatus status;
    }

    address public owner;
    uint256 public dailySpendLimit;
    uint256 public approvalThreshold;
    uint256 public spentToday;
    uint256 public currentDay;

    mapping(address => bool) public approvedAgents;
    mapping(address => bool) public approvedRecipients;
    mapping(uint256 => Action) public actions;
    uint256 public actionCount;

    event AgentUpdated(address indexed agent, bool approved);
    event RecipientUpdated(address indexed recipient, bool approved);
    event PolicyUpdated(uint256 dailySpendLimit, uint256 approvalThreshold);
    event ActionProposed(uint256 indexed actionId, address indexed agent, address recipient, uint256 amount);
    event ActionApproved(uint256 indexed actionId);
    event ActionExecuted(uint256 indexed actionId);
    event ActionBlocked(uint256 indexed actionId, string reason);
    event ActionRejected(uint256 indexed actionId);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyApprovedAgent() {
        require(approvedAgents[msg.sender], "AGENT_NOT_APPROVED");
        _;
    }

    constructor(uint256 initialDailySpendLimit, uint256 initialApprovalThreshold) {
        owner = msg.sender;
        dailySpendLimit = initialDailySpendLimit;
        approvalThreshold = initialApprovalThreshold;
        currentDay = block.timestamp / 1 days;
    }

    receive() external payable {}

    function setAgent(address agent, bool approved) external onlyOwner {
        approvedAgents[agent] = approved;
        emit AgentUpdated(agent, approved);
    }

    function setRecipient(address recipient, bool approved) external onlyOwner {
        approvedRecipients[recipient] = approved;
        emit RecipientUpdated(recipient, approved);
    }

    function setPolicy(uint256 newDailySpendLimit, uint256 newApprovalThreshold) external onlyOwner {
        dailySpendLimit = newDailySpendLimit;
        approvalThreshold = newApprovalThreshold;
        emit PolicyUpdated(newDailySpendLimit, newApprovalThreshold);
    }

    function proposeAction(
        address token,
        address recipient,
        uint256 amount,
        string calldata actionType,
        string calldata reason
    ) external onlyApprovedAgent returns (uint256 actionId) {
        actionId = actionCount++;

        actions[actionId] = Action({
            agent: msg.sender,
            token: token,
            recipient: recipient,
            amount: amount,
            actionType: actionType,
            reason: reason,
            status: ActionStatus.Proposed
        });

        string memory blockReason = _policyBlockReason(recipient);
        if (bytes(blockReason).length > 0) {
            actions[actionId].status = ActionStatus.Blocked;
            emit ActionBlocked(actionId, blockReason);
        }

        emit ActionProposed(actionId, msg.sender, recipient, amount);
    }

    function approveAction(uint256 actionId) external onlyOwner {
        Action storage action = actions[actionId];
        require(action.status == ActionStatus.Proposed, "ACTION_NOT_PROPOSED");

        action.status = ActionStatus.Approved;
        emit ActionApproved(actionId);
    }

    function rejectAction(uint256 actionId) external onlyOwner {
        Action storage action = actions[actionId];
        require(action.status == ActionStatus.Proposed || action.status == ActionStatus.Approved, "ACTION_NOT_REJECTABLE");

        action.status = ActionStatus.Rejected;
        emit ActionRejected(actionId);
    }

    function executeAction(uint256 actionId) external onlyOwner {
        Action storage action = actions[actionId];
        require(action.status == ActionStatus.Approved, "ACTION_NOT_APPROVED");

        _rollDay();
        require(approvedRecipients[action.recipient], "RECIPIENT_NOT_APPROVED");
        require(spentToday + action.amount <= dailySpendLimit, "DAILY_LIMIT_EXCEEDED");

        spentToday += action.amount;
        action.status = ActionStatus.Executed;

        if (action.token == address(0)) {
            (bool ok,) = action.recipient.call{value: action.amount}("");
            require(ok, "ETH_TRANSFER_FAILED");
        } else {
            require(IERC20(action.token).transfer(action.recipient, action.amount), "TOKEN_TRANSFER_FAILED");
        }

        emit ActionExecuted(actionId);
    }

    function _policyBlockReason(address recipient) internal view returns (string memory) {
        if (!approvedRecipients[recipient]) {
            return "RECIPIENT_NOT_APPROVED";
        }

        return "";
    }

    function _rollDay() internal {
        uint256 day = block.timestamp / 1 days;
        if (day > currentDay) {
            currentDay = day;
            spentToday = 0;
        }
    }
}
