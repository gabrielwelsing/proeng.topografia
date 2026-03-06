# Regra de Ouro: Integração de Módulos Legados

Ao integrar Módulos de Código Estático (HTML/JS/CSS puros criados como Proof of Concept ou MVP em repositórios separados) dentro do Ecossistema Pro (Next.js), siga ESTRITAMENTE estas regras para evitar regressões:

## 1. Preservação do Código Funcional (Não toque no JS central)
NUNCA sobrescreva, reescreva ou altere a lógica JavaScript "core" de um módulo que o usuário informou estar funcional e testado.
- Se a função desenha no canvas, não toque na matemática.
- Se a função gera PDF usando `jsPDF`, não a substitua por um "exemplo mais simples".
- Copie o arquivo 1:1. 

## 2. Injeção de Segurança e Login (Wrapper, não Override)
Quando precisar adicionar a camada de Firebase Auth para garantir acesso restrito ao módulo:
- INJETE o HTML do modal de login e o script de autenticação em blocos SEPARADOS do script original.
- **Não aglutine/triture a lógica antiga para caber no seu modelo de login.**
- Se precisar modificar a interface (layout, CSS) para padronizar com o Ecossistema, faça isso *apenas alterando classes CSS* (usando Tailwind) ou reorganizando as Tags HTML. Mantenha os `id`s intocados para não quebrar o `document.getElementById` do script legado.

## 3. Sandboxing
- Mantenha esses módulos estáticos na pasta `public/` (ex: `public/nome-do-modulo/index.html`).
- Chame as libs externas do Firebase e JS nativo como eram antes.
- Não tente "reactificar" (converter para React/Next) o código a menos que o usuário peça expressamente. A prioridade é funcionar rápido, exatamente como funcionava no MVP.

## Histórico de Incidente
*Data: 06/03/2026*
Ao adicionar autenticação Firebase no módulo "Conversor de Fotos", o script original de `jsPDF` foi reescrito para um modelo mais básico. Isso acidentalmente removeu a matemática especializada (canvas translation/rotation) que forçava fotos em modo paisagem a girarem 90 graus para caber no PDF no modo retrato de forma otimizada.
**Correção aplicada:** A lógica do PDF teve que ser restaurada manualmente.

*Este arquivo orientará as próximas integrações de ferramentas no Ecossistema.*
