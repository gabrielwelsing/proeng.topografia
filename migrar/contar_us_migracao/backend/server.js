const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Configuração do CORS para permitir que o frontend acesse esta API
app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------
// CONEXÃO COM O POSTGRESQL (CONFIGURADO PARA RAILWAY COM SSL)
// ----------------------------------------------------------------------
// O Railway geralmente exige SSL em conexões externas para evitar erros.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Fundamental para o Railway aceitar a conexão
    }
});

// ----------------------------------------------------------------------
// ROTAS DA API
// ----------------------------------------------------------------------

// Rota de Teste para verificar se o servidor está online
app.get('/', (req, res) => {
    res.json({ success: true, message: 'API Backend Node.js respondendo perfeitamente no Railway!' });
});

// Exemplo de uma rota de inserção no banco de dados (Ajuste conforme a lógica do módulo)
app.post('/api/salvar', async (req, res) => {
    try {
        const { dados } = req.body;

        // ATENÇÃO: Descomente e ajuste a query abaixo quando criar a tabela no PostgreSQL
        /*
        const query = 'INSERT INTO minha_tabela (informacao) VALUES ($1) RETURNING *';
        const values = [dados];
        const result = await pool.query(query, values);
        res.status(201).json({ success: true, data: result.rows[0] });
        */

        // Retorno de simulação caso não tenha habilitado a linha acima
        res.status(201).json({ success: true, message: 'Dados recebidos pelo backend!', payload: dados });

    } catch (error) {
        console.error('Erro na rota /api/salvar:', error);
        res.status(500).json({ success: false, error: 'Erro interno no servidor de banco de dados.' });
    }
});

// ----------------------------------------------------------------------
// INICIALIZAÇÃO DO SERVIDOR
// ----------------------------------------------------------------------
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
