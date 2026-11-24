# Mapas nativos e conversões offline

## Sanctum · reconstrução independente

O Sanctum atual substitui a primeira conversão do Wingman. `tools/import-sanctum.mjs` começa diretamente em `wg_sanctum.bsp`, sem ler a malha ou os objetos de `sanctum.js` anterior. O relatório `sanctum-source.json` registra o SHA-256, escala, materiais, objetos reconstruídos, áreas de navegação, pontos de nascimento e contagens.

Os 1.149 polígonos visíveis da arquitetura são extraídos do BSP, preservando as paredes, pisos, escadas, distâncias e alturas na escala de 0,0254 m por unidade Source. O cenário completo substitui o recorte anterior. O acabamento é a grade padrão do jogo, com cores chapadas de pedra clara, madeira e verde, sem texturas, imagens ou shaders novos. A imagem grande e a miniatura do menu são renders dessa nova geometria.

O BSP referencia modelos externos do CS que não estão incorporados nele. Esses objetos recebem geometria própria e leve nas posições, ângulos e escalas declarados no arquivo; não são cópias exatas das malhas externas ausentes. Pallets têm base baixa, as pilhas de caixas respeitam o espaçamento vertical, caixas inclinadas mantêm colisão, cercas têm barras visíveis e a tela da cerca bloqueia movimento mas deixa tiros passarem. Árvores usam copas facetadas e colisão apenas nos troncos. Recortes mínimos de segurança ao redor dos dez nascimentos são aplicados ao visual e à colisão juntos, sem deslocar os spawns.

A navegação é refeita a partir das novas colisões. Os testes percorrem os caminhos com a física real, a partir de todos os nascimentos dos dois lados, até a base oposta e o bombsite. Outros testes verificam degraus, consultas de tiros, fechamentos convexos e os erros anteriores de dimensão dos pallets. A malha tem cerca de 14 mil triângulos e o payload compactado, 208 KiB; ele só é carregado quando o mapa entra em jogo.

```powershell
node tools/import-sanctum.mjs "caminho/wg_sanctum.bsp"
node --test tests/game.test.cjs tests/hud-radar.test.cjs tests/sanctum-import.test.cjs
```

O importador geral do Wingman também encaminha Sanctum para esse conversor novo. Neon, Forge e Sable continuam usando suas conversões anteriores.

## Neon · acabamento do Akihabara

O Neon é o Akihabara de **zelzstorm** (Adroon na arte). A geometria, as colisões, os spawns e o bombsite continuam vindo de `wg_neon.bsp`, pelo mesmo importador do Wingman. O acabamento foi refeito com base nas fotos do mapa original. Tudo fica em `tools/neon-style.mjs`:

- **Cores reais de cada material.** O importador lê os VMT embutidos no BSP, seguindo `patch → include`, e usa a refletividade da textura (VTF embutido ou dado do BSP) multiplicada pela tinta `$color` de cada variação. É daí que saem as fachadas vermelha, rosa, bege, amarela e verde-limão, as placas azuis, vermelhas e verdes, o piso tátil amarelo e o compensado laranja. Como a refletividade é linear, ela é convertida para cor de tela (sRGB).
- **Exceções vistas nas fotos.** O vidro das fachadas fica azul, como o reflexo do céu, com o padrão de grade de janelas. A água da vala do bombsite fica escura e esverdeada e é semitransparente.
- **Padrões de superfície.** Painéis metálicos, plástico e mármore usam o padrão de placas. As versões listradas e as portas de enrolar usam o metal canelado.
- **Placas e telões.** Os overlays grandes de propaganda (a partir de 4 m²) e o logotipo da Stein viram painéis colados 3 cm à frente da parede. A cor vem da média dos pixels visíveis do recorte do atlas usado, depois de decodificar o DXT do VTF. Um overlay só entra se a parede dele existe no mapa convertido. Os letreiros 3D (Stein, Switch+, ZURA...) viram caixas com as medidas do próprio modelo. Nada disso tem colisão.
- **Objetos de obra que o BSP não traz.** São caixas d'água IBC azuis, blocos de concreto, sacos de cimento, vigas, feixes de vergalhão e grades de polícia, com a mesma checagem de passagem dos outros objetos aproximados.
- **Paredes invisíveis no fim das ruas.** Elas foram achadas percorrendo todo o espaço alcançável (andando, pulando agachado e caindo) e procurando onde o corpo para numa colisão só de movimento enquanto o tiro passa livre. Os 17 trechos ficam no fim da rua norte (spawn CT), da rua sul, da saída do spawn TR, da rua oeste depois do andaime, na praça coberta a leste, na escada atrás dos cones e num beco ao lado do contêiner azul. Cada um ganhou um tapume de obra de 2,9 m: painéis brancos corrugados, faixa e régua azuis e montantes. O tapume é sólido para movimento e tiros; acima dele a colisão original continua.

