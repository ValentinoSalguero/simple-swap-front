// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.2 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./LiquidityToken.sol";

/// @custom:dev-run-script ./scripts/deploy_with_ethers.ts
/// @title SimpleSwap - A minimal Uniswap-like DEX for ERC-20 tokens
/// @author Valentino Salguero
/// @notice This contract allows users to add/remove liquidity, swap tokens, fetch price and calculate output amounts.
/// @dev Inspired by Uniswap, but simplified for educational purposes.
contract SimpleSwap {
    using SafeERC20 for IERC20;

    /// @dev Stores the reserves of two tokens in a pair
    struct Reserve {
        uint112 reserveA;
        uint112 reserveB;
    }

    /// @dev Maps the hash of a token pair to its reserve data
    mapping(bytes32 => Reserve) public reserves;

    /// @dev Maps the pair hash to the total liquidity of the pool
    mapping(bytes32 => uint) public totalLiquidity;

    /// @dev Maps the pair hash to the associated ERC20 liquidity token
    mapping(bytes32 => LiquidityToken) public liquidityTokens;

    /// @notice Adds liquidity to a token pair pool
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @param amountADesired Desired amount of token A to add
    /// @param amountBDesired Desired amount of token B to add
    /// @param amountAMin Minimum acceptable amount of token A
    /// @param amountBMin Minimum acceptable amount of token B
    /// @param to Recipient of the liquidity tokens
    /// @param deadline Timestamp after which the transaction is invalid
    /// @return amountA Actual amount of token A added
    /// @return amountB Actual amount of token B added
    /// @return liquidity Amount of liquidity tokens minted
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        require(block.timestamp <= deadline, "Expired");

        bytes32 pairHash = _getPairHash(tokenA, tokenB);
        Reserve storage res = reserves[pairHash];

        // Compute optimal token amounts to maintain price ratio
        (amountA, amountB) = _calculateLiquidityAmounts(
            res.reserveA,
            res.reserveB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );

        _performAddLiquidityTransfers(tokenA, tokenB, amountA, amountB);

        // Mint LP tokens and update reserves
        liquidity = _mintLiquidityAndUpdateReserves(pairHash, tokenA, tokenB, amountA, amountB, to, res);
    }

    /// @notice Removes liquidity and returns tokens to the user
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @param liquidity Amount of liquidity tokens to burn
    /// @param amountAMin Minimum acceptable amount of token A
    /// @param amountBMin Minimum acceptable amount of token B
    /// @param to Address to receive withdrawn tokens
    /// @param deadline Timestamp after which the transaction is invalid
    /// @return actualAmountA Amount of token A received
    /// @return actualAmountB Amount of token B received
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint actualAmountA, uint actualAmountB) {
        require(block.timestamp <= deadline, "Expired");

        bytes32 pairHash = _getPairHash(tokenA, tokenB);
        Reserve storage res = reserves[pairHash];
        uint total = totalLiquidity[pairHash];
        require(total > 0, "No liquidity");

        /// @dev Burns user's liquidity tokens
        liquidityTokens[pairHash].burn(msg.sender, liquidity);

        uint calculatedAmountForSmallerToken = res.reserveA * liquidity / total;
        uint calculatedAmountForLargerToken = res.reserveB * liquidity / total;

        address tA = tokenA;
        address tB = tokenB;

        if (tA < tB) {
            actualAmountA = calculatedAmountForSmallerToken;
            actualAmountB = calculatedAmountForLargerToken;
        } else {
            actualAmountA = calculatedAmountForLargerToken;
            actualAmountB = calculatedAmountForSmallerToken;
        }

        require(actualAmountA >= amountAMin && actualAmountB >= amountBMin, "Slippage");

        totalLiquidity[pairHash] -= liquidity;
        res.reserveA -= uint112(calculatedAmountForSmallerToken);
        res.reserveB -= uint112(calculatedAmountForLargerToken);

        IERC20(tA).safeTransfer(to, actualAmountA);
        IERC20(tB).safeTransfer(to, actualAmountB);
    }

    /// @notice Swaps exact amountIn of tokenIn for tokenOut with a 0.3% fee applied (Uniswap standard fee)
    /// @param amountIn Exact amount of input tokens to swap
    /// @param amountOutMin Minimum amount of output tokens required
    /// @param path Array with [tokenIn, tokenOut]
    /// @param to Address to receive output tokens
    /// @param deadline Timestamp after which the transaction is invalid
    /// @return amounts Array containing input and output amounts
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Expired");
        require(path.length == 2, "Only 2-token path supported");

        address tokenIn = path[0];
        address tokenOut = path[1];

        // Calculate output amount using reserves
        uint amountOut = _calculateSwapOutput(amountIn, tokenIn, tokenOut);
        require(amountOut >= amountOutMin, "Insufficient output");

        _performSwapTransfers(tokenIn, tokenOut, amountIn, amountOut, to);
        _updateReservesAfterSwap(tokenIn, tokenOut, amountIn, amountOut);

        amounts = new uint[] (2) ;
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    /// @notice Returns the price of tokenB in terms of tokenA
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return price Price as tokenB/tokenA scaled by 1e18
    function getPrice(address tokenA, address tokenB) external view returns (uint price) {
        bytes32 pairHash = _getPairHash(tokenA, tokenB);
        Reserve memory res = reserves[pairHash];

        (uint reserveA, uint reserveB) = _getSortedReserves(tokenA, tokenB, res);
        require(reserveA > 0 && reserveB > 0, "No reserves");
        price = (reserveB * 1e18) / reserveA;
    }

    /// @notice Calculates output tokens for a given input using Uniswap formula with a 0.3% fee
    /// @param amountIn Input amount
    /// @param reserveIn Reserve of input token
    /// @param reserveOut Reserve of output token
    /// @return amountOut Amount of output tokens after fee
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid reserves");

        uint amountInWithFee = amountIn * 997; // 0.3% fee
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /// @dev Computes optimal token amounts for liquidity provisioning to maintain price ratio
    function _calculateLiquidityAmounts(
        uint112 currentReserveA,
        uint112 currentReserveB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal pure returns (uint calculatedAmountA, uint calculatedAmountB) {
        if (currentReserveA == 0 && currentReserveB == 0) {
            (calculatedAmountA, calculatedAmountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = amountADesired * currentReserveB / currentReserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "Insufficient B");
                (calculatedAmountA, calculatedAmountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = amountBDesired * currentReserveA / currentReserveB;
                require(amountAOptimal >= amountAMin, "Insufficient A");
                (calculatedAmountA, calculatedAmountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    /// @dev Transfers tokens from user to contract for liquidity addition
    function _performAddLiquidityTransfers(
        address tokenA,
        address tokenB,
        uint amountA,
        uint amountB
    ) internal {
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
    }

    /// @dev Deploys liquidity token (if needed), mints it, and updates pool reserves
    /// @param pairHash The hash representing the token pair
    /// @param amountA Amount of token A added
    /// @param amountB Amount of token B added
    /// @param to Recipient of the liquidity tokens
    /// @param res Storage reference to reserves
    /// @return liquidity Amount of liquidity tokens minted
    function _mintLiquidityAndUpdateReserves(
        bytes32 pairHash,
        address _tokenA,
        address _tokenB,
        uint amountA,
        uint amountB,
        address to,
        Reserve storage res
    ) internal returns (uint liquidity) {
        liquidity = amountA + amountB;

        if (address(liquidityTokens[pairHash]) == address(0)) {
            string memory name = string(abi.encodePacked("Liquidity Token ", _toHex(pairHash)));
            string memory symbol = string(abi.encodePacked("LQ-", _shortHex(pairHash)));
            LiquidityToken token = new LiquidityToken(name, symbol);
            token.transferOwnership(address(this));
            liquidityTokens[pairHash] = token;
        }

        liquidityTokens[pairHash].mint(to, liquidity);

        totalLiquidity[pairHash] += liquidity;
        if (_tokenA < _tokenB) {
            res.reserveA += uint112(amountA);
            res.reserveB += uint112(amountB);
        } else {
            res.reserveA += uint112(amountB);
            res.reserveB += uint112(amountA); 
        }
    }

    /// @dev Calculates output amount for a given swap
    function _calculateSwapOutput(uint amountIn, address tokenIn, address tokenOut) internal view returns (uint) {
        bytes32 pairHash = _getPairHash(tokenIn, tokenOut);
        Reserve memory res = reserves[pairHash];
        (uint reserveIn, uint reserveOut) = _getSortedReserves(tokenIn, tokenOut, res);
        return getAmountOut(amountIn, reserveIn, reserveOut);
    }

    /// @dev Transfers input tokens and sends output tokens to user
    function _performSwapTransfers(address tokenIn, address tokenOut, uint amountIn, uint amountOut, address to) internal {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
    }

    /// @dev Updates internal reserves after swap
    function _updateReservesAfterSwap(address tokenIn, address tokenOut, uint amountIn, uint amountOut) internal {
        bytes32 pairHash = _getPairHash(tokenIn, tokenOut);
        Reserve storage res = reserves[pairHash];

        if (tokenIn < tokenOut) {
            res.reserveA += uint112(amountIn);
            res.reserveB -= uint112(amountOut);
        } else {
            res.reserveB += uint112(amountIn);
            res.reserveA -= uint112(amountOut);
        }
    }

    /// @dev Computes a consistent hash for the token pair
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return Pair hash used as key in mappings
    function _getPairHash(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA));
    }

    /// @dev Returns reserves sorted according to token addresses
    function _getSortedReserves(address tokenA, address tokenB, Reserve memory res) internal pure returns (uint, uint) {
        return tokenA < tokenB ? (res.reserveA, res.reserveB) : (res.reserveB, res.reserveA);
    }

    /// @dev Converts bytes32 to full hexadecimal string
    function _toHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint i = 0; i < 32; i++) {
            str[i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[1+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    /// @dev Converts bytes32 to short 4-byte (8-char) hex string
    function _shortHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(8);
        for (uint i = 0; i < 4; i++) {
            str[i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[1+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }

    /// @notice Returns the consistent hash for a given token pair
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return The pair hash
    function getPairHash(address tokenA, address tokenB) external pure returns (bytes32) {
        return _getPairHash(tokenA, tokenB);
    }

    /// @notice Returns the address of the liquidity token for a given pair
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @return The address of the liquidity token
    function getLiquidityTokenAddress(address tokenA, address tokenB) external view returns (address) {
        bytes32 pairHash = _getPairHash(tokenA, tokenB);
        return address(liquidityTokens[pairHash]);
    }
}