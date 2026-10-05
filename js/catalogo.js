// Acesso à lista de produtos, usado pela tela do tablet e pela tela de cadastro.
//
// Todos os produtos ficam num único documento do Firestore (catalogo/produtos),
// no campo "lista". Assim cada tablet gasta 1 leitura por carga, bem dentro
// da cota gratuita.

import { firebaseConfig } from './config.js';

const VERSAO_SDK = '10.12.2';
const URL_SDK = 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/';

export const firebaseLigado = Boolean(firebaseConfig);

let modulos = null;

export async function firebase() {
  if (modulos) {
    return modulos;
  }

  const [app, firestore, auth] = await Promise.all([
    import(URL_SDK + 'firebase-app.js'),
    import(URL_SDK + 'firebase-firestore.js'),
    import(URL_SDK + 'firebase-auth.js')
  ]);

  const aplicativo = app.initializeApp(firebaseConfig);

  modulos = {
    firestore,
    auth,
    db: firestore.getFirestore(aplicativo),
    autenticacao: auth.getAuth(aplicativo)
  };

  return modulos;
}

export async function documentoCatalogo() {
  const { firestore, db } = await firebase();
  return firestore.doc(db, 'catalogo', 'produtos');
}

// Lista inicial, vinda da planilha. Usada quando o Firebase ainda não foi
// configurado e para a importação inicial na tela de cadastro.
export async function lerListaInicial() {
  const resposta = await fetch('dados/produtos.json', { cache: 'no-store' });

  if (!resposta.ok) {
    throw new Error('Não foi possível ler dados/produtos.json');
  }

  return resposta.json();
}

// Fica de olho no catálogo e chama aoMudar(lista) sempre que ele mudar.
// Sem Firebase, entrega a lista fixa uma vez.
export async function acompanharCatalogo(aoMudar, aoFalhar) {
  if (!firebaseLigado) {
    try {
      aoMudar(await lerListaInicial());
    } catch (erro) {
      aoFalhar(erro);
    }
    return function() {};
  }

  const { firestore } = await firebase();
  const referencia = await documentoCatalogo();

  return firestore.onSnapshot(
    referencia,
    function(documento) {
      const dados = documento.data();
      aoMudar(dados && Array.isArray(dados.lista) ? dados.lista : []);
    },
    aoFalhar
  );
}

// Busca o catálogo direto do servidor (botão "Atualizar").
export async function buscarCatalogo() {
  if (!firebaseLigado) {
    return lerListaInicial();
  }

  const { firestore } = await firebase();
  const documento = await firestore.getDocFromServer(await documentoCatalogo());
  const dados = documento.data();
  return dados && Array.isArray(dados.lista) ? dados.lista : [];
}

export function prepararUrlImagem(url) {
  url = String(url || '').trim();

  if (!url) {
    return '';
  }

  // Link no formato:
  // https://drive.google.com/file/d/IDENTIFICADOR/view
  let resultado = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);

  if (resultado && resultado[1]) {
    return 'https://drive.google.com/thumbnail?id=' + resultado[1] + '&sz=w400';
  }

  // Link no formato:
  // https://drive.google.com/open?id=IDENTIFICADOR
  resultado = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (resultado && resultado[1] && url.includes('drive.google.com')) {
    return 'https://drive.google.com/thumbnail?id=' + resultado[1] + '&sz=w400';
  }

  // Aceita também endereços comuns de imagens
  return url;
}

// Mesma regra do buscarProdutos() do Apps Script: só produtos ativos,
// com código e nome, ordenados por categoria e nome.
export function produtosParaExibir(lista) {
  return lista
    .filter(function(produto) {
      return produto.ativo && String(produto.codigo || '').trim() && String(produto.nome || '').trim();
    })
    .map(function(produto) {
      return {
        codigo: String(produto.codigo).trim(),
        nome: String(produto.nome).trim(),
        categoria: String(produto.categoria || '').trim() || 'Sem categoria',
        imagem: prepararUrlImagem(produto.imagem)
      };
    })
    .sort(function(a, b) {
      return a.categoria.localeCompare(b.categoria, 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR');
    });
}
