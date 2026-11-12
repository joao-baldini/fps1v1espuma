# Mapas nativos: Guard, Elysion, Inferno Prefire, Palace e Factory

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

Os ZIPs fornecidos contêm `source/DVORETS.glb` e `source/warface map.glb`, sem imagens ou texturas incorporadas. `tools/gltf.mjs` lê os buffers GLB e aplica as transformações dos nós, inclusive as escalas não uniformes dos modelos. `tools/import-warface-maps.mjs` converte os triângulos diretamente, sem redesenhar as rotas. Uma escala uniforme de 1,25 adapta os vãos à altura do jogador; Factory é girado para corresponder à vista original. Palace tem cerca de **2.480 triângulos** e Factory, **2.556**. Geometria, colisões e navegação são carregadas somente ao entrar na partida.

Conforme a preferência do usuário, as cores seguem a aparência original do Warface, adaptada ao acabamento chapado do jogo: pedra clara e detalhes azuis no Palace; tijolo, concreto, metal e contêineres no Factory. Referências visuais: [Palace — publicação oficial](https://ps.wfclutch.com/en/news/111.html), [Factory 2.0 — publicação oficial no Steam](https://store.steampowered.com/news/posts/?appids=291480&enddate=1532340210). Os materiais de depuração azul, verde e vermelho dos GLBs não são usados como paleta final.

Os relatórios `palace-source.json` e `factory-source.json` registram os hashes dos GLBs, dimensões originais, pontos de nascimento, bombsites, contagens e navegação. `warface-catalog.js` contém apenas os metadados do menu. Cada lado recebe cinco spawns sem sobreposição; as direções iniciais favorecem passagens abertas. Os sites e todos os spawns pertencem à mesma região navegável. O código de partida reutiliza a lógica de bomba existente com cinco jogadores por time, mantendo a IA disponível para evolução separada.

Os SVGs `palace-minimap.svg` e `factory-minimap.svg` são gerados da navegação, com spawns e sites. O HUD sobrepõe apenas jogador e aliados, atualizando no máximo a cada 80 ms. As cores dos spawns identificam o lado: azul é defesa e vermelho é ataque. As prévias WebP do menu são renderizadas da geometria final, em vez de usar imagens promocionais externas.

```powershell
node tools/import-warface-maps.mjs "caminho/DVORETS.glb" "caminho/warface map.glb"
node --test tests/game.test.cjs
```

## Movimento em pisos, escadas e rampas

A colisão nativa agora separa o movimento horizontal do apoio dos pés. O corpo é varrido acima da janela normal de degrau; o apoio procura as superfícies sob a mesma largura usada na colisão, inclusive as bordas. Assim, as costuras dos triângulos e espelhos dos degraus não funcionam como paredes laterais. A altura máxima de degrau continua em 0,5 m; paredes maiores e tetos baixos continuam sólidos. A queda e o salto mantêm a resolução de colisão vertical.

A escada vertical de Guard também procura uma saída livre para o patamar próximo à altura útil do trigger. A transferência só ocorre com espaço para o corpo e varreduras livres na subida e na passagem, evitando o bloqueio na borda superior. Pular continua soltando a escada.

Os testes percorrem as rotas entre as bases e os bombsites dos dois mapas novos, mais de 500 aproximações deslocadas de rampas/degraus em Guard, Elysion, Prefire e Palace, a escada vertical de Guard do piso ao patamar, e uma escadaria a 30/60/144 FPS que termina numa parede alta. As verificações usam a física do jogador, sem teleporte nem salto para transpor os degraus.
