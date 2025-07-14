const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let SimpleSwapFactory, simpleSwap;
  let LiquidityToken, tokenA, tokenB;
  let owner, addr1, addr2;

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy test tokens
    tokenA = await ethers.deployContract("LiquidityToken", ["Token A", "TKA"]);
    await tokenA.mint(owner.address, 1_000_000);

    tokenB = await ethers.deployContract("LiquidityToken", ["Token B", "TKB"]);
    await tokenB.mint(owner.address, 1_000_000);

    // Deploy SimpleSwap
    SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwapFactory.deploy();
    await simpleSwap.waitForDeployment();
    // Approve SimpleSwap to spend owner's tokens
    await tokenA.approve(simpleSwap.target, 1_000_000);
    await tokenB.approve(simpleSwap.target, 1_000_000);
  });

  describe("Add liquidity", () => {
    it("Should add liquidity and mint LP tokens", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      const initialTokenABalanceOwner = await tokenA.balanceOf(owner.address);
      const initialTokenBBalanceOwner = await tokenB.balanceOf(owner.address);

      // Execute transaction directly
      const tx = await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        1000,
        1000,
        900,
        900,
        owner.address,
        deadline
      );
      // Wait for the transaction to be mined
      const receipt = await tx.wait();

      // Verify token balances after adding liquidity
      const finalTokenABalanceOwner = await tokenA.balanceOf(owner.address);
      const finalTokenBBalanceOwner = await tokenB.balanceOf(owner.address);
      const lpTokenAddress = await simpleSwap.liquidityTokens(ethers.solidityPackedKeccak256(["address", "address"], [tokenA.target, tokenB.target]));
      const lpToken = await ethers.getContractAt("LiquidityToken", lpTokenAddress);
      const ownerLpBalance = await lpToken.balanceOf(owner.address);

      // Assert that LP tokens were minted and contract holds tokens
      expect(ownerLpBalance).to.be.gt(0);
      expect(await tokenA.balanceOf(simpleSwap.target)).to.be.gt(0);
      expect(await tokenB.balanceOf(simpleSwap.target)).to.be.gt(0);
    });

    it("Should revert if deadline expired", async () => {
      const deadline = Math.floor(Date.now() / 1000) - 1;
      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          1000,
          1000,
          900,
          900,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Expired");
    });
  });

  describe("Remove liquidity", () => {
    beforeEach(async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      await simpleSwap.addLiquidity(tokenA.target, tokenB.target, 1000, 1000, 900, 900, owner.address, deadline);
    });

    it("Should remove liquidity and transfer tokens back", async () => {
      const pairHash = await simpleSwap.getPairHash(tokenA.target, tokenB.target);
      const lpTokenAddress = await simpleSwap.getLiquidityTokenAddress(tokenA.target, tokenB.target);

      const lpToken = await ethers.getContractAt("LiquidityToken", lpTokenAddress);
      const liquidityBalance = await lpToken.balanceOf(owner.address);

      await lpToken.approve(simpleSwap.target, liquidityBalance);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      
      // Capture initial balances for verification
      const initialOwnerTokenABalance = await tokenA.balanceOf(owner.address);
      const initialOwnerTokenBBalance = await tokenB.balanceOf(owner.address);
      const initialLPBalanceOwner = await lpToken.balanceOf(owner.address);
      const initialSwapTokenABalance = await tokenA.balanceOf(simpleSwap.target);
      const initialSwapTokenBBalance = await tokenB.balanceOf(simpleSwap.target);

      // Execute the transaction directly
      const tx = await simpleSwap.removeLiquidity(
        tokenA.target,
        tokenB.target,
        liquidityBalance,
        1, // amountAMin (simplified minimums for this test)
        1, // amountBMin (simplified minimums for this test)
        owner.address,
        deadline
      );
      await tx.wait(); // Wait for the transaction to be mined

      // Verify that owner's token A and B balances have increased
      expect(await tokenA.balanceOf(owner.address)).to.be.gt(initialOwnerTokenABalance);
      expect(await tokenB.balanceOf(owner.address)).to.be.gt(initialOwnerTokenBBalance);
      // Verify that owner's LP tokens have decreased (burned)
      expect(await lpToken.balanceOf(owner.address)).to.be.lt(initialLPBalanceOwner);
      // Verify that SimpleSwap contract's token A and B balances have decreased
      expect(await tokenA.balanceOf(simpleSwap.target)).to.be.lt(initialSwapTokenABalance);
      expect(await tokenB.balanceOf(simpleSwap.target)).to.be.lt(initialSwapTokenBBalance);
    });

    it("Should revert on slippage", async () => {
      const pairHash = await simpleSwap.getPairHash(tokenA.target, tokenB.target);
      const lpTokenAddress = await simpleSwap.getLiquidityTokenAddress(tokenA.target, tokenB.target);

      const lpToken = await ethers.getContractAt("LiquidityToken", lpTokenAddress);
      const liquidityBalance = await lpToken.balanceOf(owner.address);

      await lpToken.approve(simpleSwap.target, liquidityBalance);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidityBalance,
          10_000,
          10_000,
          owner.address,
          deadline
        )
      ).to.be.revertedWith("Slippage");
    });
  });

  describe("Remove liquidity - No Liquidity Cases", () => {
    it("Should revert if no liquidity", async () => {
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
        await expect(
            simpleSwap.removeLiquidity(tokenA.target, tokenB.target, 1, 0, 0, owner.address, deadline)
        ).to.be.revertedWith("No liquidity");
    });
  });

  describe("Swap tokens", () => {
    beforeEach(async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      await simpleSwap.addLiquidity(tokenA.target, tokenB.target, 1000, 1000, 900, 900, owner.address, deadline);

      await tokenA.mint(addr1.address, 1000);
      await tokenA.connect(addr1).approve(simpleSwap.target, 1000);
    });

    it("Should swap tokens correctly", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      const path = [tokenA.target, tokenB.target];
      const amountIn = 100;

      // Capture initial balances for addr1
      const initialAddr1TokenABalance = await tokenA.balanceOf(addr1.address);
      const initialAddr1TokenBBalance = await tokenB.balanceOf(addr1.address);
      const initialSimpleSwapTokenABalance = await tokenA.balanceOf(simpleSwap.target);
      const initialSimpleSwapTokenBBalance = await tokenB.balanceOf(simpleSwap.target);

      // Execute the transaction directly
      const tx = await simpleSwap.connect(addr1).swapExactTokensForTokens(
        amountIn,
        0, // amountOutMin
        path,
        addr1.address,
        deadline
      );
      await tx.wait(); // Wait for the transaction to be mined

      // Verify balances after the transaction
      // tokenA should decrease in addr1's account
      expect(await tokenA.balanceOf(addr1.address)).to.equal(initialAddr1TokenABalance - BigInt(amountIn));
      // tokenB should increase in addr1's account (check it's greater than 0)
      expect(await tokenB.balanceOf(addr1.address)).to.be.gt(0n);

      // Verify balances in the SimpleSwap contract
      expect(await tokenA.balanceOf(simpleSwap.target)).to.equal(initialSimpleSwapTokenABalance + BigInt(amountIn));
      expect(await tokenB.balanceOf(simpleSwap.target)).to.be.lt(initialSimpleSwapTokenBBalance);
    });

    it("Should revert if deadline expired", async () => {
      const deadline = Math.floor(Date.now() / 1000) - 1;
      const path = [tokenA.target, tokenB.target];
      await expect(
        simpleSwap.connect(addr1).swapExactTokensForTokens(100, 0, path, addr1.address, deadline)
      ).to.be.revertedWith("Expired");
    });

    it("Should revert if path length not 2", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      await expect(
        simpleSwap.connect(addr1).swapExactTokensForTokens(100, 0, [tokenA.target], addr1.address, deadline)
      ).to.be.revertedWith("Only 2-token path supported");
    });
  });

  describe("getPrice", () => {
    it("Should return price correctly", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      await simpleSwap.addLiquidity(tokenA.target, tokenB.target, 1000, 2000, 900, 1800, owner.address, deadline);

      const price = await simpleSwap.getPrice(tokenA.target, tokenB.target);
      expect(price).to.be.closeTo((2000n * 1_000_000_000_000_000_000n) / 1000n, 1e10);
    });

    it("Should revert if no reserves", async () => {
      await expect(simpleSwap.getPrice(tokenA.target, tokenB.target)).to.be.revertedWith("No reserves");
    });
  });
});