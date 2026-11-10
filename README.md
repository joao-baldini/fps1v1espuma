# aim_duelo

Duelo 1v1 e Deathmatch inspirado no CS2 que roda no navegador. O jogo continua em um arquivo só (`index.html`), com geometria leve, áudio sintetizado, cinco arenas de duelo e um mapa próprio para DM. Sem modelos, texturas ou arquivos de som pesados.

## Como jogar com seu parceiro

1. Abra o jogo pelo GitHub Pages (ou abra o `index.html` direto no Chrome).
2. Os dois digitam o **mesmo código de sala** e clicam em **Entrar na sala 1v1**.
3. Quem entrar primeiro cria a sala e vira o juiz das rodadas. Quando o segundo conecta, a partida começa sozinha.

A conexão é direta entre os dois navegadores (WebRTC via PeerJS). O servidor público do PeerJS só faz o pareamento; o jogo em si não passa por servidor. Algumas redes corporativas bloqueiam conexão direta. Se não conectar em 15 segundos, testem fora da VPN ou em outra rede.

Sem parceiro? Use **Treinar contra bot** (fácil, médio ou difícil).

## Deathmatch

Em **Mapa**, escolha **Distrito DM · todos contra todos · 10 jogadores**. Selecione **Somente pistolas**, **Somente precisão**, **Somente rifles** ou **Tudo liberado**, escolha a dificuldade e clique em **Jogar Deathmatch · 5 minutos**. A categoria limita suas armas e as dos bots; a faca continua disponível. Suas armas vêm do equipamento escolhido na aba **Armas**. Os bots sorteiam uma arma permitida a cada nascimento; a opção de capacete vale para todos eles.

Você enfrenta **donk, ZywOo, m0NESY, NiKo, KSCERATO, ropz, YEKINDAR, molodoy e coldzera**. É todos contra todos: os bots enxergam, perseguem e acertam uns aos outros com os mesmos raios de tiro, colisões e cálculo de dano usados contra o jogador. Os nomes não alteram a dificuldade.

- Preparação de 3 segundos, seguida de **5 minutos completos** de partida.
- Respawn automático após **1,5 segundo**, com vida e carregador cheios. A escolha entre 18 pontos prioriza distância dos vivos e cobertura.
- Proteção de **1,8 segundo** ao nascer, encerrada ao mover ou atirar; os bots seguem a mesma regra. Um anel azul identifica bots protegidos.
- Reserva de munição infinita, com carregadores, cadência e recargas normais.
- Killfeed mantém os últimos oito abates, inclusive bot contra bot. **Tab** mostra os dez participantes; no menu, use **Ver placar do Deathmatch**.
- Vence quem tem mais abates; desempates por menos mortes e depois mais headshots. Empates exatos dividem a vitória. Ao zerar o relógio, tiros, respawns e placar param; é possível jogar novamente ou voltar ao menu.

O mapa tem quatro conjuntos de coberturas, pátio central e rotas pelo perímetro. Usa o mesmo piso branco e paredes azuis dos mapas atuais. O relógio continua no menu e ao trocar de aba; a simulação gráfica fica suspensa em abas ocultas.

## Equipamento

Abra a aba **Armas**, ou clique em **Escolher armas e equipamento do bot**, antes de entrar na partida. Escolha uma arma de cada categoria e a categoria equipada ao nascer. As escolhas ficam salvas no navegador e funcionam tanto no 1v1 quanto no treino. Mudanças durante a partida entram na próxima rodada.

| Tecla | Categoria | Opções |
|---|---|---|
| 1 | Rifle | AK-47, M4A4, M4A1-S com silenciador |
| 2 | Pistola | Desert Eagle, USP-S com silenciador |
| 3 | Faca | Karambit, Butterfly |
| 4 | Precisão | AWP, SSG 08 (Scout) |

O bot pode usar qualquer uma das sete armas de fogo, com sua própria cadência, carregador e recarga. Também é possível escolher se ele tem capacete: a proteção aparece no personagem e reduz apenas o dano na cabeça. A USP-S mata com um HS de perto sem capacete e exige mais de um com capacete; seu dano cai com a distância. Os jogadores usam capacete no 1v1.

