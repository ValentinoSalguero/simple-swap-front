const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityToken", function () {
  let LiquidityToken, liquidityToken, owner, addr1;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    liquidityToken = await ethers.deployContract("LiquidityToken", ["LP Token", "LPT"]);
  });

  it("Should have correct name and symbol", async () => {
    expect(await liquidityToken.name()).to.equal("LP Token");
    expect(await liquidityToken.symbol()).to.equal("LPT");
  });

  it("Owner can mint tokens", async () => {
    await liquidityToken.mint(addr1.address, 1000);
    expect(await liquidityToken.balanceOf(addr1.address)).to.equal(1000);
  });

  it("Non-owner cannot mint tokens", async () => {
    await expect(liquidityToken.connect(addr1).mint(addr1.address, 1000))
    .to.be.revertedWithCustomError(liquidityToken, "OwnableUnauthorizedAccount");
  });

  it("Owner can burn tokens", async () => {
    await liquidityToken.mint(addr1.address, 1000);
    await liquidityToken.burn(addr1.address, 500);
    expect(await liquidityToken.balanceOf(addr1.address)).to.equal(500);
  });

  it("Non-owner cannot burn tokens", async () => {
    await liquidityToken.mint(addr1.address, 1000);
    await expect(liquidityToken.connect(addr1).burn(addr1.address, 500))
    .to.be.revertedWithCustomError(liquidityToken, "OwnableUnauthorizedAccount");
  });
});