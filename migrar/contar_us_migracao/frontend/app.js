// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================
// Para testar na sua máquina, mantenha http://localhost:3001
// Para rodar no Railway, altere a URL abaixo para o link público gerado lá (ex: https://meu-backend-app.up.railway.app)
const API_URL = 'http://localhost:3001';

const logBox = document.getElementById('logBox');

function appendLog(message) {
    const time = new Date().toLocaleTimeString('pt-BR');
    logBox.innerText = `[${time}] ${message}\n` + logBox.innerText;
}

// ------------------------------------------------------------------
// Exemplo 1: Teste de Conexão Base (GET)
// ------------------------------------------------------------------
document.getElementById('btnPing').addEventListener('click', async () => {
    appendLog('Tentando conectar com: ' + API_URL + '/');
    try {
        const response = await fetch(`${API_URL}/`);
        const data = await response.json();

        if (response.ok) {
            appendLog('Sucesso: ' + JSON.stringify(data));
        } else {
            appendLog('Status Erro: ' + response.status);
        }
    } catch (error) {
        appendLog('Falha de Rede/CORS. O backend está rodando no porto 3001? (Error: ' + error.message + ')');
    }
});

// ------------------------------------------------------------------
// Exemplo 2: Envio de Dados para Salvar no Banco (POST)
// ------------------------------------------------------------------
document.getElementById('btnPost').addEventListener('click', async () => {
    appendLog('Enviando dados para: ' + API_URL + '/api/salvar');

    const bodyData = {
        dados: 'Nova informação inserida via Frontend ' + Math.floor(Math.random() * 100)
    };

    try {
        const response = await fetch(`${API_URL}/api/salvar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (response.ok) {
            appendLog('Sucesso: ' + JSON.stringify(data));
        } else {
            appendLog('Erro no Servidor: ' + JSON.stringify(data));
        }
    } catch (error) {
        appendLog('Falha de Rede/CORS. O backend está rodando? (Error: ' + error.message + ')');
    }
});
