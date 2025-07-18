const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Faucet", function () {
  let faucet;
  let tokenA;
  let tokenB;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const INITIAL_FAUCET_TOKEN_BALANCE = ethers.parseUnits("10000", 18);
  const REQUEST_AMOUNT = ethers.parseUnits("100", 18);

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const LiquidityTokenFactory = await ethers.getContractFactory("LiquidityToken");
    tokenA = await LiquidityTokenFactory.deploy("Test Token A", "TKA");
    tokenB = await LiquidityTokenFactory.deploy("Test Token B", "TKB");

    const FaucetFactory = await ethers.getContractFactory("Faucet");
    faucet = await FaucetFactory.deploy(tokenA.target, tokenB.target);

    await tokenA.connect(owner).mint(owner.address, INITIAL_FAUCET_TOKEN_BALANCE * 2n);
    await tokenB.connect(owner).mint(owner.address, INITIAL_FAUCET_TOKEN_BALANCE * 2n);

    await tokenA.connect(owner).approve(faucet.target, INITIAL_FAUCET_TOKEN_BALANCE);
    await tokenB.connect(owner).approve(faucet.target, INITIAL_FAUCET_TOKEN_BALANCE);

    await faucet.connect(owner).replenish(INITIAL_FAUCET_TOKEN_BALANCE, INITIAL_FAUCET_TOKEN_BALANCE);

    expect(await tokenA.balanceOf(faucet.target)).to.equal(INITIAL_FAUCET_TOKEN_BALANCE);
    expect(await tokenB.balanceOf(faucet.target)).to.equal(INITIAL_FAUCET_TOKEN_BALANCE);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await faucet.owner()).to.equal(owner.address);
    });

    it("Should set the correct token addresses", async function () {
      expect(await faucet.tokenA()).to.equal(tokenA.target);
      expect(await faucet.tokenB()).to.equal(tokenB.target);
    });

    it("Should have a default cooldown time of 1 day", async function () {
      expect(await faucet.cooldownTime()).to.equal(1 * 24 * 60 * 60);
    });
  });

  describe("requestTokens", function () {
    it("Should allow a user to request tokens and update their balance", async function () {
      const initialBalanceA = await tokenA.balanceOf(addr1.address);
      const initialBalanceB = await tokenB.balanceOf(addr1.address);
      const initialFaucetBalanceA = await tokenA.balanceOf(faucet.target);
      const initialFaucetBalanceB = await tokenB.balanceOf(faucet.target);

      await faucet.connect(addr1).requestTokens(addr1.address);

      expect(await tokenA.balanceOf(addr1.address)).to.equal(initialBalanceA + REQUEST_AMOUNT);
      expect(await tokenB.balanceOf(addr1.address)).to.equal(initialBalanceB + REQUEST_AMOUNT);
      expect(await tokenA.balanceOf(faucet.target)).to.equal(initialFaucetBalanceA - REQUEST_AMOUNT);
      expect(await tokenB.balanceOf(faucet.target)).to.equal(initialFaucetBalanceB - REQUEST_AMOUNT);

      const lastRequest = await faucet.lastRequestTime(addr1.address);
      expect(lastRequest).to.be.closeTo(await ethers.provider.getBlock("latest").then(block => block.timestamp), 5);
    });

    it("Should prevent a user from requesting tokens before cooldown period ends", async function () {
      await faucet.connect(addr1).requestTokens(addr1.address);

      await expect(faucet.connect(addr1).requestTokens(addr1.address))
        .to.be.revertedWith("Please wait for the cooldown period to end");
    });

    it("Should allow a user to request tokens after cooldown period ends", async function () {
      await faucet.connect(addr1).requestTokens(addr1.address);

      await ethers.provider.send("evm_increaseTime", [Number(await faucet.cooldownTime()) + 1]);
      await ethers.provider.send("evm_mine", []);

      const initialBalanceA = await tokenA.balanceOf(addr1.address);
      const initialBalanceB = await tokenB.balanceOf(addr1.address);

      await faucet.connect(addr1).requestTokens(addr1.address);

      expect(await tokenA.balanceOf(addr1.address)).to.equal(initialBalanceA + REQUEST_AMOUNT);
      expect(await tokenB.balanceOf(addr1.address)).to.equal(initialBalanceB + REQUEST_AMOUNT);
    });

    it("Should revert if recipient is address zero", async function () {
      await expect(faucet.connect(addr1).requestTokens(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid address");
    });

    it("Should revert if Faucet has insufficient Token A", async function () {
        const FaucetFactory = await ethers.getContractFactory("Faucet");
        faucet = await FaucetFactory.deploy(tokenA.target, tokenB.target);

        const insufficientAmountA = REQUEST_AMOUNT - ethers.parseUnits("1", 18);
        await tokenA.connect(owner).approve(faucet.target, insufficientAmountA);
        await tokenB.connect(owner).approve(faucet.target, INITIAL_FAUCET_TOKEN_BALANCE);

        await faucet.connect(owner).replenish(insufficientAmountA, INITIAL_FAUCET_TOKEN_BALANCE);

        await expect(faucet.connect(addr1).requestTokens(addr1.address))
            .to.be.revertedWith("Insufficient Token A in Faucet");
    });

    it("Should revert if Faucet has insufficient Token B", async function () {
        const FaucetFactory = await ethers.getContractFactory("Faucet");
        faucet = await FaucetFactory.deploy(tokenA.target, tokenB.target);

        const insufficientAmountB = REQUEST_AMOUNT - ethers.parseUnits("1", 18);
        await tokenA.connect(owner).approve(faucet.target, INITIAL_FAUCET_TOKEN_BALANCE);
        await tokenB.connect(owner).approve(faucet.target, insufficientAmountB);

        await faucet.connect(owner).replenish(INITIAL_FAUCET_TOKEN_BALANCE, insufficientAmountB);

        await expect(faucet.connect(addr1).requestTokens(addr1.address))
            .to.be.revertedWith("Insufficient Token B in Faucet");
    });
  });

  describe("replenish", function () {
    it("Should allow the owner to replenish tokens", async function () {
      const replenishAmountA = ethers.parseUnits("500", 18);
      const replenishAmountB = ethers.parseUnits("700", 18);

      const initialFaucetBalanceA = await tokenA.balanceOf(faucet.target);
      const initialFaucetBalanceB = await tokenB.balanceOf(faucet.target);
      const initialOwnerBalanceA = await tokenA.balanceOf(owner.address);
      const initialOwnerBalanceB = await tokenB.balanceOf(owner.address);

      await tokenA.connect(owner).approve(faucet.target, replenishAmountA);
      await tokenB.connect(owner).approve(faucet.target, replenishAmountB);

      await faucet.connect(owner).replenish(replenishAmountA, replenishAmountB);

      expect(await tokenA.balanceOf(faucet.target)).to.equal(initialFaucetBalanceA + replenishAmountA);
      expect(await tokenB.balanceOf(faucet.target)).to.equal(initialFaucetBalanceB + replenishAmountB);
      expect(await tokenA.balanceOf(owner.address)).to.equal(initialOwnerBalanceA - replenishAmountA);
      expect(await tokenB.balanceOf(owner.address)).to.equal(initialOwnerBalanceB - replenishAmountB);
    });

    it("Should prevent non-owners from calling replenish", async function () {
      await expect(faucet.connect(addr1).replenish(ethers.parseUnits("100", 18), ethers.parseUnits("100", 18)))
        .to.be.revertedWithCustomError(faucet, "OwnableUnauthorizedAccount");
    });

    it("Should revert if owner has not approved Faucet to spend tokens", async function () {
      const replenishAmountA = ethers.parseUnits("500", 18);
      const replenishAmountB = ethers.parseUnits("700", 18);

      await expect(faucet.connect(owner).replenish(replenishAmountA, replenishAmountB))
        .to.be.revertedWithCustomError(tokenA, "ERC20InsufficientAllowance");
    });
  });

  describe("getFaucetBalances", function () {
    it("Should return the correct balances of Token A and Token B in the Faucet", async function () {
      const [balanceA, balanceB] = await faucet.getFaucetBalances();
      expect(balanceA).to.equal(await tokenA.balanceOf(faucet.target));
      expect(balanceB).to.equal(await tokenB.balanceOf(faucet.target));
    });
  });
});