---
description: Padrão arquitetural para desenvolvimento e hospedagem de novos aplicativos (Railway + Node.js + Postgres)
---

# Padrão de Arquitetura para Novos Aplicativos

A partir de agora, **TODOS os novos aplicativos e módulos** desenvolvidos para o sistema deverão seguir estritamente o modelo de arquitetura descrito abaixo, conforme exigência do usuário.

## O Prompt Arquitetural Principal
Sempre que for solicitado a criar um novo "app", "módulo" ou "sistema", aplique as seguintes regras como fundação do seu código:

> "Preciso criar um sistema profissional para ser hospedado no Railway com Banco de Dados PostgreSQL ou MongoDB . Não quero um site estático (apenas HTML), preciso da estrutura separada em Frontend e Backend.
> Por favor, gere para mim:
> 
> **BACKEND (Node.js + Express):**
> Configure um servidor que utilize o pacote pg para conectar ao PostgreSQL.
> Use variáveis de ambiente para a conexão: process.env.DATABASE_URL.
> Inclua suporte a CORS para que o frontend consiga acessar a API.
> Crie uma rota de teste GET / e uma estrutura básica de rota para o que meu sistema precisa (ex: salvar dados no banco).
> Forneça o arquivo package.json com os scripts de start e as dependências necessárias.
> 
> **FRONTEND:**
> Crie a interface (HTML/JS ou React) de forma que ela consuma a API do backend.
> Importante: A URL da API deve ser facilmente alterável (ex: uma constante API_URL) para eu trocar pelo link de produção do Railway depois.
> 
> **ESTRUTURA DE ARQUIVOS:**
> Mostre como devo organizar as pastas para subir no GitHub
> Observação: O foco é que o sistema seja escalável e aceite a conexão SSL do Railway para o banco de dados."

## Diretrizes de Implementação Limpa
1. **Separação de Repositórios:** O Frontend e o Backend **devem** estar em diretórios fisicamente separados para facilitar deploys independentes no GitHub e no Railway.
2. **Conexão SSL Mandatória:** No Node.js (Backend), o `Pool` de conexão do `pg` *sempre* deve conter o parâmetro `ssl: { rejectUnauthorized: false }`. O Railway rejeitará conexões externas sem isso.
3. **Gerência de API:** No frontend, concentre as chamadas (fetch) usando uma variável `API_URL` global, para que o usuário não precise caçar URLs soltas no código na hora do deploy.
