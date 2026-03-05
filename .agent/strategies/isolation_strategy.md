# Estratégia de Isolamento de Infraestrutura (SaaS Multi-App)

Para garantir que um novo projeto não quebre sistemas legados ou misture dados sensíveis, seguimos a estratégia do "Novo Terreno".

## 1. Projeto Firebase Independente
- **Isolamento de Dados**: Cada SaaS deve ter seu próprio ID de projeto no Firebase (ex: `ecossistema-pro-db` vs `conversao-fotos-antigo`).
- **Segurança Específica**: Regras de Firestore mais rígidas podem ser aplicadas no novo sem afetar a flexibilidade do antigo.

## 2. Gerenciamento de Ambientes (Env Vars)
- **Zero Hardcoding**: Nenhuma chave de API ou ID de projeto deve estar "chumbada" no código.
- **Hierarquia de Fallback**: No `firebase.ts`, usamos `process.env` com fallback para as chaves antigas. Isso garante que o mesmo código funcione em ambientes diferentes apontando para bancos diferentes conforme a configuração da hospedagem (Vercel).

## 3. Billing e Custo
- **Créditos Separados**: Ao criar um novo projeto GCP/Firebase, vinculamos a conta de faturamento para liberar recursos (ex: Cloud Functions), mas mantemos o monitoramento isolado para evitar surpresas de custo em escala.

---
*Assinado: Antigravity (IA)*
