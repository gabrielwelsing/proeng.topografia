# Estratégia de Performance e Manipulação de Dados (Frontend)

Práticas para garantir que o sistema não fique lento ao lidar com arquivos grandes (PDF/Imagens) no navegador.

## 1. Processamento de PDF (Client-Side)
- **Biblioteca**: `pdfjs-dist` para extração e `jspdf` para geração.
- **Vantagem**: O processamento ocorre no computador do usuário, economizando servidor e permitindo funcionamento offline parcial ou mais rápido.

## 2. Otimização de Salva (Firestore)
- **Limpeza de Base64**: Nunca salvar strings Base64 gigantes (imagens) diretamente no Firestore. Isso estoura a cota de 1MB por documento e encarece o banco.
- **Limpeza no Loop**: Antes de dar o `addDoc`, mapeamos o array de páginas e limpamos o campo `imagem: ''`, salvando apenas as coordenadas e metadados.

## 3. UI Dinâmica
- **Feedback de Carregamento**: Uso intensivo de skeletons e spinners durante o `authLoading` para evitar "piscadas" de conteúdo restrito antes do login ser validado.

---
*Assinado: Antigravity (IA)*
