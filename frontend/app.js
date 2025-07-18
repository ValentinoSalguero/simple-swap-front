const contractAddresses = {
  "TokenA": "0xEd10552af215D5D79C4DDF09B681Ef5f12dA583B",
  "TokenB": "0xF2D56ad8054FBAF63C2ba905e629168B8d417d3c",
  "SimpleSwap": "0x6E9a1094F91d7aFD3232305E0b28427A2d680309",
  "Faucet": "0xd6856E315fF399148E5d03b5605406fc063a9F8E"
};

const tokenAAddress = contractAddresses.TokenA;
const tokenBAddress = contractAddresses.TokenB;
const simpleSwapAddress = contractAddresses.SimpleSwap;
const faucetAddress = contractAddresses.Faucet;

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
  "function mint(address to, uint amount) external", // Aunque mint es para el owner del token, la incluimos si se necesita interactuar con ella directamente
  "function balanceOf(address account) view returns (uint)" // Añadido para actualizar balances
];

// ABI para el contrato Faucet.
const faucetABI = [
  "function requestTokens(address recipient) public",
  "function cooldownTime() public view returns (uint)",
  "function lastRequestTime(address) public view returns (uint)",
  "function tokenA() public view returns (address)",
  "function tokenB() public view returns (address)",
  "function getFaucetBalances() public view returns (uint, uint)"
];

let provider;
let signer;
let simpleSwapContract;
let tokenAContract;
let tokenBContract;
let faucetContract; // Variable para el contrato Faucet

const outputP = document.getElementById("output");
const walletAddressP = document.getElementById("walletAddress");
const balanceAText = document.getElementById("balanceA");
const balanceBText = document.getElementById("balanceB");
const faucetBalanceAText = document.getElementById("faucetBalanceA");
const faucetBalanceBText = document.getElementById("faucetBalanceB");


// Muestra mensajes en la interfaz de usuario con formato de color.
function showMessage(msg, type = "info") {
  outputP.style.color = type === "error" ? "red" : type === "success" ? "green" : "black";
  outputP.innerText = msg;
}

// Valida que el valor sea un número positivo.
function isValidAmount(value) {
  return !isNaN(value) && Number(value) > 0;
}

// Actualiza los balances de los tokens A y B en la interfaz
async function updateBalances() {
    if (signer && tokenAContract && tokenBContract) {
        const address = await signer.getAddress();
        const balanceA = await tokenAContract.balanceOf(address);
        const balanceB = await tokenBContract.balanceOf(address);

        const decimalsA = await tokenAContract.decimals();
        const decimalsB = await tokenBContract.decimals();

        balanceAText.innerText = `Balance Token A: ${ethers.utils.formatUnits(balanceA, decimalsA)}`;
        balanceBText.innerText = `Balance Token B: ${ethers.utils.formatUnits(balanceB, decimalsB)}`;
    }

    if (faucetContract) {
        const [faucetBalanceA, faucetBalanceB] = await faucetContract.getFaucetBalances();
        const decimalsA = await tokenAContract.decimals();
        const decimalsB = await tokenBContract.decimals();
        faucetBalanceAText.innerText = `Faucet TKA: ${ethers.utils.formatUnits(faucetBalanceA, decimalsA)}`;
        faucetBalanceBText.innerText = `Faucet TKB: ${ethers.utils.formatUnits(faucetBalanceB, decimalsB)}`;
    }
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
    tokenAContract = new ethers.Contract(tokenAAddress, erc20ABI, signer); // Usar tokenAAddress
    tokenBContract = new ethers.Contract(tokenBAddress, erc20ABI, signer); // Usar tokenBAddress
    faucetContract = new ethers.Contract(faucetAddress, faucetABI, signer); // Inicializar Faucet

    const address = await signer.getAddress();
    walletAddressP.innerText = "Wallet conectada: " + address;
    showMessage("Wallet conectada correctamente.");

    // Actualizar balances iniciales al conectar
    await updateBalances();

    // Escuchar cambios de cuenta o red
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            signer = provider.getSigner(accounts[0]);
            walletAddressP.innerText = "Wallet conectada: " + accounts[0];
            updateBalances();
        } else {
            walletAddressP.innerText = "No conectado";
            balanceAText.innerText = "Balance Token A: 0";
            balanceBText.innerText = "Balance Token B: 0";
            faucetBalanceAText.innerText = "Faucet TKA: 0";
            faucetBalanceBText.innerText = "Faucet TKB: 0";
            showMessage("Wallet desconectada.");
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        // Recargar la página o reinicializar contratos si la red cambia
        window.location.reload();
    });

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
      tokenAAddress, // Usar tokenAAddress
      tokenBAddress, // Usar tokenBAddress
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
    await updateBalances(); // Actualiza balances después de agregar liquidez
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
    const decimals = await (path[0] === tokenAAddress ? tokenAContract : tokenBContract).decimals(); // Usar tokenAAddress
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
    showMessage(`Swap ${path[0] === tokenAAddress ? "A->B" : "B->A"} realizado con éxito!`, "success"); // Usar tokenAAddress
    await updateBalances(); // Actualiza balances después del swap
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
    // Obtener los decimales de tokenOut para formatear correctamente el precio
    const tokenOutDecimals = await (tokenOut === tokenAAddress ? tokenAContract : tokenBContract).decimals();

    showMessage(`Precio token ${tokenIn === tokenAAddress ? "A en B" : "B en A"}: ${ethers.utils.formatUnits(price, tokenOutDecimals)}`);
  } catch (error) {
    showMessage("Error obteniendo precio: " + (error.data?.message || error.message), "error");
  }
}