A área jogável alcançável foi comparada com o radar oficial do Akihabara e coincide com ele. Spawns, bombsite e navegação continuam conectados, e o tamanho do payload quase não mudou (cerca de 2,9 MB compactado). A imagem do menu (`menu/play/neon.webp` e a miniatura) é um render novo desse acabamento; a câmera está em `cameras.json`.

## Texturas pintadas dos mapas convertidos

**Estilo VALORANT (engenharia reversa do artigo da Riot "The Art of VALORANT Map Environments" e das imagens dele):**
- **Superfícies:** grandes e quase lisas, com variação de tom suave e larga; nada de ruído miúdo.
- **Materiais:** de valor parecido e claros, com juntas discretas, quase do mesmo tom da peça (nunca linhas pretas).
- **Detalhe na forma:** cada bloco, tábua ou painel tem um filete claro na borda de cima e da esquerda (chanfro pegando luz) e uma sombra leve embaixo e à direita.
- **Desgaste:** só em lascas claras e poucas, nas quinas.
- **Distância:** o detalhe some com a distância e fica a cor limpa do material, para a leitura do mapa ficar clara.
- **Árvores:** copas em tufos sobrepostos.

`tools/gen-textures.py` desenha 16 texturas próprias (não são imagens de terceiros) num estilo cartunesco perto do realismo: tijolo, piso de lajotas, tábuas, reboco, metal, terra, cantaria, asfalto, telhas de barro, folhagem, caixote, barril, papel de lanterna, painel de madeira e calçamento. Cada uma tem formas limpas, relevo pintado (luz do alto à esquerda, sombra embaixo) e oclusão nas juntas.

O resultado vai para `assets/maps/textures.js`: um atlas WebP 4×4 (~350 KiB), com borda repetida de 16 px em volta de cada textura para não aparecer costura no mipmap, e a cor média de cada textura. O shader dos mapas convertidos amostra o atlas pela coordenada de textura real do BSP, usando `textureGrad`.

A textura é tingida pelo brilho para chegar à cor real do material (cor do vértice × brilho da textura ÷ brilho médio), com só um pouco da variação de cor da própria textura. Caixote, barril, lanterna, telhado e folhagem mantêm mais da própria cor. A lanterna é desenhada acesa, sem sombra.

**Luz do sol.** Os mapas convertidos usam um material com luz de verdade (MeshStandardMaterial com o atlas injetado):
- **Sol:** forte e quente, com sombras em tempo real conforme a opção de sombras dos gráficos.
- **Ambiente:** céu azul e reflexo quente do chão preenchendo as sombras; tone mapping ACES do jogo e saturação um pouco maior.
- **Lanternas:** brilham.
- **Céus:** os temas de céu ficaram mais azuis e o sol mais forte, para os mapas serem sempre ensolarados e de cores vivas.
- **Sombras:** só a face de trás projeta sombra e o viés é maior nesses mapas, para não aparecerem listras.

Objetos com textura própria usam coordenadas por face (de 0 a 1), para a moldura do caixote e os aros do barril caírem no lugar.

**Caixotes e barris em todos os mapas convertidos.** Neon, Forge e Sable usam a textura de caixote (moldura com X) e a de barril (aduelas com aros) em cada face. Quando o nome do modelo traz as medidas (`dust_crate_style_02_37x37x74`), o caixote tem esse tamanho exato e não é mais encolhido pela checagem da malha de navegação, que antes deixava caixotes pequenos e desencontrados da pilha. Barris de madeira da Inferno ficam marrons; os enferrujados e os de aviso, nas cores deles.

**Assentamento.** Os modelos do CS costumam ficar alguns centímetros acima do chão, ou apoiados em algo que não existe aqui. De baixo para cima, cada caixote, barril, saco, palete ou bloco desce até o chão visível ou até o topo do objeto já assentado embaixo (ou sobe, se estiver afundado até 45 cm). A conta usa os 8 cantos da caixa já girada. Só superfícies que aparecem servem de apoio: as colisões invisíveis do mapa original (*clips*) não contam. Caixas de luz e de ar-condicionado (presas na parede ou no telhado) e os prédios do skybox não se mexem. O Sanctum, que tem conversor próprio, recebe o mesmo assentamento. Resultado: Neon 111, Forge 87, Sable 62 e Sanctum 63 objetos assentados, com todos os spawns ligados.

