// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Defines a new interface that extends IERC20 and adds the decimals() function.
interface IERC20WithDecimals is IERC20 {
    function decimals() external view returns (uint8);
}

contract Faucet is Ownable {
    // Mapping to track the last time an address requested tokens
    // to prevent spam or abuse (e.g., 24 hours cooldown).
    mapping(address => uint) public lastRequestTime;
    uint public cooldownTime = 1 days; // Cooldown period between requests (e.g., 1 day)

    // Now using our new interface which includes the decimals() function.
    IERC20WithDecimals public tokenA;
    IERC20WithDecimals public tokenB;

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) {
        // Cast the token addresses to our new interface.
        tokenA = IERC20WithDecimals(_tokenA);
        tokenB = IERC20WithDecimals(_tokenB);
    }

    /// @notice Allows any user to request test tokens.
    /// @param recipient The address that will receive the tokens.
    function requestTokens(address recipient) public {
        require(recipient != address(0), "Invalid address"); // Changed from "Direccion invalida"
        require(block.timestamp >= lastRequestTime[recipient] + cooldownTime, "Please wait for the cooldown period to end"); // Changed from "Espera el cooldown"

        // Amount of tokens to dispense (e.g., 100 tokens), scaled by decimals.
        uint amountToDispenseA = 100 * (10**uint(tokenA.decimals()));
        uint amountToDispenseB = 100 * (10**uint(tokenB.decimals()));

        require(tokenA.balanceOf(address(this)) >= amountToDispenseA, "Insufficient Token A in Faucet"); // Changed from "No hay Token A suficiente en el Faucet"
        require(tokenB.balanceOf(address(this)) >= amountToDispenseB, "Insufficient Token B in Faucet"); // Changed from "No hay Token B suficiente en el Faucet"

        tokenA.transfer(recipient, amountToDispenseA);
        tokenB.transfer(recipient, amountToDispenseB);

        lastRequestTime[recipient] = block.timestamp; // Records the time of the last request.
    }

    /// @notice Allows the Faucet owner to replenish the token supply.
    /// @dev You must call `approve` on the TokenA and TokenB contracts beforehand,
    ///      allowing this Faucet contract to transfer your tokens.
    function replenish(uint amountA, uint amountB) public onlyOwner {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
    }

    /// @notice To check the Faucet's current balances.
    function getFaucetBalances() public view returns (uint balanceA, uint balanceB) {
        return (tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }
}