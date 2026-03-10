# Guia de Deploy no Railway (com Frontend e Backend Separados)

A melhor forma de subir sistemas profissionais, escaláveis e aceitar SSL para serviços terceiros (como PostgreSQL) na nuvem, sem gerar conflitos de build, é hospedar o Frontend e o Backend **de forma independente**. 

Isso significa que você subirá duas pastas separadas. Sugerimos a criação de dois repositórios no GitHub (ou que arraste pastas separadas em sua CLI, se aplicável).

---

## Passo Inicial: Banco de Dados PostgreSQL

1. Entre no **Railway**.
2. Clique em **New Project** -> **Provision PostgreSQL**.
3. O Railway criará o banco. Clique nele, vá na aba **Connect**, e copie a **Railway's Database URL** (semelhante a `postgresql://postgres:senha@xyz.railway.app:5432/railway`).

---

## 🏗️ 1. Fazendo Deploy do Backend (Node.js)

O Backend será responsável pela infraestrutura e conexão direta via pacote `pg`.

1. **Repositório GitHub:** Suba apenas a pasta `backend` para o seu GitHub como um repositório isolado (ex: `meu-modulo-backend`).
    - Certifique-se de que os arquivos `package.json` e `server.js` estão na raiz deste novo repositório, soltos.
2. **Deploy via Railway:**
    - Clique em **New Service** no Railway e escolha **Deploy from GitHub repo**.
    - Conecte o repositório do backend recém criado.
    - O Railway detectará e rodará os comandos automaticamente `npm install` e `npm start`.
3. **Variáveis de Ambiente:**
    - Vá nas configurações (*Variables*) desse serviço no painel do Railway.
    - Adicione a chave `DATABASE_URL` e cole a string copiada do PostgreSQL. (Opcional, adicione `PORT=3000`).
4. **Finalizando:**
    - Crie um link público (*Domain*) nas settings do serviço (ex: `https://meu-backend.up.railway.app`). Esse é o caminho da sua API.
    - Note: O `server.js` já possui o sufixo especial `ssl: { rejectUnauthorized: false }` para conectar-se em servidores estritos como o do próprio Railway.

---

## 🎨 2. Configurando o Frontend

O Frontend só precisa se comunicar com a URL pública gerada no passo acima.

1. **Alterar Rota:** 
    - Abra `frontend/app.js`.
    - Localize a linha base: `const API_URL = 'http://localhost:3001';`.
    - Altere pela URL pública do seu Backend recém-criada (ex: `const API_URL = 'https://meu-backend.up.railway.app';`).
2. **Deploy:**
    - Você pode hospedar a pasta `frontend` em qualquer provedor de hospedagem estática ou moderna: **Vercel, Netlify, Cloudflare Pages, ou mesmo no próprio Railway** (criando um Empty Service e subindo arquivos lá).
    - O Frontend sempre consultará e enviará requisições ao Backend sem gerar recarregamento completo dos componentes estáticos ou bloqueios de CORS, pois o servidor já está parametrizado.
