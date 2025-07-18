const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy LiquidityToken for Token A
  const LiquidityToken = await hre.ethers.getContractFactory("LiquidityToken");
  const tokenA = await LiquidityToken.deploy("Token A", "TKA");
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("Token A (LiquidityToken) deployed to:", tokenAAddress);

  // Deploy LiquidityToken for Token B
  const tokenB = await LiquidityToken.deploy("Token B", "TKB");
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("Token B (LiquidityToken) deployed to:", tokenBAddress);

  // Deploy SimpleSwap
  const SimpleSwap = await hre.ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy();
  await simpleSwap.waitForDeployment();
  const simpleSwapAddress = await simpleSwap.getAddress();
  console.log("SimpleSwap deployed to:", simpleSwapAddress);

  // Deploy Faucet
  const Faucet = await hre.ethers.getContractFactory("Faucet");
  // Pass the addresses of Token A and Token B to the Faucet constructor
  const faucet = await Faucet.deploy(tokenAAddress, tokenBAddress);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("Faucet deployed to:", faucetAddress);

  // --- Initialize Faucet with test tokens ---
  // The deployer (owner of TokenA and TokenB) mints initial tokens to their own address
  // and then approves the Faucet to transfer them.

  // NOTE: Assuming your LiquidityToken's decimals are 18 (standard ERC20)
  // If not, you might need to fetch `await tokenA.decimals()` etc.
  const amountForDeployer = hre.ethers.parseUnits("1000000", 18); // Example: 1,000,000 tokens for deployer
  const amountForFaucet = hre.ethers.parseUnits("10000", 18); // Example: 10,000 tokens for Faucet initial supply

  console.log("\n--- Faucet Initialization ---");

  // Mint tokens to the deployer's address
  console.log(`Minting ${hre.ethers.formatUnits(amountForDeployer, 18)} TKA to deployer (${deployer.address})...`);
  await tokenA.mint(deployer.address, amountForDeployer);
  console.log(`Minting ${hre.ethers.formatUnits(amountForDeployer, 18)} TKB to deployer (${deployer.address})...`);
  await tokenB.mint(deployer.address, amountForDeployer);
  console.log("Tokens minted to deployer successfully.");

  // Approve the Faucet to pull tokens from the deployer
  console.log(`Approving Faucet (${faucetAddress}) to spend ${hre.ethers.formatUnits(amountForFaucet, 18)} TKA from deployer...`);
  await tokenA.approve(faucetAddress, amountForFaucet);
  console.log(`Approving Faucet (${faucetAddress}) to spend ${hre.ethers.formatUnits(amountForFaucet, 18)} TKB from deployer...`);
  await tokenB.approve(faucetAddress, amountForFaucet);
  console.log("Faucet approved to spend deployer's tokens.");

  // Replenish the Faucet with tokens from the deployer
  console.log(`Replenishing Faucet with ${hre.ethers.formatUnits(amountForFaucet, 18)} TKA and TKB...`);
  await faucet.replenish(amountForFaucet, amountForFaucet);
  console.log("Faucet replenished successfully.");

  // --- Save deployed addresses to a file ---
  const contractsDir = path.join(__dirname, '..', 'frontend', 'contractsData'); // Adjust path as needed

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const contractAddresses = {
    TokenA: tokenAAddress,
    TokenB: tokenBAddress,
    SimpleSwap: simpleSwapAddress,
    Faucet: faucetAddress,
  };

  fs.writeFileSync(
    path.join(contractsDir, 'contract-addresses.json'),
    JSON.stringify(contractAddresses, null, 2) // Pretty print JSON
  );

  console.log("\nDeployed contract addresses saved to:", path.join(contractsDir, 'contract-addresses.json'));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });