// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VestingManager is Ownable {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 released;
        bool revoked;
    }

    IERC20 public token;
    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    mapping(address => bytes32[]) public beneficiarySchedules;
    uint256 public vestingScheduleCount;

    event VestingCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration
    );
    event TokensReleased(bytes32 indexed scheduleId, uint256 amount);
    event VestingRevoked(bytes32 indexed scheduleId);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function createVestingSchedule(
        address _beneficiary,
        uint256 _amount,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _duration
    ) external onlyOwner returns (bytes32) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_amount > 0, "Amount must be > 0");
        require(_duration > 0, "Duration must be > 0");
        require(_duration >= _cliffDuration, "Duration < cliff");

        bytes32 scheduleId = keccak256(
            abi.encodePacked(_beneficiary, _amount, _startTime, vestingScheduleCount++)
        );

        vestingSchedules[scheduleId] = VestingSchedule({
            beneficiary: _beneficiary,
            totalAmount: _amount,
            startTime: _startTime,
            cliffDuration: _cliffDuration,
            duration: _duration,
            released: 0,
            revoked: false
        });

        beneficiarySchedules[_beneficiary].push(scheduleId);

        token.safeTransferFrom(msg.sender, address(this), _amount);

        emit VestingCreated(
            scheduleId,
            _beneficiary,
            _amount,
            _startTime,
            _cliffDuration,
            _duration
        );

        return scheduleId;
    }

    function release(bytes32 _scheduleId) external {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        require(schedule.beneficiary == msg.sender, "Not beneficiary");
        require(!schedule.revoked, "Vesting revoked");

        uint256 releasable = _computeReleasableAmount(schedule);
        require(releasable > 0, "No tokens to release");

        schedule.released += releasable;
        token.safeTransfer(schedule.beneficiary, releasable);

        emit TokensReleased(_scheduleId, releasable);
    }

    function _computeReleasableAmount(VestingSchedule memory schedule)
        private
        view
        returns (uint256)
    {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        } else if (
            block.timestamp >= schedule.startTime + schedule.duration ||
            schedule.revoked
        ) {
            return schedule.totalAmount - schedule.released;
        } else {
            uint256 timeFromStart = block.timestamp - schedule.startTime;
            uint256 vestedAmount = (schedule.totalAmount * timeFromStart) / schedule.duration;
            return vestedAmount - schedule.released;
        }
    }

    function revokeVesting(bytes32 _scheduleId) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[_scheduleId];
        require(!schedule.revoked, "Already revoked");

        uint256 releasable = _computeReleasableAmount(schedule);
        if (releasable > 0) {
            schedule.released += releasable;
            token.safeTransfer(schedule.beneficiary, releasable);
        }

        uint256 refund = schedule.totalAmount - schedule.released;
        if (refund > 0) {
            token.safeTransfer(owner(), refund);
        }

        schedule.revoked = true;
        emit VestingRevoked(_scheduleId);
    }

    function getVestingSchedule(bytes32 _scheduleId)
        external
        view
        returns (VestingSchedule memory)
    {
        return vestingSchedules[_scheduleId];
    }

    function getBeneficiarySchedules(address _beneficiary)
        external
        view
        returns (bytes32[] memory)
    {
        return beneficiarySchedules[_beneficiary];
    }

    function computeReleasableAmount(bytes32 _scheduleId)
        external
        view
        returns (uint256)
    {
        return _computeReleasableAmount(vestingSchedules[_scheduleId]);
    }
}