## Luz e cor no estilo VALORANT

Seguindo os artigos da Riot ["VALORANT Shaders and Gameplay Clarity"](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity) e ["A arte dos cenários de mapas em VALORANT"](https://playvalorant.com/pt-br/news/dev/a-arte-dos-cenarios-de-mapas-em-valorant/), o material dos mapas convertidos e o dos mapas próprios (`valorantLighting` em `index.html`) usam:

- **Gradient Lambert:** a extensão do Half-Lambert do VALORANT. A luz do sol na parte difusa passa por `n·l*0.5+0.5`, remapeado com transições controladas (`VAL_LIGHT`: sombra central 0,30, transição de 0,24 a 0,86): a face voltada para o sol fica igual, e a de lado e a de costas não caem no escuro. O brilho especular continua com o ângulo físico, porque o termo do three.js divide por `n·l` e estouraria nas faces rasantes.
- **Sombras projetadas mais claras:** a sombra do sol fica com 46% da luz (`uValShadow`), em vez de apagar a luz direta.
- **Sem tons escuros no cenário:** cores muito escuras sobem até uma luminosidade mínima (0,22), mantendo o tom, para valores parecidos e pouco contraste. Os personagens sempre se destacam e os interiores nunca ficam escuros.
- **Cores vivas e claras:** saturação 1,24 sobre a cor do material.

## Piso dos bombsites

O volume de cada bombsite vem do BSP (`func_bomb_target`) e não tem desenho próprio no chão. Em `index.html`, `siteFloorCells` amostra o chão do retângulo do site numa grade de 25 cm e preenche a partir do nível mais baixo, por degraus de até 40 cm. Embaixo de caixote ou barril, consulta o chão logo abaixo, então o calçamento passa por baixo do objeto sem recorte. Topos de caixote, sacadas e o que estiver fora da altura do site ficam de fora. `siteFloorTexture` desenha a textura de cada site num canvas: lajes irregulares (Voronoi) com argamassa fina meio transparente e sombreado na borda de cada pedra, um meio-fio de blocos claros ao longo do retângulo e o alvo a spray laranja (círculo e cruz com respingos) no ponto livre mais perto do centro. A malha é decalcada 1,2 cm acima do chão, recebe sombra e não tem colisão. As cores das pedras seguem o tema do mapa (`SITE_STONE`).

## Sable · Wingman

O Sable é o mapa de **dorg**, usado com a permissão do autor (Steam Workshop 1369768878). O arquivo enviado, `de_sable.bsp`, é um zip com o BSP Source 21 dentro e é extraído antes da conversão. Ele passa pelo mesmo importador do Wingman.

A estrutura é a do original, sem mudanças: a geometria, as alturas, as colisões e os *player clips* vêm do BSP; os 7 spawns de cada lado, o bombsite A e a navegação também. Não há tapumes nem bloqueios novos.

O acabamento usa as cores reais de cada material, pelo mesmo método do Neon (`styleNeon` em `tools/neon-style.mjs`): o VMT e o VTF embutidos quando existem; senão, a refletividade que o BSP guarda de cada textura, convertida para sRGB. O desenho fica com os padrões procedurais do jogo: tijolo, reboco, madeira, pedra, telhado e paralelepípedo, conforme o nome do material. As texturas originais do CS (`de_inferno/hr_i` e outras) não vêm dentro do BSP, então não há imagens.

O mapa não traz nenhum modelo próprio: os 627 objetos são modelos padrão do CS. Eles são aproximados pelas regras do importador (barris, fardos de feno, caixotes, ciprestes, pilares, grades...). Os caixotes usam as medidas reais tiradas das posições no próprio mapa (o nome do modelo não é a medida): o caixote de vinho tem 62 de altura e 76 de comprimento, com a origem 34 unidades depois da ponta, então os dois que ficam em pé na saída do spawn atacante chegam a 76, onde se apoiam as caixinhas de vinho (abertas, com seis garrafas; a origem delas fica no topo). Os móveis do spawn atacante têm forma em vez de blocos: sofás com assento, encosto e braços (a origem deles fica na altura do assento, 22 unidades acima do chão), cadeiras com pernas e encosto e a mesa da TV com tampo a 28 unidades, prateleira e pernas, todos com uma colisão invisível no volume. As lonas (`_tarp`), que são só um pano sobre um caixote que já existe, ficam de fora. Os caixotes têm moldura, tábuas e travessa; os barris são de madeira com aros. O corredor coberto ganhou varais de lanternas de papel acesas no lugar dos modelos `street_lanterns`, e os lampiões viraram luzes pequenas. Ruas de laje usam lajotas; calçamento usa paralelepípedos; os corredores têm painéis de madeira. O portão do spawn CT (`gate_a`) e as grades com pontas (`railingspikedgate`) viram grades de ferro de verdade: barras com pontas e travessas, mais uma colisão invisível que bloqueia a passagem do jogador e deixa os tiros passarem pelo vão. Antes só apareciam as molduras, vazias. Regras extras (`SABLE_PROPS`) também cobrem a Vespa, os sofás, as cadeiras, os sacos e as floreiras. Enfeites finos (molduras, calhas, janelas, portas na parede) ficam de fora, como nos outros mapas. O tema de luz é o `terracota`.

## Conversões anteriores e ferramentas compartilhadas

Conversão offline dos BSPs fornecidos pelo usuário: `de_guard_csgo.bsp` e `de_elysion.bsp`, extraídos de `guard_feito_por_mim.zip` e `de_elysion_9e838.rar`. Guard é de **poLemin**; Elysion é de **Big_SG21**. Os arquivos fornecidos são ports de **Alex Road**. Os relatórios `*-source.json` registram o SHA-256 de cada BSP, posições, escala, navegação e contagens.

## Geometria e acabamento

Os polígonos de paredes, pisos, escadas e displacements são extraídos diretamente, sem redesenhar as rotas por aproximação. Usa-se a escala de 0,0254 m por unidade Source. As coordenadas são recentradas, preservando distâncias e alturas. Displacements estritamente planos viram um único quadrilátero; os demais mantêm a triangulação nativa.

As colisões vêm dos brushes convexos e dos arquivos PHY embutidos dos objetos sólidos. Os objetos são representados por suas malhas físicas simplificadas; ornamentos sem colisão são omitidos. Portanto o acabamento visual é simplificado, mesmo mantendo a base do BSP. Vidro usa uma segunda faixa transparente da mesma malha. Player clips bloqueiam movimento, mas não tiros. A escada vertical de Guard permite subir/baixar e soltar pulando; bots usam as rotas de escadas.

As cores chapadas vêm das médias RGB dos materiais do BSP e dos materiais embutidos dos modelos. Preto e branco recebem limites leves para manter legibilidade. Não são exportadas imagens, VMTs, VTFs, iluminação ou áudio; o shader de grade é o mesmo do jogo.

## Barreiras invisíveis corrigidas no Elysion

Algumas colisões do port bloqueavam o movimento sem nada desenhado. `SOURCE_FIXES`, no `index.html`, encontra essas peças pela caixa de colisão (não pelo índice, que muda ao regenerar), desenha um visual e tira o bit de tiro delas:

- **Vidro no andar de cima:** dois guarda-corpos entre os pilares da beira do salão (x 3,3–8,2 e 9,4–14,3; z −22,5; 1,09 m de altura). São transparentes, com um perfil no alto, e o tiro passa.
- **Cortina preta na passagem para o terraço:** em x 18,75, fecha do chão ao teto entre z −22,2 e −20,5. Entre z −20,5 e −17,1 vira só a faixa de cima, sobre a passagem (3,25–5,28 m). Dali até o pilar do prédio da direita (z −17,1 a −6,6) havia outra placa invisível, do chão ao teto, que agora também é cortina. Atrás das pregas (faixas de uns 25 cm, levemente sobrepostas) há um painel contínuo, para não sobrar fresta entre elas. O tiro passa por toda a cortina, mas ela continua bloqueando a passagem.

## Recorte Wingman do Elysion

O port fornecido continha dois triggers de bomba. A versão do jogo mantém somente o **A**, conforme a imagem de referência do usuário. A sala inferior direita da imagem continua acessível como passagem, sem o plant B. As rotas internas permanecem nas posições nativas. A casca externa é cortada ao redor do trecho jogável, com margem de 1 m para preservar paredes de contorno, entre −2 e 12 m de altura. Isso reduz os cerca de 113 mil triângulos extraídos para cerca de 60 mil.

Os spawns usam um subconjunto dos pontos reais do BSP dentro das salas verdes da referência. Os limites e as contagens antes/depois aparecem em `elysion-source.json`.

## Dados usados pelo jogo

- `catalog.js`: somente nomes, dimensões, bombsite e spawns para o menu.
- `runtime.js`: colisão convexa com grade espacial, movimento, escadas, navegação e carregamento.
- `guard.js` / `elysion.js`: malha indexada, colisões e navegação em arrays tipados, compactados com gzip e base64. Carregados ao iniciar a partida; nenhum BSP é enviado ao navegador.
- `*-source.json`: relatórios de auditoria da conversão, sem caminhos pessoais.

A navegação é gerada offline em células de 0,7 m, validando degraus e múltiplas alturas. A componente jogável precisa conectar todos os spawns selecionados. A malha é desenhada em até duas chamadas para o mapa, sem texturas nem sombras em tempo real. Guard tem aproximadamente 113 mil triângulos e Elysion, 60 mil. As colisões usam consultas locais na grade; tiros percorrem somente as células atravessadas pelo raio.

Os scripts locais e `DecompressionStream` permitem jogar via `file://` no Chrome, sem depender de `fetch` para os mapas. O primeiro carregamento de cada mapa fica em cache durante a sessão da página. Em rotação, os dois são preparados antes da primeira partida.

## Regenerar

Com Node.js 24 e os BSPs já extraídos:

Mapas do Wingman e os do 5v5 (Lily, Calamari, Coldwater, Crown), um ou mais por vez; o catálogo é atualizado só nos mapas convertidos:

```powershell
node tools/import-wingman-maps.mjs sanctum="caminho/wg_sanctum.bsp" neon="caminho/wg_neon.bsp" forge="caminho/wg_forge.bsp" sable="caminho/de_sable.bsp" lily="caminho/de_lily.bsp" calamari="caminho/de_calamari.bsp" coldwater="caminho/de_coldwater.bsp" crown="caminho/de_crown.bsp"
node --test tests/game.test.cjs
```

O importador usa somente módulos nativos do Node. Formatos suportados: BSP 20 não comprimido, static props v10 e PHY VPHY/IVPS dos arquivos fornecidos. Os BSPs e arquivos compactados originais ficam fora do repositório.

Referências dos formatos: [Valve BSP](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/public/bspfile.h), [Valve static props](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/public/gamebspfile.h), [Valve studio model](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/public/studio.h) e [SourceIO PHY](https://github.com/REDxEYE/SourceIO/blob/master/library/models/phy/phy.py).

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

## Lily · Plant the Bomb 5v5

O Lily é o mapa de **gi**, usado com a permissão do autor (Steam Workshop 2430950151; o autor agradece a **reoMeTpuR** pela ajuda e pelo retorno). O arquivo enviado, `mymaps_de_lily.bsp`, é um zip com o BSP Source 21 `de_lily.bsp`, que é extraído antes da conversão. Ele passa pelo mesmo importador do Wingman (`tools/import-wingman-maps.mjs`, em `FIVE_MAPS`): geometria, colisões e *player clips*, os 10 spawns de cada lado, os bombsites A e B (`func_bomb_target`) e a navegação (`maps/de_lily.nav`, embutida) vêm do BSP. Os caixotes, caminhões, o táxi e as caçambas são modelos padrão do CS, aproximados pelas regras do importador e assentados no chão.

**Texturas a partir das estruturas.** O BSP é uma versão de desenvolvimento: só tem oito materiais de cor lisa (`custom/lightergray`, `custom/gray`, `custom/lightred`, `custom/lightgray`, `custom/darkgray`, `custom/whitegray`, `custom/lighterbrown` e `laranja`), e o mesmo material aparece em estruturas diferentes. `tools/lily-style.mjs` classifica cada face pelo material, pela orientação, pela altura e pelo contexto:

- **Viaduto quebrado:** tudo acima de ~12,5 m na faixa do tabuleiro (células de 2 m onde há piso ou teto acima dessa altura), mais os pilares `darkgray` embaixo dela. Vira concreto; o tabuleiro vira asfalto, com faixas de pista pintadas: a direção vem do eixo principal das faces do tabuleiro, e em cada trecho há bordas contínuas a 0,5 m da beirada e faixa central tracejada (3 m pintados, 3 m vazios), recortadas dentro de cada face, 2 cm acima do asfalto.
A identidade é a mesma dos outros mapas (estilo VALORANT, como o Ascent, referência: artigo do 80.lv sobre um cenário VALORANT em Blender/Substance/Unreal): paleta quente e restrita e um padrão que se repete em todas as estruturas, em vez de uma cor por casa.

- **Telhados:** faces `lightred` voltadas para cima com inclinação de telhado (~32°) viram telha cerâmica, num tom só (dois tons de terracota muito próximos). Telhados ligados (vértices em comum) formam uma casa. A parte de baixo do beiral e as testeiras são madeira escura.
- **Paredes das casas:** três acabamentos, um por casa: reboco pêssego, reboco creme ou tijolo terracota. A casa de uma parede é o telhado logo acima de um ponto 45 cm para dentro dela; sem telhado em cima, vale o telhado mais próximo até 3,5 m; longe de casas, reboco creme. Faces no mesmo plano que se tocam ficam com o acabamento da maioria.
- **Rodapé de pedra:** toda parede vertical cuja base está no chão em frente a ela é cortada a 85 cm, e a faixa de baixo vira pedra (1.059 rodapés). Os vértices dos dois pedaços são cópias, porque o importador ainda desloca os vértices no lugar depois.
- **Arcadas sempre de tijolo:** a parte de baixo dos arcos (faces inclinadas para baixo entre 1 e 8 m) marca as arcadas. As casas que têm arcos ficam inteiras de tijolo, e tudo a até 2,5 m de um arco (pilares, frente dos arcos, fundo da arcada) também, para cada arcada ter um acabamento só.
- **Pedra clara:** colunas, sacadas, muretas e bases fora das arcadas (`whitegray` e `lightgray` nas paredes).
- **Interiores:** reboco creme (as paredes `lighterbrown`, laranja no original) e piso de madeira; tetos de reboco claro.
- **Chão:** `gray` vira lajes de pedra quente nas ruas; `whitegray` e `lightgray`, lajotas nas calçadas, plataformas e pátios. As faixas `lightred` no chão (borda dos bombsites) continuam pintadas de vermelho.
- **Escala única de textura:** as coordenadas de textura de todas as faces são recalculadas no plano da face, com um padrão a cada 64 unidades (o mesmo dos objetos), para o rodapé e as faces vizinhas casarem.

O resultado tem 67 casas reconhecidas e 44 trechos de faixa na pista.

Palace e Factory, os mapas anteriores do 5v5, saíram do jogo junto com o conversor de GLB deles.

## Calamari, Coldwater e Crown · Plant the Bomb 5v5

Portes 1:1 dos mapas da Steam Workshop: **Calamari** (Mac, Geno e Reydifox, 707503558), **Coldwater** (Mendaxyz e Praelium, 215971897) e **Crown** (Volcano e FMPONE, 239672577). Os BSPs (Source 21) vieram do release do repositório e passam pelo mesmo importador, em `FIVE_MAPS` com `real: true`: geometria, colisões e *player clips*, spawns, bombsites (`func_bomb_target`), navegação (`.nav` embutido) e os modelos com colisão própria (`.phy`).

| Mapa | Triângulos | Peças de colisão | Spawns (atac./def.) | Nós de navegação |
|---|---|---|---|---|
| Calamari | 65.894 | 18.196 | 20 / 19 | 8.050 |
| Coldwater | 46.731 | 25.107 | 20 / 16 | 7.020 |
| Crown | 108.967 | 27.434 | 16 / 16 | 14.113 |

**Entidades que não são sólidas.** Na primeira conversão o Coldwater tinha os 36 spawns desconectados e o Calamari 8: volumes como `func_precipitation`, `func_nav_blocker`, `func_clip_vphysics`, `func_smokevolume` e `func_hostage_rescue` viravam paredes. Agora ficam de fora, e `func_illusionary`/`func_lod` são desenhados sem colisão. A mensagem de erro da navegação também lista os spawns desconectados.

**Peso.** Os três são bem maiores que os outros mapas, então:

- `dispStep: 2` desenha os *displacements* (terreno) com 1 a cada 2 pontos da grade, com as mesmas bordas e cantos. A colisão usa sempre a grade completa: com a grade reduzida, o terreno não encostava no chão vizinho e sobravam quinas de poucos centímetros em que os bots enroscavam. Células planas da grade viram uma peça de colisão só, em vez de dois triângulos.
- `propCell` (`clusterModelFaces`) simplifica a malha dos modelos desenhados a partir das peças do `.phy`: cada vértice vai para o centro da sua célula de grade (10 cm no Calamari e no Coldwater, 20 cm no Crown) e os triângulos que somem saem. A colisão não muda.

**Cores (`tools/valorant-palette.mjs`).** As cores vêm dos materiais reais (VMT, refletividade do VTF e `$color`, como no Sable) e depois passam pela paleta do VALORANT: luminosidade com piso (`L' = max(L, 0,36 + 0,3·L)`, teto 0,86), saturação ×1,15 até 0,7, e o matiz mantido. A água (`liquids/…`, `cal_seawater`, `dev_waterbeneath`) vira turquesa claro na superfície e um turquesa mais fundo embaixo, em vez do cinza ou roxo do CS. Os pisos de madeira escura dos interiores ficam cor de mel, o chão de terra do Crown fica oliva claro.

## Portas, vidros e grades (`tools/map-objects.mjs`)

Análise feita nos BSPs de Neon, Forge, Sable, Lily, Calamari, Coldwater e Crown:

| O que havia | Como era convertido | Agora |
|---|---|---|
| `func_breakable` de vidro (11 no Calamari, 26 no Crown, 2 no Neon) e brushes `WINDOW` (273 no Neon, 62 no Calamari) | parede sólida, a bala parava | vidraça: segura o corpo, a bala passa e quebra o vidro; quebra também com HE |
| Grades e gradis com `.phy` (railgate, railingspiked, railing01/03, grades de janela do Dust) | o casco convexo do `.phy` desenhado como bloco maciço, bloqueando a bala | barras dentro da caixa do modelo; o corpo para no casco, a bala passa |
| Grades não sólidas no CS (gradis, grades de janela, treliças) | ficavam de fora: invisíveis | desenhadas como barras, sem colisão |
| Cercas e gradis sem `.phy` (chainlink, rusted_fence, railing) | placa de vidro translúcida ou bloco | tela de arame ou barras, mais uma colisão invisível só para o corpo |
| Brushes `GRATE` (95 no Neon, 5 no Coldwater) | cartão sólido que segurava a bala | barras; como no CS, a bala passa |
| `prop_door_rotating` (portão do A no Crown) | não era convertida (buraco na parede) | porta que abre com E |
| Portas com `.phy` entre dois lugares andáveis | bloco fixo | porta que abre; só quando a navegação original do CS tem área dos dois lados, para nenhuma porta dar para fora do mapa |
| Portas do Dust sem `.phy` (`dust_door_WxH`) | invisíveis | folha de madeira; se a navegação do CS passa por ali, sem colisão |
| Janelas, grades de janela e portas de enfeite que são modelos padrão do CS (82 grades de janela no Crown, as janelas de veneziana do Coldwater e do Calamari, janelas do Dust no Forge, portas italianas e de Veneza) | não vêm no BSP: a fachada ficava lisa onde havia janela | peça simples encostada na parede (moldura, vidro escuro, travessas, venezianas na cor do nome do modelo, barras ou folha de porta); a parede é achada com raios a partir da origem do modelo e a peça só entra se couber inteira na mesma parede (`decorateFacades`) |
| Vidraça do Sanctum (`func_breakable`) | parede sólida | vidraça como nos outros mapas (`tools/import-sanctum.mjs` também passa por `extractMapObjects`) |

**Como funciona.** `tools/source-bsp.mjs` marca de onde vem cada face e cada peça de colisão (brush do mundo com o conteúdo do BSP, entidade ou modelo). `extractMapObjects` agrupa vidraças e portas em objetos e testa cada um no próprio mapa. A vidraça precisa de espaço livre dos dois lados (senão é janela pintada na parede e fica como está), com espessura de até 45 cm. A porta precisa de chão andável dos dois lados. As grades viram barras (`barBoxes`: barras verticais com travessas, tela de arame ou treliça).

**No pacote do jogo.** Cada objeto ganha um trecho próprio de índices no fim da malha (`mesh.world` marca onde termina o mundo fixo) e a lista das suas peças de colisão (`meta.objects`). A porta leva também as duas posições abertas, giradas ±90° na dobradiça, que começam desligadas. A colisão tem um bit novo, 8 = vidro: `ray(o, d, limite, 8)` acha as vidraças no caminho da bala, e o tiro normal (bit 2) passa por elas. No runtime, `setDoor`, `breakGlass`, `restoreGlass` e `resetObjects` só trocam as máscaras. A navegação é feita com as portas abertas (`withDoorsOpen`), e os bots abrem a porta quando encostam nela.

## Blocos que dava para atravessar

Auditoria em todos os mapas convertidos: para cada face lateral visível na altura do corpo, ao lado de onde se anda, o teste verifica se há colisão logo atrás dela e faz um boneco andar até a face. A tabela mostra os lugares que ele atravessava:

| Mapa | Antes | Depois |
|---|---|---|
| Neon | 19 | 5 |
| Forge | 65 | 0 |
| Sable | 8 | 0 |
| Calamari | 25 | 17 (formas aproximadas do `.phy`, como sofá e fonte) |
| Coldwater | 34 | 4 (rampas de terreno muito inclinadas) |
| Crown | 75 | 5 |

Causas e correções:
- **Objetos marcados como não sólidos no CS** (pedras, pedregulhos, muros de pedra, contêineres, escombros de concreto, caixas elétricas, mesas): eram desenhados sem colisão. Coisa rígida agora colide sempre. Grade, gradil e o que não é rígido continuam passáveis, como no original.
- **Objetos tortos:** qualquer giro que não fosse múltiplo de 90° perdia a colisão, inclusive o caixote deitado de lado. Agora só fica sem colisão o que está a mais de 35° de qualquer eixo (deitado de verdade).
- **Caixotes com a medida no nome:** colidem sempre.
- **`func_brush`/`func_illusionary` que não colidem no CS:** ganham a colisão do próprio brush (`keepNonSolid` no compilador). Ficam de fora vegetação, água, vidro, cortina, fio, decalque fino e os lugares por onde a navegação do CS passa por dentro.
- **Fundo preto das janelas** (`cs_italy/black`, as janelas tampadas do Coldwater): virava um painel cinza liso. Agora é vidro escuro de janela e não dá mais para entrar por ele.

**Navegação.** A poda dos caminhos dos bots agora testa cada ligação também chegando já andando (meio passo antes, com velocidade) e com mais deslocamentos de lado. As rotas seguidas pelos bots são verificadas a partir das duas bases.

## Degraus e faces que mostravam o vazio

No CS, os lados de brush com `nodraw` ficam escondidos atrás de um modelo (a escada de madeira por cima dos degraus, por exemplo), e o compilador do BSP nem gera essas faces. Sem o modelo, sobravam buracos para o vazio. O compilador agora recria o polígono de cada lado `nodraw` dos brushes sólidos, recortando o plano do lado pelos outros planos do brush (`brushSidePolygon`, opção `keepNodraw`). `fillExposedNodraw` desenha só os lados que ficaram à mostra, com espaço livre na frente, sólido atrás e na altura de quem anda por perto. Cada um recebe a cor e o padrão da face visível mais próxima: 230 no Crown e 321 no Calamari, por exemplo.

## Regra: parede lisa nunca fica lisa

Como no VALORANT e nos próprios mapas do CS, nenhuma parede de reboco ou concreto em pé fica lisa. O material dos mapas convertidos (`makeMapMaterial` no `index.html`) e o dos mapas feitos no jogo (`assets/v2/world-renderer.js`) aplicam em toda parede vertical lisa (padrões reboco e concreto):

- manchas largas;
- escorridos de chuva;
- pedaços de reboco descascado com borda mais escura e o tijolo aparecendo.

Tudo é calculado pela posição no mundo, então nada se repete em grade e o tom de cada material continua o mesmo. Nos mapas convertidos, o tijolo é o do atlas de texturas; nos mapas do jogo, é desenhado em fiadas, com meio tijolo de deslocamento e rejunte.

## Movimento em pisos, escadas e rampas

A colisão nativa agora separa o movimento horizontal do apoio dos pés. O corpo é varrido acima da janela normal de degrau; o apoio procura as superfícies sob a mesma largura usada na colisão, inclusive as bordas. Assim, as costuras dos triângulos e espelhos dos degraus não funcionam como paredes laterais. A altura máxima de degrau continua em 0,5 m; paredes maiores e tetos baixos continuam sólidos. A queda e o salto mantêm a resolução de colisão vertical.

A escada vertical de Guard também procura uma saída livre para o patamar próximo à altura útil do trigger. A transferência só ocorre com espaço para o corpo e varreduras livres na subida e na passagem, evitando o bloqueio na borda superior. Pular continua soltando a escada.

Os testes percorrem as rotas entre as bases e os bombsites dos quatro mapas do 5v5, mais de 500 aproximações deslocadas de rampas/degraus nos mapas do Wingman, no Prefire e no 5v5, a escada vertical de Guard do piso ao patamar, e uma escadaria a 30/60/144 FPS que termina numa parede alta. As verificações usam a física do jogador, sem teleporte nem salto para transpor os degraus.
