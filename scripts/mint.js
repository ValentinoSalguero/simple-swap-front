const { JsonRpcProvider, Wallet, Contract, parseUnits } = require("ethers");

async function main() {
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const owner = new Wallet(privateKey, provider);

  const tokenAAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F"; 
  const tokenBAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  const erc20Abi = [
    "function mint(address to, uint256 amount) external",
    "function decimals() view returns (uint8)"
  ];

  const tokenA = new Contract(tokenAAddress, erc20Abi, owner);
  const tokenB = new Contract(tokenBAddress, erc20Abi, owner);

  const recipient = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";

  const decimalsA = await tokenA.decimals();
  const decimalsB = await tokenB.decimals();

  const amount = parseUnits("1000", decimalsA);
  const amountB = parseUnits("1000", decimalsB);

  console.log("Minteando Token A...");
  const nonceA = await owner.getNonce(); 
  console.log(`Nonce para Token A: ${nonceA}`);
  const txA = await tokenA.mint(recipient, amount, { nonce: nonceA });
  await txA.wait(); 
  console.log("Token A minteado. Hash de la transacción:", txA.hash);

  console.log("Minteando Token B...");
  const nonceB = nonceA + 1; 
  console.log(`Nonce para Token B: ${nonceB}`);
  const txB = await tokenB.mint(recipient, amountB, { nonce: nonceB });
  await txB.wait(); 
  console.log("Token B minteado. Hash de la transacción:", txB.hash);

  console.log("✅ Tokens minteados exitosamente para:", recipient);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