As facas têm animações distintas de puxada, inspeção, corte e estocada. A Butterfly é compacta, com lâmina curva simples e dois cabos lisos, sem recortes ou enfeites. A puxada de 0,8 s e a inspeção de 4,2 s seguem a sequência do vídeo de referência: subir com a faca fechada, abrir, girar o pulso e segurar; na inspeção, apoiar no indicador e exibir a lâmina antes de voltar. Os dedos da mão direita abrem e fecham; a mão esquerda fica baixa, com dedos separados e o punho conectado ao antebraço. Os cortes alternam de direção; o botão direito faz uma estocada. Segurar o botão repete o ataque na cadência da faca. Atacar interrompe a inspeção com uma transição curta. A Deagle tem ferrolho móvel, recuo visual mais forte e som mais grave. São recriações estilizadas em geometria do próprio jogo.

A Karambit tem modelo e animações próprios: lâmina contínua em garra, cabo arredondado e anel apoiado no indicador, em pegada invertida. A puxada de 0,65 s gira a faca pelo anel e fecha a mão sobre o cabo. A inspeção de 2,8 s gira, exibe a lâmina e retorna; cortes e golpe forte usam movimentos específicos. O indicador permanece fechado no anel quando os outros dedos se abrem. Em repouso, há apenas uma respiração leve, com transição contínua ao terminar uma ação. A interpolação cúbica mantém a velocidade contínua entre poses, sem ultrapassar os pontos de captura. A pegada usa esta [referência visual de CS2 na Comunidade Steam](https://steamuserimages-a.akamaihd.net/ugc/2095921547381812206/7B4754A7E72DFF2350B1CC9C75BED2E55EA42306/). A butterfly mantém seu modelo, pegada e animações.

## Mapas

Os cinco mapas de duelo são simétricos (girados 180°), com chão branco e uma parede na frente de cada base, então ninguém nasce vendo o outro. Lado e ponto de nascimento são sorteados a cada rodada.

| Mapa | Cor | O que tem |
|---|---|---|
| Caixas | azul | Arena aberta cheia de caixas |
| Pátio | amarelo | Praça elevada no centro, com rampa saindo de cada base |
| Torres | verde | Uma torre ao lado de cada base, com rampa vindo do meio |
| Ponte | roxo | Ponte elevada no meio; dá para passar por baixo |
| Fortes | laranja | Cada base fica num forte elevado, com duas rampas descendo e um muro alto no meio |
| Rotação | — | Fila com os 5 mapas em ordem aleatória; quando a fila acaba, embaralha de novo |
| Distrito DM | azul | Arena exclusiva de todos contra todos, com dez participantes e respawn |

Vale o mapa escolhido por quem criou a sala.

## Regras

- Primeiro a 10 rodadas vence (dá para mudar para 5, 8, 13 ou 16).
- 3 s de freeze no começo de cada rodada. Rodada acaba na primeira morte.
- Se o tempo acabar, vence quem tiver mais vida.
- 100 de vida, sem colete. Capacetes reduzem o dano na cabeça conforme a penetração da arma. Na AK e na Deagle, corpo e pernas levam o mesmo dano.
- Lado e ponto de nascimento são sorteados a cada rodada.

| Arma | Corpo | Cabeça sem capacete / com | Carregador |
|---|---|---|---|
| AK-47 | 27 | 144 / 112 | 30 |
| M4A4 | 33 | 132 / 92 | 30 |
| M4A1-S | 38 | 132 / 92 | 20 |
| Desert Eagle | 40 | 212 / 198 | 7 |
| USP-S | 35 | 140 / 71 | 12 |
| AWP | 115 | 460 / 449 | 5 |
| SSG 08 | 88 | 352 / 299 | 10 |
| Karambit / Butterfly | 40 / 65 | — | — |

Valores de perto. O dano no corpo da AK, Deagle e AWP foi preservado do jogo anterior.

## Movimento e precisão

Aceleração, atrito e controle aéreo seguem uma aproximação do movimento Source, com simulação em passos fixos de 1/128 s. Soltar as teclas desacelera; contra-strafe freia mais rápido e recupera a precisão. A diagonal não ganha velocidade. Shift anda a 52% da velocidade e agachado a 34%. A luneta usa a velocidade própria da AWP ou da Scout.

**Bunnyhop assistido** vem ligado: segure Espaço para pular novamente ao tocar o chão. Para ganhar controle no ar, solte W, alterne A/D e acompanhe o movimento com o mouse. É possível desligar a assistência e usar pulos manuais ou configurar a rodinha para pular. Nesse caso, troque armas pelas teclas 1–4 ou Q. A velocidade aérea tem limite para impedir aceleração ilimitada.

Atirar correndo ou no ar aumenta a dispersão; parar ou agachar melhora a precisão. Os rifles têm spray, com recuo menor nas M4s. A Scout recupera parte da precisão no ápice do salto. O recuo da câmera acompanha o desvio dos tiros.

É uma aproximação própria para este jogo no navegador, sem o motor Source 2 nem os assets do CS2. Referência de movimento: [código do Source publicado pela Valve](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp). Parâmetros das armas: [dados do jogo espelhados pelo SteamTracking](https://github.com/SteamTracking/GameTracking-CS2/blob/master/game/csgo/pak01_dir/scripts/weapons.vdata), adaptados ao balanceamento existente.

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Shift | Andar devagar (sem passos) |
| C | Agachar (no ar, encolhe as pernas para subir nas caixas) |
| Espaço | Pular / segurar para bunnyhop assistido |
| Mouse 1 | Atirar |
| Mouse 2 | Luneta da AWP ou Scout / golpe forte da faca |
| 1 2 3 4 | Rifle, pistola, faca e precisão do equipamento escolhido |
| Q / rodinha | Última arma / trocar arma |
| R | Recarregar |
| F | Inspecionar (giros da Karambit e Butterfly) |
| Tab | Placar |
| Esc | Menu e configurações |

## Configurações

- **Cor do boneco:** escolha antes de entrar na sala. É a cor que o oponente vê.

- **Mira:** estilo estático ou dinâmico, cor, tamanho, espessura, espaço, contorno, ponto central, formato T, opacidade.
- **Mouse:** sensibilidade na escala do CS (mostra o equivalente no Valorant e os cm/360 pelo seu DPI) e sensibilidade da luneta.
- **Vídeo:** FOV (horizontal 4:3, CS = 90), escala de resolução, ajuste automático de resolução e contador de FPS.

Tudo fica salvo no navegador.

## Desempenho e desenvolvimento

Sem pós-processamento, sombras em tempo real ou antialiasing. O mapa e as partes estáticas das armas usam geometria agrupada; impactos e rastros são reutilizados. As animações só transformam grupos existentes. A resolução padrão não multiplica pixels por telas de DPI alto. O ajuste automático reduz a resolução quando o tempo médio de quadro sobe; o menu renderiza a 30 FPS e abas ocultas suspendem a atualização.

No DM, os nove bots compartilham geometria por instanciamento: corpo, cabeça, capacete e sete modelos de arma, com efeitos reutilizados. A navegação calcula a malha uma vez e reutiliza buffers de busca; a percepção dos bots é distribuída ao longo dos quadros. Áudio e passos simultâneos têm limite próprio para evitar picos.

Mouse bruto quando disponível, disparo processado no evento de clique e envio imediato de tiros no 1v1. A latência final depende do navegador, monitor, hardware e rede; não há garantia de latência zero ou desempenho igual em todos os PCs.

Prévia local com Node.js 22 ou mais recente: `node tools/serve.mjs`, depois abra `http://127.0.0.1:8081`. Use `--port=8082` para trocar a porta. O servidor aceita um caminho de vídeo opcional para revisão local em `/reference.mp4`; esse vídeo não é incorporado ao jogo.

A página `/tools/knife-preview.html` permite visualizar as facas isoladas ou na mão e reproduzir cada animação, com uma régua para conferir poses intermediárias. Ela reutiliza a geometria, as posições e as animações de `index.html` e usa enquadramento 16:9. Não é carregada pelo jogo. A Butterfly isolada usa 212 triângulos e três chamadas de desenho; com mãos e braços, cerca de 668 triângulos e 11 chamadas. A animação dos dedos reutiliza uma única geometria com interpolação na GPU.

Use `/tools/knife-preview.html?weapon=knife` para abrir diretamente a Karambit. O modelo tem 1.080 triângulos e três chamadas de desenho; com mãos e braços, cerca de 1.536 triângulos e 11 chamadas. Lâmina, cabo e anel compartilham geometria entre primeira e terceira pessoa. As curvas são criadas uma única vez; as animações reutilizam os mesmos grupos e buffers.

Testes sem dependências: `node --test tests/game.test.cjs`. Cobrem as 24 combinações de equipamento, dano e capacete, recargas e armas do bot, precisão, contra-strafe, diagonal, consistência entre 30/60/144 FPS, bunnyhop, colisões, rampas e animações das facas. Também verificam os dez participantes do DM, categorias, navegação, spawns, proteção, autoria dos abates, confrontos reais entre bots nas quatro categorias, recargas e encerramento exato de cinco minutos.

## Publicar no GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch `main`, pasta `/ (root)`.
