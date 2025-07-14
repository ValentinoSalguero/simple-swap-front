// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.2 <0.9.0;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
/// @custom:dev-run-script ./scripts/deploy_with_ethers.ts

contract LiquidityToken is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {}

    function mint(address to, uint amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint amount) external onlyOwner {
        _burn(from, amount);
    }
}