// Nueva función para solicitar tokens del Faucet.
async function requestTokensFromFaucet() {
    if (!faucetContract || !signer) {
        alert("Por favor conecta tu wallet primero.");
        return;
    }

    try {
        const userAddress = await signer.getAddress();
        const lastTime = await faucetContract.lastRequestTime(userAddress);
        const cooldown = await faucetContract.cooldownTime();
        const currentTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos

        if (currentTime < lastTime.toNumber() + cooldown.toNumber()) {
            const timeLeft = (lastTime.toNumber() + cooldown.toNumber()) - currentTime;
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;
            alert(`Debes esperar ${hours}h ${minutes}m ${seconds}s antes de solicitar de nuevo.`);
            return;
        }

        console.log("Requesting tokens from Faucet for:", userAddress);
        showMessage("Solicitando tokens del Faucet, esperando confirmación...");
        const tx = await faucetContract.requestTokens(userAddress);
        await tx.wait();
        showMessage("Tokens solicitados exitosamente del Faucet!", "success");
        console.log("Tokens received from Faucet.");
        await updateBalances(); // Actualizar balances en la UI después de recibir tokens
    } catch (error) {
        console.error("Error requesting tokens from Faucet:", error);
        // Filtrar mensajes de error comunes o específicos del contrato
        let errorMessage = "Error al solicitar tokens del Faucet. Revisa la consola para más detalles.";
        if (error.code === 4001) { // User denied transaction
            errorMessage = "Transacción denegada por el usuario.";
        } else if (error.data && error.data.message) {
            errorMessage = error.data.message;
        } else if (error.message) {
            errorMessage = error.message;
        }
        showMessage(errorMessage, "error");
    }
}


// Asigna los event listeners a los botones.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("connectWalletBtn").onclick = connectWallet;
    document.getElementById("addLiquidityBtn").onclick = addLiquidity;
    document.getElementById("swapAtoB").onclick = () => {
      const amount = Number(document.getElementById("swapAmount").value);
      swapTokens(amount, [tokenAAddress, tokenBAddress]); // Usar tokenAAddress
    };
    document.getElementById("swapBtoA").onclick = () => {
      const amount = Number(document.getElementById("swapAmount").value);
      swapTokens(amount, [tokenBAddress, tokenAAddress]); // Usar tokenBAddress
    };
    document.getElementById("getPriceAinB").onclick = () => getPrice(tokenAAddress, tokenBAddress); // Usar tokenAAddress
    document.getElementById("getPriceBinA").onclick = () => getPrice(tokenBAddress, tokenAAddress); // Usar tokenBAddress

    document.getElementById("approveTokenA").onclick = () => approveToken(tokenAContract);
    document.getElementById("approveTokenB").onclick = () => approveToken(tokenBContract);

    // Event listener para el botón del Faucet
    document.getElementById("requestFaucetTokens").onclick = requestTokensFromFaucet;

    // Inicializar balances al cargar si ya está conectado
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet(); // Reconectar si ya hay una cuenta seleccionada
    }
});