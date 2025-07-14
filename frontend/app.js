const tokenA = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
const tokenB = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const simpleSwapAddress = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";

const simpleSwapABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint,uint,uint)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getPrice(address tokenA, address tokenB) external view returns (uint)"
];

const erc20ABI = [
  "function approve(address spender, uint amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
  "function mint(address to, uint amount) external"
];

let provider;
let signer;
let simpleSwapContract;
let tokenAContract;
let tokenBContract;

const outputP = document.getElementById("output");

// Muestra mensajes en output con color segun tipo: info, success, error
function showMessage(msg, type = "info") {
  outputP.style.color = type === "error" ? "red" : type === "success" ? "green" : "black";
  outputP.innerText = msg;
}

// Valida que el valor sea un número positivo mayor a 0
function isValidAmount(value) {
  return !isNaN(value) && Number(value) > 0;
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("Por favor instala MetaMask");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();

    simpleSwapContract = new ethers.Contract(simpleSwapAddress, simpleSwapABI, signer);
    tokenAContract = new ethers.Contract(tokenA, erc20ABI, signer);
    tokenBContract = new ethers.Contract(tokenB, erc20ABI, signer);

    const address = await signer.getAddress();
    document.getElementById("walletAddress").innerText = "Wallet conectada: " + address;
    showMessage("Wallet conectada correctamente");
  } catch (error) {
    showMessage("Error conectando wallet: " + error.message, "error");
  }
}

async function approveToken(tokenContract) {
  // Bloquear botones para evitar doble click
  document.getElementById("approveTokenA").disabled = true;
  document.getElementById("approveTokenB").disabled = true;

  try {
    // Solo aprobar, sin mint ni verificación de owner
    const maxApproval = ethers.constants.MaxUint256;
    const tx = await tokenContract.approve(simpleSwapAddress, maxApproval);
    showMessage("Aprobación enviada, esperando confirmación...");
    await tx.wait();
    showMessage("Token aprobado para SimpleSwap.", "success");
  } catch (error) {
    showMessage("Error en approve: " + (error.data?.message || error.message), "error");
  } finally {
    // Habilitar botones
    document.getElementById("approveTokenA").disabled = false;
    document.getElementById("approveTokenB").disabled = false;
  }
}


async function addLiquidity() {
  document.getElementById("addLiquidityBtn").disabled = true;
  try {
    const amountADesired = document.getElementById("amountADesired").value;
    const amountBDesired = document.getElementById("amountBDesired").value;

    if (!isValidAmount(amountADesired) || !isValidAmount(amountBDesired)) {
      alert("Ingrese cantidades válidas y mayores que cero para ambos tokens.");
      document.getElementById("addLiquidityBtn").disabled = false;
      return;
    }

    const decimalsA = await tokenAContract.decimals();
    const decimalsB = await tokenBContract.decimals();

    const amountADesiredParsed = ethers.utils.parseUnits(amountADesired.toString(), decimalsA);
    const amountBDesiredParsed = ethers.utils.parseUnits(amountBDesired.toString(), decimalsB);

    const amountAMin = 0;
    const amountBMin = 0;
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const tx = await simpleSwapContract.addLiquidity(
      tokenA,
      tokenB,
      amountADesiredParsed,
      amountBDesiredParsed,
      amountAMin,
      amountBMin,
      await signer.getAddress(),
      deadline
    );

    showMessage("Agregando liquidez, espera confirmación...");
    await tx.wait();
    showMessage("Liquidez agregada con éxito", "success");
  } catch (error) {
    showMessage("Error agregando liquidez: " + (error.data?.message || error.message), "error");
  } finally {
    document.getElementById("addLiquidityBtn").disabled = false;
  }
}

async function swapTokens(amount, path) {
  const swapAtoBBtn = document.getElementById("swapAtoB");
  const swapBtoABtn = document.getElementById("swapBtoA");
  swapAtoBBtn.disabled = true;
  swapBtoABtn.disabled = true;

  try {
    if (!isValidAmount(amount)) {
      alert("Ingresa una cantidad válida mayor que cero");
      return;
    }

    const decimals = await (path[0] === tokenA ? tokenAContract : tokenBContract).decimals();
    const amountParsed = ethers.utils.parseUnits(amount.toString(), decimals);
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const tx = await simpleSwapContract.swapExactTokensForTokens(
      amountParsed,
      0,
      path,
      await signer.getAddress(),
      deadline
    );

    showMessage("Swap enviado, esperando confirmación...");
    await tx.wait();
    showMessage(`Swap ${path[0] === tokenA ? "A->B" : "B->A"} realizado con éxito!`, "success");
  } catch (error) {
    showMessage("Error en swap: " + (error.data?.message || error.message), "error");
  } finally {
    swapAtoBBtn.disabled = false;
    swapBtoABtn.disabled = false;
  }
}

async function getPrice(tokenIn, tokenOut) {
  try {
    const price = await simpleSwapContract.getPrice(tokenIn, tokenOut);
    showMessage(`Precio token ${tokenIn === tokenA ? "A en B" : "B en A"}: ${ethers.utils.formatUnits(price, 18)}`);
  } catch (error) {
    showMessage("Error obteniendo precio: " + (error.data?.message || error.message), "error");
  }
}

document.getElementById("connectWalletBtn").onclick = connectWallet;
document.getElementById("addLiquidityBtn").onclick = addLiquidity;
document.getElementById("swapAtoB").onclick = () => {
  const amount = Number(document.getElementById("swapAmount").value);
  swapTokens(amount, [tokenA, tokenB]);
};
document.getElementById("swapBtoA").onclick = () => {
  const amount = Number(document.getElementById("swapAmount").value);
  swapTokens(amount, [tokenB, tokenA]);
};
document.getElementById("getPriceAinB").onclick = () => getPrice(tokenA, tokenB);
document.getElementById("getPriceBinA").onclick = () => getPrice(tokenB, tokenA);

document.getElementById("approveTokenA").onclick = () => approveToken(tokenAContract);
document.getElementById("approveTokenB").onclick = () => approveToken(tokenBContract);