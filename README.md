# Tablet-Pesquisas

Site para tablet com a lista de produtos da padaria (foto, nome e código).
Hospedado no GitHub Pages, com dados no Firebase (plano gratuito).

- `index.html`: tela do tablet (pesquisa por nome ou código, filtro por categoria, toque no produto mostra o código grande).
- `admin.html`: tela de cadastro, para incluir, editar, esconder ou excluir produtos (precisa de login).
- `dados/produtos.json`: lista que veio da aba PRODUTOS da planilha. Usada enquanto o Firebase não estiver configurado e na importação inicial.
- `js/config.js`: configuração do Firebase.
- `firestore.rules`: regras de segurança para colar no console do Firebase.
- `apps-script-original/`: o Apps Script antigo, só como referência.

## Como funciona

Todos os produtos ficam num único documento do Firestore (`catalogo/produtos`).
O tablet faz 1 leitura ao abrir e recebe as alterações sozinho, sem precisar recarregar.
A última lista fica guardada no tablet, para continuar aparecendo se a internet cair.

As fotos podem ser tiradas direto na tela de cadastro (botão "Tirar ou escolher foto"): a foto é reduzida
e guardada no Firestore, na coleção `fotos`, e o produto fica com `foto:IDENTIFICADOR` no campo da imagem.
Também dá para usar um link do Google Drive (o arquivo precisa estar compartilhado como "Qualquer pessoa com o link").
O tablet guarda as fotos que já mostrou, para continuarem aparecendo sem internet.

## Publicar no GitHub Pages

No GitHub: Settings > Pages > Source: "Deploy from a branch", branch `main`, pasta `/ (root)`.
O site fica em https://adrianpastore.github.io/Tablet-Pesquisas/

## Ligar ao Firebase

1. Em https://console.firebase.google.com crie um projeto (pode desativar o Google Analytics).
2. **Firestore Database** > Criar banco de dados > modo de produção, local `southamerica-east1`.
3. **Authentication** > Começar > ative "E-mail/senha". Em Usuários, adicione a conta que vai cadastrar produtos e copie o UID dela.
4. **Firestore > Regras**: cole o conteúdo de `firestore.rules`, trocando `COLE_AQUI_O_UID` pelo UID copiado, e publique.
5. **Configurações do projeto** > Seus apps > ícone `</>` (Web) > registre o app e copie o objeto `firebaseConfig` para `js/config.js`.
6. Em Authentication > Configurações > Domínios autorizados, adicione `adrianpastore.github.io`.
7. Abra `admin.html`, entre com a conta criada e clique em "Importar lista da planilha".
