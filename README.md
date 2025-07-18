# Trabajo Práctico Módulo 4: SimpleSwap - Frontend y Testing

Este proyecto corresponde al Trabajo Práctico del Módulo 4, enfocado en la creación de un frontend interactivo y el testing exhaustivo del contrato `SimpleSwap` desarrollado en el Módulo 3.

## 📢 Requerimientos Cumplidos:

### 1. Interacción con el contrato (Frontend)
Se ha desarrollado un frontend web (ubicado en la carpeta `frontend/`) que permite la interacción completa con el contrato `SimpleSwap`. Las funcionalidades clave incluyen:
* **Conexión de billetera:** Permite a los usuarios conectar su monedero Web3 (ej. MetaMask).
* **Intercambio de Tokens (Swap):** Habilita la función para intercambiar el Token A por el Token B y viceversa.
* **Obtención de Precio:** Permite obtener el precio de un token en función del otro.

### 2. Entorno de Desarrollo y Testing
El proyecto está implementado utilizando **Hardhat** para el desarrollo de contratos inteligentes y el entorno de pruebas.
* **Testing:** Se han desarrollado tests unitarios para el contrato `SimpleSwap`, logrando una cobertura de código superior al 50%.
    * Para ejecutar los tests: `npx hardhat test`
    * Para ver la cobertura de los tests: `npx hardhat coverage`

### 3. Recomendaciones del Instructor
Todas las recomendaciones proporcionadas por el instructor durante la revisión del contrato `SimpleSwap` en el Módulo 3 han sido implementadas en este trabajo.

### 4. Herramientas Utilizadas
El frontend ha sido desarrollado utilizando **HTML, CSS y JavaScript puro**, garantizando una interacción directa y ligera con el contrato inteligente.

### 5. Almacenamiento y Despliegue
* **Repositorio GitHub:** Todo el código fuente, incluyendo los contratos, tests y el frontend, se encuentra alojado en este repositorio de GitHub para su evaluación.
* **Despliegue del Frontend:** El frontend está desplegado en **GitHub Pages**. Puedes acceder a la aplicación en vivo a través del siguiente enlace:
    [https://simpleswap-front-tp4.netlify.app/]

---

## 🛠️ Cómo Iniciar el Proyecto (Localmente)

Para ejecutar este proyecto localmente, sigue los siguientes pasos:

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/tu-repositorio.git](https://github.com/tu-usuario/tu-repositorio.git)
    cd tu-repositorio
    ```

2.  **Instalar dependencias de Hardhat:**
    ```bash
    npm install
    # o
    yarn install
    ```

3.  **Compilar los contratos:**
    ```bash
    npx hardhat compile
    ```

4.  **Ejecutar los tests (opcional):**
    ```bash
    npx hardhat test
    # Para ver la cobertura
    npx hardhat coverage
    ```

5.  **Iniciar un nodo local de Hardhat (para despliegue local):**
    ```bash
    npx hardhat node
    ```

6.  **Desplegar el contrato `SimpleSwap` en la red local:**
    *(Asumiendo que tienes un script de despliegue, por ejemplo, en `scripts/deploy.js` o `ignition/modules/SimpleSwap.js`)*
    ```bash
    # Si usas un script simple (ej. scripts/deploy.js)
    npx hardhat run scripts/deploy.js --network localhost

    # Si usas Hardhat Ignition (basado en tu estructura)
    npx hardhat ignition deploy ./ignition/modules/SimpleSwap.js --network localhost
    ```
    **Nota:** Asegúrate de copiar la dirección del contrato desplegado para usarla en tu frontend.

7.  **Abrir el Frontend:**
    Navega a la carpeta `frontend/` y abre el archivo `index.html` en tu navegador web.
    ```bash
    cd frontend/
    # Luego, abre index.html con tu navegador preferido o un servidor local como `live-server`
    ```
    Asegúrate de que tu `script.js` en el frontend esté configurado para conectarse a la dirección del contrato desplegado en tu red local.

---

## ✅ Entregables para Evaluación:

* **Enlace al Repositorio en GitHub:** [https://github.com/ValentinoSalguero/simple-swap-front]
* **URL del Trabajo Desplegado:** [https://simpleswap-front-tp4.netlify.app/]

---
