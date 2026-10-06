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
  let jaRecebeu = false;

  // Se o Firebase demorar a responder, mostra a lista da planilha enquanto isso
  const espera = setTimeout(async function() {
    if (!jaRecebeu) {
      try {
        aoMudar(await lerListaInicial());
      } catch (erro) {
        aoFalhar(erro);
      }
    }
  }, 8000);

  return firestore.onSnapshot(
    referencia,
    async function(documento) {
      clearTimeout(espera);

      try {
        aoMudar(await listaDoDocumento(documento));
        jaRecebeu = true;
      } catch (erro) {
        aoFalhar(erro);
      }
    },
    async function(erro) {
      clearTimeout(espera);
      aoFalhar(erro);

      // Se o Firebase nunca respondeu (banco ainda não criado, por exemplo),
      // mostra pelo menos a lista da planilha
      if (!jaRecebeu) {
        try {
          aoMudar(await lerListaInicial());
        } catch (erroLista) {
          // Fica com o erro já exibido
        }
      }
    }
  );
}

// Busca o catálogo direto do servidor (botão "Atualizar").
export async function buscarCatalogo() {
  if (!firebaseLigado) {
    return lerListaInicial();
  }

  const { firestore } = await firebase();
  return listaDoDocumento(await firestore.getDocFromServer(await documentoCatalogo()));
}

// Enquanto a lista ainda não foi importada no Firebase, usa a da planilha
async function listaDoDocumento(documento) {
  const dados = documento.data();

  if (!dados || !Array.isArray(dados.lista)) {
    return lerListaInicial();
  }

  return dados.lista;
}

export function prepararUrlImagem(url) {
  url = String(url || '').trim();

  // Foto tirada pela tela de cadastro (fica no Firestore): ver enderecoDaImagem()
  if (!url || url.startsWith(PREFIXO_FOTO)) {
    return url;
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

// Fotos tiradas pela tela de cadastro ficam na coleção "fotos" do Firestore,
// uma por documento, e o produto guarda "foto:IDENTIFICADOR" no campo imagem.
// O identificador muda a cada foto nova, então cada uma é baixada uma única
// vez e fica guardada no aparelho (também serve sem internet).
export const PREFIXO_FOTO = 'foto:';
const CACHE_FOTOS = 'fotos-cadastro-v1';
const enderecosFotos = new Map();

export function documentoFoto(firestore, db, idFoto) {
  return firestore.doc(db, 'fotos', idFoto);
}

// Devolve o endereço para usar no src de uma <img>, para links do Drive e
// para fotos do cadastro. Devolve '' se não houver foto.
export async function enderecoDaImagem(valor) {
  valor = String(valor || '').trim();

  if (!valor.startsWith(PREFIXO_FOTO)) {
    return prepararUrlImagem(valor);
  }

  const idFoto = valor.slice(PREFIXO_FOTO.length);

  if (!enderecosFotos.has(idFoto)) {
    const promessa = baixarFoto(idFoto);
    enderecosFotos.set(idFoto, promessa);
    // Se falhar (sem internet, por exemplo), tenta de novo na próxima vez
    promessa.catch(() => enderecosFotos.delete(idFoto));
  }

  return enderecosFotos.get(idFoto);
}

async function baixarFoto(idFoto) {
  const chave = new URL('fotos-cadastro/' + encodeURIComponent(idFoto), location.href).href;
  let cache = null;

  try {
    cache = await caches.open(CACHE_FOTOS);
    const guardada = await cache.match(chave);

    if (guardada) {
      return URL.createObjectURL(await guardada.blob());
    }
  } catch (erro) {
    // Sem acesso ao cache: baixa direto
  }

  const { firestore, db } = await firebase();
  const documento = await firestore.getDoc(documentoFoto(firestore, db, idFoto));
  const dados = documento.data();

  if (!dados || !dados.dados) {
    return '';
  }

  const arquivo = await (await fetch(dados.dados)).blob();

  if (cache) {
    cache.put(chave, new Response(arquivo)).catch(() => {});
  }

  return URL.createObjectURL(arquivo);
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
        imagem: prepararUrlImagem(produto.imagem),
        venda: textoVenda(produto)
      };
    })
    .sort(function(a, b) {
      return a.categoria.localeCompare(b.categoria, 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

// Forma de venda: "UN" (por unidade), "KG" (por quilo) ou vazio
export const FORMAS_VENDA = { UN: 'unidade', KG: 'kg' };

// Lê um preço digitado ("12,90", "R$ 1.234,50", "12.9") e devolve o número,
// null se estiver vazio ou NaN se não der para entender
export function lerPreco(texto) {
  let limpo = String(texto ?? '').replace(/R\$|\s/gi, '');

  if (!limpo) {
    return null;
  }

  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  }

  if (!/^\d+(\.\d+)?$/.test(limpo)) {
    return NaN;
  }

  return Math.round(Number(limpo) * 100) / 100;
}

export function formatarPreco(preco) {
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Ex.: "R$ 12,90 / kg", "R$ 4,50 / unidade", "Vendido por kg" ou ""
export function textoVenda(produto) {
  const forma = FORMAS_VENDA[produto.venda] || '';
  const preco = typeof produto.preco === 'number' && isFinite(produto.preco) ? produto.preco : null;

  if (preco !== null) {
    return formatarPreco(preco) + (forma ? ' / ' + forma : '');
  }

  return forma ? 'Vendido por ' + forma : '';
}
