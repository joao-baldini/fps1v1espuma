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

O importador geral do Wingman também encaminha Sanctum para esse conversor novo. Neon, Forge e Overgrowth continuam usando suas conversões anteriores.

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

## Sable · Wingman

O Sable é o mapa de **dorg**, usado com a permissão do autor (Steam Workshop 1369768878). O arquivo enviado, `de_sable.bsp`, é um zip com o BSP Source 21 dentro e é extraído antes da conversão. Ele passa pelo mesmo importador do Wingman.

A estrutura é a do original, sem mudanças: a geometria, as alturas, as colisões e os *player clips* vêm do BSP; os 7 spawns de cada lado, o bombsite A e a navegação também. Não há tapumes nem bloqueios novos.

O acabamento usa as cores reais de cada material, pelo mesmo método do Neon (`styleNeon` em `tools/neon-style.mjs`): o VMT e o VTF embutidos quando existem; senão, a refletividade que o BSP guarda de cada textura, convertida para sRGB. O desenho fica com os padrões procedurais do jogo: tijolo, reboco, madeira, pedra, telhado e paralelepípedo, conforme o nome do material. As texturas originais do CS (`de_inferno/hr_i` e outras) não vêm dentro do BSP, então não há imagens.

O mapa não traz nenhum modelo próprio: os 627 objetos são modelos padrão do CS. Eles são aproximados pelas regras do importador (barris, fardos de feno, caixotes, ciprestes, pilares, grades...). Os caixotes usam as medidas reais tiradas das pilhas do mapa (o nome do modelo não é a medida: o caixote de vinho tem 62 unidades), e as lonas (`_tarp`), que são só um pano sobre um caixote que já existe, ficam de fora. Os caixotes têm moldura, tábuas e travessa; os barris são de madeira com aros. O corredor coberto ganhou varais de lanternas de papel acesas no lugar dos modelos `street_lanterns`, e os lampiões viraram luzes pequenas. Ruas de laje usam lajotas; calçamento usa paralelepípedos; os corredores têm painéis de madeira. Regras extras (`SABLE_PROPS`) também cobrem a Vespa, os sofás, as cadeiras, os sacos e as floreiras. Enfeites finos (molduras, calhas, janelas, portas na parede) ficam de fora, como nos outros mapas. O tema de luz é o `terracota`.

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

```powershell
node tools/import-source-maps.mjs "caminho/de_guard_csgo.bsp" "caminho/de_elysion.bsp"
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

## Palace e Factory · 5v5

Os ZIPs fornecidos contêm `source/DVORETS.glb` e o Factory, sem imagens ou texturas incorporadas.

**Factory 5v5 — autoria:** mapa próprio de **guilhxrme e João**, conforme a declaração do usuário e os metadados do arquivo `source/Factory_5v5_guilhxrme_Joao.glb` (ZIP `Factory_5v5_guilhxrme_Joao.zip`). Os campos `asset.copyright` e `asset.extras` (`title`, `authors`, `creator`, `project`) e os `extras` da cena trazem esses nomes; o jogo não altera esses metadados. O mapa foi recriado a partir desse arquivo (hash de origem `31da400e…` em `factory-source.json`). O crédito "Factory 5v5 · guilhxrme e João" aparece no menu e no início da partida.

`tools/gltf.mjs` lê os buffers GLB e aplica as transformações dos nós, inclusive as escalas não uniformes dos modelos. `tools/import-warface-maps.mjs` converte os triângulos diretamente, sem redesenhar as rotas. Depois das transformações do GLB, cada mapa recebe uma escala própria, horizontal e vertical. Factory também é girado para corresponder à vista original.

- **Palace:** usa 1,25 em tudo.
- **Factory:** usa **1,5 na horizontal e a altura original do modelo (1,0)**. Com 1,25 em tudo, as paredes chegavam a ~5,7 m (mais de três vezes a altura do jogador), as caixas a 2,5 m e o mapa ficava com 36 × 58 m, pequeno para 5 contra 5. Agora:
  - as paredes têm ~4,5 m, e caixas e contêineres, 2 m;
  - os tanques têm 5,3 e 7,5 m de altura, com seção redonda;
  - o mapa tem 69 × 43 m;
  - as passagens mais estreitas passaram de ~3,4 m para ~4,0 m;
  - os trechos cobertos têm teto de 2,1 a 2,7 m;
  - as escadas ficaram mais suaves.

Palace tem cerca de **2.480 triângulos** e Factory, **2.556**. Geometria, colisões e navegação são carregadas somente ao entrar na partida.

Conforme a preferência do usuário, as cores seguem a aparência original do Warface, adaptada ao acabamento chapado do jogo: pedra clara e detalhes azuis no Palace; tijolo, concreto, metal e contêineres no Factory. Referências visuais: [Palace — publicação oficial](https://ps.wfclutch.com/en/news/111.html), [Factory 2.0 — publicação oficial no Steam](https://store.steampowered.com/news/posts/?appids=291480&enddate=1532340210). Os materiais de depuração azul, verde e vermelho dos GLBs não são usados como paleta final.

Os relatórios `palace-source.json` e `factory-source.json` registram os hashes dos GLBs, a escala usada, dimensões originais, pontos de nascimento, bombsites, contagens e navegação. `warface-catalog.js` contém apenas os metadados do menu. Cada lado recebe cinco spawns sem sobreposição; as direções iniciais favorecem passagens abertas. Os sites e todos os spawns pertencem à mesma região navegável. O código de partida reutiliza a lógica de bomba existente com cinco jogadores por time, mantendo a IA disponível para evolução separada.

Os SVGs `palace-minimap.svg` e `factory-minimap.svg` são gerados da navegação, com spawns e sites. O HUD sobrepõe apenas jogador e aliados, atualizando no máximo a cada 80 ms. As cores dos spawns identificam o lado: azul é defesa e vermelho é ataque. As prévias WebP do menu são renderizadas da geometria final, em vez de usar imagens promocionais externas.

```powershell
node tools/import-warface-maps.mjs palace="caminho/DVORETS.glb" factory="caminho/Factory_5v5_guilhxrme_Joao.glb"
node --test tests/game.test.cjs
```

## Movimento em pisos, escadas e rampas

A colisão nativa agora separa o movimento horizontal do apoio dos pés. O corpo é varrido acima da janela normal de degrau; o apoio procura as superfícies sob a mesma largura usada na colisão, inclusive as bordas. Assim, as costuras dos triângulos e espelhos dos degraus não funcionam como paredes laterais. A altura máxima de degrau continua em 0,5 m; paredes maiores e tetos baixos continuam sólidos. A queda e o salto mantêm a resolução de colisão vertical.

A escada vertical de Guard também procura uma saída livre para o patamar próximo à altura útil do trigger. A transferência só ocorre com espaço para o corpo e varreduras livres na subida e na passagem, evitando o bloqueio na borda superior. Pular continua soltando a escada.

Os testes percorrem as rotas entre as bases e os bombsites dos dois mapas novos, mais de 500 aproximações deslocadas de rampas/degraus em Guard, Elysion, Prefire e Palace, a escada vertical de Guard do piso ao patamar, e uma escadaria a 30/60/144 FPS que termina numa parede alta. As verificações usam a física do jogador, sem teleporte nem salto para transpor os degraus.
