const NOME_ABA_PRODUTOS = 'PRODUTOS';

function instalarSistema() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(NOME_ABA_PRODUTOS);

  if (!aba) {
    aba = planilha.insertSheet(NOME_ABA_PRODUTOS);
  }

  // Só cria os cabeçalhos se a aba estiver vazia
  if (aba.getLastRow() === 0) {
    aba.getRange('A1:E1').setValues([[
      'CODIGO',
      'NOME',
      'CATEGORIA',
      'IMAGEM_URL',
      'ATIVO'
    ]]);

    aba.getRange('A2:E7').setValues([
      ['1001', 'Pão francês', 'Pães', '', true],
      ['1035', 'Pão francês integral', 'Pães', '', true],
      ['2015', 'Bolo de chocolate', 'Bolos', '', true],
      ['2041', 'Bolo de cenoura', 'Bolos', '', true],
      ['3044', 'Coxinha de frango', 'Salgados', '', true],
      ['4018', 'Sonho de creme', 'Doces', '', true]
    ]);
  }

  // Formatação
  aba.setFrozenRows(1);

   aba.getRange('A2:A2000').setNumberFormat('@');
  aba.getRange('A1:E1')
    .setBackground('#C84F22')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  aba.setColumnWidth(1, 120);
  aba.setColumnWidth(2, 300);
  aba.setColumnWidth(3, 180);
  aba.setColumnWidth(4, 400);
  aba.setColumnWidth(5, 100);

  // Caixas de seleção na coluna ATIVO
  aba.getRange('E2:E2000').insertCheckboxes();

  aba.getDataRange().setVerticalAlignment('middle');
  aba.setRowHeight(1, 35);

  SpreadsheetApp.getUi().alert(
    'Sistema instalado! A aba PRODUTOS foi preparada.'
  );
}

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Consulta de Produtos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    );
}

function buscarProdutos() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  const aba = planilha.getSheetByName(NOME_ABA_PRODUTOS);

  if (!aba || aba.getLastRow() < 2) {
    return [];
  }

  const ultimaLinha = aba.getLastRow();

  const valores = aba
    .getRange(2, 1, ultimaLinha - 1, 5)
    .getDisplayValues();

  const produtos = valores
    .filter(linha => {
      const codigo = linha[0].trim();
      const nome = linha[1].trim();
      const ativo = linha[4].toUpperCase();

      return (
        codigo &&
        nome &&
        (ativo === 'TRUE' || ativo === 'SIM' || ativo === 'VERDADEIRO')
      );
    })
    .map(linha => ({
      codigo: linha[0].trim(),
      nome: linha[1].trim(),
      categoria: linha[2].trim() || 'Sem categoria',
      imagem: prepararUrlImagem(linha[3])
    }));

  produtos.sort((produtoA, produtoB) => {
    const categoria = produtoA.categoria.localeCompare(
      produtoB.categoria,
      'pt-BR'
    );

    if (categoria !== 0) {
      return categoria;
    }

    return produtoA.nome.localeCompare(produtoB.nome, 'pt-BR');
  });

  return produtos;
}

function prepararUrlImagem(url) {
  if (!url) {
    return '';
  }

  // Link no formato:
  // https://drive.google.com/file/d/IDENTIFICADOR/view
  let resultado = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);

  if (resultado && resultado[1]) {
    return 'https://drive.google.com/thumbnail?id=' +
      resultado[1] +
      '&sz=w400';
  }

  // Link no formato:
  // https://drive.google.com/open?id=IDENTIFICADOR
  resultado = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (resultado && resultado[1]) {
    return 'https://drive.google.com/thumbnail?id=' +
      resultado[1] +
      '&sz=w400';
  }

  // Aceita também endereços comuns de imagens
  return url;
}
