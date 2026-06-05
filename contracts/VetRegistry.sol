// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AggregatorV3Interface
 * @notice Minimal Chainlink AggregatorV3Interface — inline to avoid @chainlink/contracts dependency
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData()
        external view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title VetRegistry
 * @notice Veterinary clinic registry for managing pet medical records and appointments
 */
contract VetRegistry is AccessControl {
    using SafeERC20 for IERC20;
    // ==================== Types ====================

    enum AnimalType { Dog, Cat }

    struct MedicalRecord {
        string name;
        uint8 age;
        AnimalType animalType;
        string caretakerName;
        string caretakerPhone;
        address owner;
    }

    struct MedicalAppointment {
        uint256 petId;
        uint256 date;
        string time;
        uint256 appointmentValue;
        uint256 paidValue;
    }

    struct OwnerInfo {
        address wallet;
        string name;
        bool registered;
    }

    // ==================== Events ====================

    event MedicalRecordCreated(
        uint256 indexed id,
        address indexed owner,
        string name,
        uint8 age,
        AnimalType animalType,
        string caretakerName,
        string caretakerPhone
    );

    event MedicalAppointmentCreated(
        uint256 indexed id,
        uint256 indexed petId,
        uint256 date,
        string time,
        uint256 appointmentValue
    );

    event AppointmentPaidToken(
        uint256 indexed appointmentId,
        address indexed payer,
        address token,
        uint256 amount
    );

    event AppointmentPaidEth(
        uint256 indexed appointmentId,
        address indexed payer,
        uint256 ethAmount,
        uint256 usdCents
    );

    event OwnerRegistered(address indexed owner, string name);

    // ==================== State ====================

    uint256 private _petCount;
    uint256 private _appointmentCount;

    mapping(uint256 => MedicalRecord) private _medicalRecords;
    mapping(uint256 => MedicalAppointment) private _appointments;
    mapping(address => OwnerInfo) private _owners;
    address[] private _registeredOwnerAddresses;

    bytes32 public constant VET_ROLE = keccak256("VET_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VET_ROLE, msg.sender);
    }

    // ==================== Public Functions ====================

    /**
     * @notice Register a new pet medical record
     * @param name Pet's name
     * @param age Pet's age
     * @param animalType Pet's animal type (Dog or Cat)
     * @param caretakerName Caretaker's name
     * @param caretakerPhone Caretaker's phone number
     * @return id The assigned unique identifier for the new record
     */
    function registerPet(
        string calldata name,
        uint8 age,
        AnimalType animalType,
        address owner,
        string calldata caretakerName,
        string calldata caretakerPhone
    ) external onlyRole(VET_ROLE) returns (uint256 id) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(age > 0, "Age must be greater than 0");

        _petCount++;
        uint256 newId = _petCount;

        _medicalRecords[newId] = MedicalRecord({
            name: name,
            age: age,
            animalType: animalType,
            caretakerName: caretakerName,
            caretakerPhone: caretakerPhone,
            owner: owner
        });

        emit MedicalRecordCreated(
            newId,
            owner,
            name,
            age,
            animalType,
            caretakerName,
            caretakerPhone
        );

        return newId;
    }

    /**
     * @notice Get a pet's medical record by ID
     * @param id The pet's unique identifier
     * @return MedicalRecord The pet's medical record
     */
    function getMedicalRecord(uint256 id) external view returns (MedicalRecord memory) {
        require(id > 0 && id <= _petCount, "Pet does not exist");
        return _medicalRecords[id];
    }

    /**
     * @notice Get total number of registered pets
     * @return uint256 Total pet count
     */
    function getPetCount() external view returns (uint256) {
        return _petCount;
    }

    /**
     * @notice Schedule a medical appointment for a pet
     * @param petId The pet's unique identifier
     * @param date Appointment date (unix timestamp)
     * @param time Appointment time as string
     * @param appointmentValue Appointment cost in dollar cents
     * @return id The assigned unique identifier for the new appointment
     */
    function scheduleAppointment(
        uint256 petId,
        uint256 date,
        string calldata time,
        uint256 appointmentValue
    ) external onlyRole(VET_ROLE) returns (uint256 id) {
        require(petId > 0 && petId <= _petCount, "Pet does not exist");
        require(date > 0, "Date must be provided");
        require(appointmentValue > 0, "Appointment value must be greater than 0");

        _appointmentCount++;
        uint256 newId = _appointmentCount;

        _appointments[newId] = MedicalAppointment({
            petId: petId,
            date: date,
            time: time,
            appointmentValue: appointmentValue,
            paidValue: 0
        });

        emit MedicalAppointmentCreated(
            newId,
            petId,
            date,
            time,
            appointmentValue
        );

        return newId;
    }

    /**
     * @notice Get a medical appointment by ID
     * @param id The appointment's unique identifier
     * @return MedicalAppointment The appointment details
     */
    function getAppointment(uint256 id) external view returns (MedicalAppointment memory) {
        require(id > 0 && id <= _appointmentCount, "Appointment does not exist");
        return _appointments[id];
    }

    /**
     * @notice Get all appointment IDs for a specific pet
     * @param petId The pet's unique identifier
     * @return uint256[] Array of appointment IDs belonging to the pet
     */
    function getPetAppointments(uint256 petId) external view returns (uint256[] memory) {
        // Count how many appointments match this petId
        uint256 count;
        for (uint256 i = 1; i <= _appointmentCount; i++) {
            if (_appointments[i].petId == petId) {
                count++;
            }
        }
        // Build the result array
        uint256[] memory result = new uint256[](count);
        uint256 index;
        for (uint256 i = 1; i <= _appointmentCount; i++) {
            if (_appointments[i].petId == petId) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    /**
     * @notice Get total number of scheduled appointments
     * @return uint256 Total appointment count
     */
    function getAppointmentCount() external view returns (uint256) {
        return _appointmentCount;
    }

    // ==================== Owner Registration Functions ====================

    /**
     * @notice Register as a pet owner (permissionless)
     * @param name Owner's display name (2–32 characters)
     */
    function registerAsOwner(string calldata name) external {
        require(bytes(name).length >= 2, "Name must be at least 2 characters");
        require(bytes(name).length <= 32, "Name must be at most 32 characters");

        if (_owners[msg.sender].registered) {
            _owners[msg.sender].name = name;
        } else {
            _owners[msg.sender] = OwnerInfo({
                wallet: msg.sender,
                name: name,
                registered: true
            });
            _registeredOwnerAddresses.push(msg.sender);
        }

        emit OwnerRegistered(msg.sender, name);
    }

    /**
     * @notice Get all registered owners
     * @return OwnerInfo[] Array of registered owner info
     */
    function getRegisteredOwners() external view returns (OwnerInfo[] memory) {
        uint256 length = _registeredOwnerAddresses.length;
        OwnerInfo[] memory result = new OwnerInfo[](length);
        for (uint256 i = 0; i < length; i++) {
            address addr = _registeredOwnerAddresses[i];
            result[i] = _owners[addr];
        }
        return result;
    }

    /**
     * @notice Get all pet IDs owned by a given address
     * @param owner The owner's address
     * @return uint256[] Array of pet IDs owned by the address
     */
    function getPetsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 1; i <= _petCount; i++) {
            if (_medicalRecords[i].owner == owner) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 index;
        for (uint256 i = 1; i <= _petCount; i++) {
            if (_medicalRecords[i].owner == owner) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    // ==================== Payment Functions ====================

    /**
     * @notice Convert cents (2 decimal places) to token units accounting for token decimals
     * @param cents Amount in cents
     * @param d Token decimals
     * @return uint256 Amount in token units
     */
    function _centsToTokenUnits(uint256 cents, uint8 d) internal pure returns (uint256) {
        require(d > 2, "Token decimals must be > 2");
        return cents * 10 ** (d - 2);
    }

    /**
     * @notice Pay an appointment using an ERC20 token (e.g. USDC)
     * @param id Appointment ID
     * @param token ERC20 token address
     */
    function payAppointmentToken(uint256 id, address token) external {
        require(id > 0 && id <= _appointmentCount, "Appointment does not exist");
        require(_appointments[id].paidValue == 0, "Already paid");
        require(msg.sender == _medicalRecords[_appointments[id].petId].owner, "Not pet owner");

        uint256 amount = _centsToTokenUnits(_appointments[id].appointmentValue, IERC20Metadata(token).decimals());

        // CEI: update state BEFORE external call
        _appointments[id].paidValue = _appointments[id].appointmentValue;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit AppointmentPaidToken(id, msg.sender, token, amount);
    }

    /**
     * @notice Withdraw all tokens from the contract (owner only)
     * @param token ERC20 token address
     */
    function withdrawToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "No tokens");
        IERC20(token).safeTransfer(msg.sender, bal);
    }

    /**
     * @notice Convert cents to expected ETH in wei using a Chainlink price
     * @param cents Amount in dollar cents
     * @param price ETH/USD price from AggregatorV3Interface (8 decimals)
     * @return uint256 Expected ETH in wei
     */
    function _centsToEth(uint256 cents, uint256 price) internal pure returns (uint256) {
        return (cents * 1e24) / price;
    }

    /**
     * @notice Pay an appointment using ETH with price feed conversion
     * @param id Appointment ID
     * @param priceFeed Address of a Chainlink AggregatorV3Interface (ETH/USD)
     *
     * CEI pattern: state updated before refund. Excess ETH returned via low-level call.
     */
    function payAppointmentEth(uint256 id, address priceFeed) external payable {
        require(id > 0 && id <= _appointmentCount, "Appointment does not exist");
        require(_appointments[id].paidValue == 0, "Already paid");
        require(msg.sender == _medicalRecords[_appointments[id].petId].owner, "Not pet owner");

        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();
        require(price > 0, "Invalid price");

        uint256 expectedEth = _centsToEth(_appointments[id].appointmentValue, uint256(price));
        require(msg.value >= expectedEth, "Insufficient ETH");

        // CEI: update state BEFORE external call (refund)
        _appointments[id].paidValue = _appointments[id].appointmentValue;

        // Refund excess ETH
        uint256 refund = msg.value - expectedEth;
        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "Refund failed");
        }

        emit AppointmentPaidEth(id, msg.sender, expectedEth, _appointments[id].appointmentValue);
    }

    /**
     * @notice Withdraw all ETH from the contract (owner only)
     */
    function withdrawEth() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH");
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Withdraw failed");
    }

    /**
     * @notice Reject direct ETH transfers
     */
    receive() external payable {
        revert("ETH not supported");
    }
}
