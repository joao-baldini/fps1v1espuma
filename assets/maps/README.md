# Mapas nativos: Sandstone e Inferno Prefire

## Sandstone · Plant the Bomb (5v5 e Wingman)

Único mapa do Plant the Bomb e do Wingman. É o GLB **"chicken gun fruzer sandy"**, de **amogusstrikesback2** no Sketchfab, licença **CC-BY 4.0**, enviado pelo próprio autor. O crédito aparece no menu, na miniatura e no início da partida.

`tools/import-sandstone.mjs` converte o arquivo:

- **Leveza:** o GLB tem 818 mil triângulos, porque cada palmeira vem em três níveis de detalhe. Fica só o nível leve das palmeiras. A miudeza de decoração (copos, pratos, livros, comida, lixo) sai. Caixas, barris, paletes, móveis, portas e janelas viram peças simples (caixa orientada ou cilindro) com as cores dominantes do objeto. Casas, muralha, tendas e escadas passam pelo simplificador do [meshoptimizer](https://github.com/zeux/meshoptimizer). Resultado: cerca de 119 mil triângulos.
- **Cores:** cada triângulo pega a cor do atlas de cores do modelo, e os padrões procedurais leves do jogo vão por cima. Nenhuma imagem é enviada.
- **Colisão:** casas e muralha usam uma caixa orientada medida pelas paredes (abaixo de 2,5 m) e fechada até a laje do telhado, sem parede invisível no beiral. Balcões e chafariz usam a parte de baixo; tendas, cercas e pedras, a caixa inteira; escadas e morros, a própria malha. Palmeiras colidem só pelo tronco; plantas, portas e janelas são só visuais.
- **Marcações do autor:** Atacantes no alto do minimapa (+z) e Defensores embaixo (−z). O **A** é o piso de lajotas; o **B** é a área em L em volta do chafariz, guardada em duas partes (`parts`). As áreas aparecem pintadas de vermelho no chão.
- **Barreiras:** as cinco linhas do autor são esticadas até as paredes dos dois lados. O importador confere pela navegação que cada spawn fica fechado: dali não se chega a nenhum bombsite nem ao outro spawn.

Para regenerar (Node.js 22+ e o meshoptimizer instalado com `npm i meshoptimizer`, ou indicado por `MESHOPT`):

```powershell
node tools/import-sandstone.mjs "caminho/chicken_gun_fruzer_sandy.glb"
node --test tests/game.test.cjs
```

## Dados usados pelo jogo

- `warface-catalog.js`: nome, autor, dimensões, spawns, bombsites e barreiras do Sandstone, para o menu.
- `sandstone.js` / `inferno.js`: malha indexada, colisões e navegação em arrays tipados, compactados com gzip e base64. São carregados só ao entrar na partida.
- `runtime.js`: colisão convexa com grade espacial, movimento, escadas, navegação e carregamento.

## Inferno · Prefire

O arquivo fornecido `de_inferno_cs2.4.rar` contém `de_inferno.vpk`, do Source 2. A conversão usa a malha física de `maps/de_inferno/world_physics.vmdl_c`, exportada offline pelo **Source2Viewer CLI 20.1**. Os vértices físicos mantêm coordenadas Source em polegadas, Z para cima; a matriz glTF de apresentação não é reaplicada. Distâncias, coberturas e alturas vêm dessa malha, com a mesma escala de 0,0254 m/unidade. Ornamentos visuais sem colisão são omitidos.

`tools/import-inferno-prefire.mjs` recorta a Banana após a T Ramp, o B e a passagem do CT até o APC/truck. As regiões exatas, hash do VPK e os 15 spots constam em `inferno-source.json`. As bordas externas do recorte recebem paredes de fechamento. Faces adjacentes coplanares são unidas somente quando a união continua convexa. A malha final tem cerca de **43 mil triângulos**, sem imagens ou materiais originais; a paleta usa reboco ocre, telhas terracota, pedra clara, madeira e barris azuis.

As faces físicas geram prismas convexos consultados pela grade do runtime. Pisos caminháveis usam extrusão vertical e contato no centro dos pés para não criar quinas falsas entre triângulos de terreno. O bit 4 da máscara identifica esses pisos; bits 1 e 2 continuam indicando colisão de movimento e tiros. Player clips continuam invisíveis e não bloqueiam tiros. Essa representação é específica desta conversão; os brushes dos mapas BSP mantêm as máscaras anteriores.

`inferno.js` contém malha, colisões e navegação, em gzip/base64, e só é carregado ao clicar no quadro Prefire. `prefire-catalog.js` contém apenas dimensões, ponto inicial e os spots. O teste de movimento percorre todas as 15 posições com a física real do jogador; testes adicionais verificam os disparos, paredes, mortes, cronômetro e retorno ao Aimbotz.

Para regenerar, extraia o VPK e execute a versão indicada do [Source2Viewer CLI](https://github.com/ValveResourceFormat/ValveResourceFormat/releases/tag/20.1):

```powershell
Source2Viewer-CLI.exe -i "de_inferno.vpk" -f "maps/de_inferno/world_physics.vmdl_c" -d -o "export/collision.gltf" --gltf_export_format gltf --gltf_export_materials --gltf_export_extras
node tools/import-inferno-prefire.mjs "export/collision_physics.gltf" "de_inferno.vpk"
node --test tests/game.test.cjs
```

O início protegido fica atrás da curva perto da T Ramp; a malha inclui essa pequena extensão ao sul da Banana. O importador rejeita um nascimento em colisão ou visível por qualquer defensor, verificando pontos do corpo, cabeça e laterais. A grade de navegação mantém a mesma origem ao ampliar o recorte, preservando as células já validadas no restante do percurso.

O VPK, a ferramenta de extração e os arquivos intermediários ficam fora do repositório.

## Movimento em pisos, escadas e rampas

A colisão nativa agora separa o movimento horizontal do apoio dos pés. O corpo é varrido acima da janela normal de degrau; o apoio procura as superfícies sob a mesma largura usada na colisão, inclusive as bordas. Assim, as costuras dos triângulos e espelhos dos degraus não funcionam como paredes laterais. A altura máxima de degrau continua em 0,5 m; paredes maiores e tetos baixos continuam sólidos. A queda e o salto mantêm a resolução de colisão vertical.

A escada vertical (trigger de escada) procura uma saída livre para o patamar próximo à altura útil do trigger. A transferência só ocorre com espaço para o corpo e varreduras livres na subida e na passagem, evitando o bloqueio na borda superior. Pular continua soltando a escada.

Os testes percorrem as rotas entre as bases e os bombsites do Sandstone pelos dois lados, aproximações deslocadas de rampas e degraus no Sandstone e no Prefire, e uma escada completa a 30/60/144 FPS.
