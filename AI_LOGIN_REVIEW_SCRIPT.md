# PROENG ECOSSISTEMA: AI ARCHITECTURE & LOGIN REVIEW CONTEXT

> **Instrução para a IA Analista:** Por favor, leia todo o contexto abaixo sobre a arquitetura atual do sistema, especificamente o fluxo de autenticação (Login/Registro). Enfrentamos vários problemas persistentes de sincronização e regras de segurança. Seu objetivo é revisar nossa estratégia e propor uma solução arquitetural mais robusta, segura e à prova de falhas.

---

## 🏗️ 1. Arquitetura Atual
* **Frontend:** Next.js (App Router), React, TailwindCSS. Deploy na Vercel (`ecossistema-pro.vercel.app`).
* **Backend as a Service:** Firebase (Authentication + Firestore).
* **Estrutura de Acesso:** Baseado em Módulos (Conversor, Contar US, Integração Earth, Admin).

## 🔑 2. O Problema Persistente do Login
Temos enfrentado problemas recorrentes de criação e aprovação de usuários. A principal falha ocorreu na separação entre o **Firebase Auth** (que gerencia as credenciais) e o **Firestore** (que guarda os metadados de acesso e roles do usuário na coleção `users`).

### O Fluxo Problemático Original:
1. Usuário vai na tela de Login e clica em "Solicitar Acesso" (Email/Senha).
2. O Firebase Auth cria o usuário com sucesso.
3. O código tenta criar um documento no Firestore (`db.collection('users').doc(uid).set(...)`) com `status: 'pending'`.
4. **⚠️ FALHA:** Muitas vezes essa gravação falha silenciosamente (provavelmente regras de segurança ou falha de conexão). O usuário vê a mensagem de sucesso na tela, entra pelo Auth, mas **nunca aparece no painel do administrador**, ficando eternamente bloqueado no "limbo".
5. O mesmo ocorre ao usar Login com o Google: o Auth ocorre perfeitamente, mas o Firestore não tem o documento correspondente.

### O "Patch" Implementado Atualmente:
Para contornar o problema da tela de registro, implementamos duas gambiarras arquiteturais:
1. **No Admin Page:** Criamos um formulário de "Criar Usuário" onde o próprio administrador digita Nome, E-mail, Senha e clica nos checkboxes. Usamos a **REST API do Firebase (identitytoolkit)** com a API Key para criar o Auth Account sem deslogar a sessão do Admin, e em seguida gravamos `status: 'approved'` e as roles no Firestore (pois o Admin tem regra livre de escrita no Firestore).
2. **No AuthContext (Rede de Segurança):** Adicionamos uma lógica `onAuthStateChanged`. Se o usuário autenticar (por qualquer meio) e o sistema não encontrar o documento no Firestore (`!userSnap.exists()`), ele **tenta criar o documento ali mesmo na hora do login** com `status: 'pending'` e todas as `roles` false.

## 🛡️ 3. Regras Atuais do Firestore
Descobrimos hoje que as regras do Firestore estão extremamente abertas, o que descarta o bloqueio por regras (mas evidencia falhas de segurança):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Apesar de abertas a "qualquer logado", o documento de registro não era gravado com sucesso no fluxo original da página de login não logada.

## 🎯 4. O Que Precisamos (Seu Objetivo como IA Revisora)
Por favor, analise a stack atual e responda às seguintes perguntas:
1. **Arquitetura de Roles JWT vs. Firestore Database:** É melhor manter as permissões apenas no Firestore, ou devemos usar **Firebase Custom Claims** configuradas via Cloud Functions ou Admin SDK? Quais os trade-offs?
2. **Registro de Usuários Seguro:** Como criar o usuário (Auth) + Documento Inicial (Firestore) de forma atômica e segura sem expor o banco de dados e sem falhas parciais (onde existe Auth mas não existe Doc)? Cloud Functions para gatilho de conta `onCreate` seria a solução definitiva?
3. **Regras de Segurança (Firestore Rules):** Levando em conta que temos administradores (coleção `users`, doc={uid}, `roles.admin == true`), como reescrever as Regras do Firestore para serem restritas (cada pessoa lê seu status) e apenas admins podem ver a lista e setar `status: 'approved'` e roles?
4. **Proposta de Refatoração:** Escreva um pequeno pseudocódigo ou checklist do fluxo definitivo que o sistema `Ecossistema Pro` deve adotar para resolver definitivamente esse problema do "limbo" de usuários.

---
**Status Atual:** O sistema está rodando e online. Os patches aguentam carga, mas sabemos que tecnicamente é frágil e as regras de segurança abertas são um risco. Aguardamos sua revisão estrutural completa.
