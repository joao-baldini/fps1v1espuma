# Guard e Elysion

Conversão offline dos BSPs fornecidos pelo usuário: `de_guard_csgo.bsp` e `de_elysion.bsp`, extraídos de `guard_feito_por_mim.zip` e `de_elysion_9e838.rar`. Guard é de **poLemin**; Elysion é de **Big_SG21**. Os arquivos fornecidos são ports de **Alex Road**. Os relatórios `*-source.json` registram o SHA-256 de cada BSP, posições, escala, navegação e contagens.

## Geometria e acabamento

Os polígonos de paredes, pisos, escadas e displacements são extraídos diretamente, sem redesenhar as rotas por aproximação. Usa-se a escala de 0,0254 m por unidade Source. As coordenadas são recentradas, preservando distâncias e alturas. Displacements estritamente planos viram um único quadrilátero; os demais mantêm a triangulação nativa.

As colisões vêm dos brushes convexos e dos arquivos PHY embutidos dos objetos sólidos. Os objetos são representados por suas malhas físicas simplificadas; ornamentos sem colisão são omitidos. Portanto o acabamento visual é simplificado, mesmo mantendo a base do BSP. Vidro usa uma segunda faixa transparente da mesma malha. Player clips bloqueiam movimento, mas não tiros. A escada vertical de Guard permite subir/baixar e soltar pulando; bots usam as rotas de escadas.

As cores chapadas vêm das médias RGB dos materiais do BSP e dos materiais embutidos dos modelos. Preto e branco recebem limites leves para manter legibilidade. Não são exportadas imagens, VMTs, VTFs, iluminação ou áudio; o shader de grade é o mesmo do jogo.

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
