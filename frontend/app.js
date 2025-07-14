const tokenA = "0xEd10552af215D5D79C4DDF09B681Ef5f12dA583B";
const tokenB = "0xF2D56ad8054FBAF63C2ba905e629168B8d417d3c";
const simpleSwapAddress = "0x6E9a1094F91d7aFD3232305E0b28427A2d680309";

// ABI mínimo para el contrato SimpleSwap, solo las funciones necesarias para el frontend.
const simpleSwapABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint,uint,uint)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getPrice(address tokenA, address tokenB) external view returns (uint)"
];

// ABI mínimo para tokens ERC20, solo las funciones necesarias.
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

// Muestra mensajes en la interfaz de usuario con formato de color.
function showMessage(msg, type = "info") {
  outputP.style.color = type === "error" ? "red" : type === "success" ? "green" : "black";
  outputP.innerText = msg;
}

// Valida que el valor sea un número positivo.
function isValidAmount(value) {
  return !isNaN(value) && Number(value) > 0;
}

// Conecta la billetera del usuario a la DApp.
async function connectWallet() {
  if (!window.ethereum) {
    alert("Por favor instala MetaMask para usar esta aplicación.");
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
    showMessage("Wallet conectada correctamente.");
  } catch (error) {
    showMessage("Error conectando wallet: " + error.message, "error");
  }
}

// Aprueba que SimpleSwap gaste una cantidad ilimitada del token del usuario.
async function approveToken(tokenContract) {
  // Deshabilita los botones de aprobación para evitar múltiples clics.
  document.getElementById("approveTokenA").disabled = true;
  document.getElementById("approveTokenB").disabled = true;

  try {
    const maxApproval = ethers.constants.MaxUint256; // Cantidad máxima para aprobación ilimitada.
    const tx = await tokenContract.approve(simpleSwapAddress, maxApproval);
    showMessage("Aprobación enviada, esperando confirmación...");
    await tx.wait();
    showMessage("Token aprobado para SimpleSwap.", "success");
  } catch (error) {
    showMessage("Error en approve: " + (error.data?.message || error.message), "error");
  } finally {
    // Habilita los botones de aprobación.
    document.getElementById("approveTokenA").disabled = false;
    document.getElementById("approveTokenB").disabled = false;
  }
}

// Agrega liquidez al pool SimpleSwap.
async function addLiquidity() {
  document.getElementById("addLiquidityBtn").disabled = true; // Deshabilita el botón.
  try {
    const amountADesired = document.getElementById("amountADesired").value;
    const amountBDesired = document.getElementById("amountBDesired").value;

    if (!isValidAmount(amountADesired) || !isValidAmount(amountBDesired)) {
      alert("Ingrese cantidades válidas y mayores que cero para ambos tokens.");
      document.getElementById("addLiquidityBtn").disabled = false;
      return;
    }

    // Obtiene los decimales de los tokens para parsear correctamente las cantidades.
    const decimalsA = await tokenAContract.decimals();
    const decimalsB = await tokenBContract.decimals();

    const amountADesiredParsed = ethers.utils.parseUnits(amountADesired.toString(), decimalsA);
    const amountBDesiredParsed = ethers.utils.parseUnits(amountBDesired.toString(), decimalsB);

    const amountAMin = 0; // Se podría hacer configurable en la UI.
    const amountBMin = 0; // Se podría hacer configurable en la UI.
    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutos de tolerancia.

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
    showMessage("Liquidez agregada con éxito.", "success");
  } catch (error) {
    showMessage("Error agregando liquidez: " + (error.data?.message || error.message), "error");
  } finally {
    document.getElementById("addLiquidityBtn").disabled = false; // Habilita el botón.
  }
}

// Realiza un swap de tokens.
async function swapTokens(amount, path) {
  // Deshabilita los botones de swap.
  const swapAtoBBtn = document.getElementById("swapAtoB");
  const swapBtoABtn = document.getElementById("swapBtoA");
  swapAtoBBtn.disabled = true;
  swapBtoABtn.disabled = true;

  try {
    if (!isValidAmount(amount)) {
      alert("Ingresa una cantidad válida mayor que cero");
      return;
    }

    // Obtiene los decimales del token de entrada para parsear la cantidad.
    const decimals = await (path[0] === tokenA ? tokenAContract : tokenBContract).decimals();
    const amountParsed = ethers.utils.parseUnits(amount.toString(), decimals);
    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutos de tolerancia.

    const tx = await simpleSwapContract.swapExactTokensForTokens(
      amountParsed,
      0, // amountOutMin (se podría hacer configurable en la UI)
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
    // Habilita los botones de swap.
    swapAtoBBtn.disabled = false;
    swapBtoABtn.disabled = false;
  }
}

// Obtiene y muestra el precio de un token en términos de otro.
async function getPrice(tokenIn, tokenOut) {
  try {
    const price = await simpleSwapContract.getPrice(tokenIn, tokenOut);
    showMessage(`Precio token ${tokenIn === tokenA ? "A en B" : "B en A"}: ${ethers.utils.formatUnits(price, 18)}`);
  } catch (error) {
    showMessage("Error obteniendo precio: " + (error.data?.message || error.message), "error");
  }
}

// Asigna los event listeners a los botones.
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
