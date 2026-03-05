# Estratégia de Deployment e Proteção (Vercel)

Esta estratégia evita erros comuns de acesso e garante que a marca do SaaS seja preservada, sem redirecionamentos confusos para a plataforma de hospedagem.

## 1. Desativar "Deployment Protection"
- **O Problema**: A Vercel costuma ativar por padrão a "Vercel Authentication", que exige login na Vercel para ver o site. Isso mata o funil de usuários do SaaS.
- **A Solução**: Em `Settings -> Deployment Protection`, desativar a proteção para o ambiente de **Production**. Deixar a autenticação ser tratada EXCLUSIVAMENTE pela aplicação (Firebase).

## 2. Aliases e Domínios Personalizados
- **Nomes Limpos**: Usar aliases curtos e profissionais (ex: `ecossistema-pro.vercel.app`) e mapear via CLI ou Painel para garantir que o link compartilhado seja sempre o oficial.

---
*Assinado: Antigravity (IA)*
