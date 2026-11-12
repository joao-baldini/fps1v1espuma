# Agentes

`models.js` descreve os cinco personagens em geometria simples, sem texturas e sem carregadores de modelos externos. São partes compartilhadas entre a prévia 3D, os retratos e as instâncias da partida.

- **Finder:** uniforme azul-petróleo, visor, headset e rádio com antena.
- **Doctor:** jaqueta clara, detalhes verdes, cabelo preso e kit médico nas costas.
- **Ghost:** capuz, máscara e equipamento discreto em cinza e violeta.
- **Brutus:** barba, faixa e ombreiras largas com placas em amarelo envelhecido.
- **Detector:** jaqueta ferrugem, gorro com óculos e mochila de sensores.

Os modelos têm aproximadamente mil triângulos cada, divididos em pernas, corpo e cabeça para acompanhar o agachamento. A arma e o capacete continuam usando os modelos do jogo. A simulação e as hitboxes não são alteradas. A cor do time aparece em pequenos marcadores e aliados mantêm o indicador sobre a cabeça.

Os retratos são renderizados uma vez em 200 × 200 pixels e ficam em memória. A tela usa um renderizador reutilizado, com cinco chamadas de desenho para personagem, arma e sombra. Ele para de renderizar ao sair da seleção; com movimento reduzido, só redesenha ao trocar de agente ou redimensionar a janela. O fundo é uma imagem estática do mapa, sem carregar sua geometria.
