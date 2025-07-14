const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const LiquidityToken = await hre.ethers.getContractFactory("LiquidityToken");
  const tokenA = await LiquidityToken.deploy("Token A", "TKA");
  console.log("Token A deployed to:", tokenA.target);

  const tokenB = await LiquidityToken.deploy("Token B", "TKB");
  console.log("Token B deployed to:", tokenB.target);

  const SimpleSwap = await hre.ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy();
  console.log("SimpleSwap deployed to:", simpleSwap.target);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
