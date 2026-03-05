# Estratégia de Autenticação e Controle de Acesso (Firebase)

Esta estratégia garante um sistema de login robusto, seguro e com feedback em tempo real para o usuário, ideal para modelos SaaS com aprovação manual.

## 1. Fluxo de Registro e Login
- **Cadastro Pendente**: Novos usuários (Email/Senha ou Google) são criados com `status: 'pending'` e `roles: all_false`.
- **Redirect Inteligente**: O componente de Login redireciona todos os usuários logados para o `/hub`. O `/hub` é quem decide o que mostrar com base no `status`.

## 2. Sincronização em Tempo Real (O Pulo do Gato)
- **Uso do `onSnapshot`**: Em vez de carregar os dados uma única vez, usamos um listener no documento do usuário no Firestore dentro do `AuthContext`.
- **Feedback Instantâneo**: Se o Admin aprovar o usuário no painel, a tela do usuário "abre" os módulos na hora, sem necessidade de refresh ou novo login.

## 3. Estrutura de Permissões (Roles)
- **Mapeamento Flexível**: Cada usuário tem um objeto `roles` (ex: `conversao: true`, `topografia: false`).
- **Níveis de Acesso**: Centralizamos a lógica de "quem pode ver o quê" no `AuthContext` para que as telas consumam apenas booleanos simples (ex: `roles.topografia`).

## 4. Segurança no Banco (Firestore Rules)
- **Proteção Total**: Bloqueamos tudo por padrão (`match /{document=**} { allow read, write: if false; }`).
- **Liberação Granular**: Abrimos as coleções apenas para usuários com `status: 'approved'`.
- **Funções Reutilizáveis**: Criamos `isAdmin()` e `isApproved()` dentro do `firestore.rules` para simplificar a manutenção.

---
*Assinado: Antigravity (IA)*
