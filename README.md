# aim_duelo

FPS inspirado no CS2 que roda no navegador, com **1v1**, **2v2**, **XvX**, **Plant the Bomb**, **TDM**, **DM** e treino de mira no **Aimbotz**. O jogo roda em `index.html`, com geometria leve, áudio sintetizado, cinco arenas de duelo, quatro mapas de DM e dois mapas de bomba. O menu usa prévias dos mapas em WebP.

## Modos de jogo

Na tela **Jogar**, escolha o modo e selecione a arena na faixa de mapas. O mapa escolhido aparece em destaque. No painel da partida, escolha **Contra bots** ou **Com amigos** e ajuste as opções antes de iniciar. O Aimbotz entra direto no treino. A engrenagem abre as configurações; o equipamento mostra as silhuetas das armas escolhidas.

| Modo | Sozinho | Online |
|---|---|---|
| 1v1 | Treinar contra bot (fácil, médio ou difícil) | Sala com o mesmo código para duas pessoas |
| 2v2 | Você e um bot aliado contra dois bots | Sala para até 4 pessoas; bots completam as vagas |
| XvX | Times de 1 a 8 de cada lado (1v5, 3v3, 8v8…), completados por bots | Sala para até 16 pessoas, no tamanho escolhido por quem cria |
| Plant the Bomb | Você e um bot (Terroristas ou SWAT) contra dois bots, regras do Wingman | — |
| TDM | Dois times de 2 a 8 nos mapas de DM, renascimento contínuo | — |
| DM | Você + 9 bots, todos contra todos, 5 minutos | Sala com código para até 10 pessoas; bots completam as vagas |
| Aimbotz | Treino livre de mira com 1 a 12 bots | — |

## Como jogar com seu parceiro

1. Abra o jogo pelo GitHub Pages (ou abra o `index.html` direto no Chrome).
2. Escolha **1v1** ou **2v2** e **Com amigos**. Todos digitam o **mesmo código de sala** e clicam em **Entrar na sala**.
3. Quem entrar primeiro cria a sala e vira o juiz das rodadas. Quando o segundo conecta, a partida começa sozinha.

A conexão é direta entre os dois navegadores (WebRTC via PeerJS). O servidor público do PeerJS só faz o pareamento; o jogo em si não passa por servidor. Algumas redes corporativas bloqueiam conexão direta. Se não conectar em 15 segundos, testem fora da VPN ou em outra rede.

Sem parceiro? Use **Treinar contra bot** no 1v1 ou **Jogar 2v2 com bots**.

## 2v2 e XvX

No **XvX**, escolha o tamanho de **Seu time** e do **Time inimigo** (1 a 8 cada); o resto funciona como no 2v2. Rodadas de dois contra dois nos mapas de duelo, com as mesmas regras do 1v1: 3 s de freeze, primeiro a N rodadas, sem respawn dentro da rodada. A rodada acaba quando um time inteiro morre; se o tempo acabar, vence o time com mais vida somada. Não há fogo amigo: tiros param no aliado sem causar dano. Aliados aparecem em azul, com um marcador sobre a cabeça; inimigos em vermelho. O placar no topo mostra quantos de cada time estão vivos.

- **Com bots:** você e um bot aliado contra dois bots, na dificuldade escolhida. Os bots sorteiam uma arma a cada rodada, passam a posição de inimigos vistos para o aliado e saem para caçar depois de alguns segundos.
- **Online:** quem cria a sala vira o juiz: roda os bots, a rodada e o placar e retransmite tudo para as outras pessoas (até 4 por sala no 2v2; no XvX, até o total das duas equipes). Em **Times na sala 2v2**, escolha *pessoas em lados opostos* (cada uma com um bot aliado) ou *pessoas no mesmo time contra bots*. Quando alguém entra ou sai, começa uma partida nova e um bot assume a vaga livre. Cada pessoa controla o próprio movimento e a própria vida, como no 1v1.

## Plant the Bomb (Wingman)

Terroristas (ataque) contra SWAT (defesa), com as regras do modo Wingman do CS. Antes da partida você escolhe um **operador**.

- **Partida:** primeiro a 9 rodadas, troca de lado depois da 8ª (a economia recomeça); 8 a 8 termina empatado.
- **Tempos:** 10 s de preparação, compra até 20 s depois do início da rodada, 1:30 de rodada, bomba de 40 s. Plantar leva 3,2 s; desarmar leva 10 s, ou 5 s com kit.
- **Economia:** $800 iniciais e teto de $8.000. A vitória paga $3.250, ou $3.500 por bomba ou desarme. A derrota paga $1.400, mais $500 por derrota seguida, até $3.400; quem plantou e perdeu ganha mais $800. Plantar ou desarmar paga $300. O abate paga conforme a arma: faca $1.500, escopeta $900, SMG $600, AWP $100 e o resto $300.
- **Loja (B):** pistolas, SMG e escopeta, rifles (AK só para Terroristas, M4 só para SWAT), precisão, granadas (1 HE, 2 flashes, 1 smoke, até 4 no total) e equipamento (colete, colete + capacete, kit de desarme só para SWAT). Só compra perto do próprio spawn e dentro do tempo. **Botão direito vende** o que foi comprado nesta rodada pelo preço cheio e devolve o equipamento anterior. O colete reduz o dano no corpo conforme a penetração da arma.
- **Teclas:** 1 primária, 2 pistola, 3 faca, 4 alterna granadas, 5 bomba. Plante segurando **E** no bombsite (ou o clique com a C4 na mão) e desarme segurando **E** perto da bomba. Quem carrega a bomba e morre deixa ela no chão; um Terrorista pega passando por cima.
- **Bots:** compram conforme o dinheiro, carregam e plantam a bomba, seguram o site, desarmam, buscam a bomba caída e usam smoke, flash e HE.
- **HUD:** dinheiro, colete, C4, barra de plantar/desarmar, relógio da bomba e o nome da área onde você está.

### Operadores

A habilidade fica na tecla **X**, com uma carga por rodada. Cada time recebe um de cada.

| Operador | Habilidade | Visual |
|---|---|---|
| Finder | Abre o minimapa; o clique escolhe uma área de 20 m e, após um pulso, revela por 3 s os inimigos dentro dela | Viseira ciano e antena |
| Detector | Coloca um alarme no chão, que o inimigo só enxerga a menos de 7 m. Quem chega a 3,2 m faz ele apitar, fica revelado por 4 s e o alarme se destrói. Pode ser destruído a tiro, com aviso para o dono | Mochila laranja com sinalizador |

### Mapas de bomba

Os sites com o radar oficial não estavam acessíveis; as áreas vêm das notas de atualização do CS:GO e do autor de cada mapa.

- **Guard (Praga):** bombsite A no cais à beira do rio, com as coberturas viradas para a ponte e para os arcos. Ponte Carlos com estátuas, torre da ponte, pit, lixeira, ladder hole, escada com meia parede e conector até o spawn da SWAT. Do lado dos Terroristas: restaurante, loja de vidro, bicicletas, caminhão e a obra. O rio tem água rasa e deixa mais lento.
- **Elysion (39º andar):** spawn TR com a mesa da recepção, meio em dois níveis com as paredes de cascata, área externa com duas portas para o A, salão com obras de arte, bombsite A com a parede central, o letreiro ELYSION e o guarda-corpo das janelas, e a SWAT atrás da parede de vidro com o relógio.

## TDM

Dois times de 2 a 8 (você e bots contra bots) nos mapas de DM, com renascimento contínuo e sem fogo amigo. Cada time começa numa metade do mapa e quem morre renasce longe dos inimigos. Vence o primeiro time a chegar a 10 abates por jogador, ou o que tiver mais abates ao fim de 10 minutos.

## Armas novas e granadas

- **UMP-45:** submetralhadora automática, precisa em movimento, perde dano com a distância.
- **Bucky:** escopeta com 12 chumbos por disparo; o dano soma por vítima. Letal de perto e fraca de longe.
- **HE:** explode em 1,6 s, até 98 de dano caindo com a distância (7 m), só com linha de visão.
- **Flash:** cega por até 3,6 s quem olha para ela; de lado cega menos, de costas quase nada.
- **Smoke:** estoura ao parar, nuvem de 3,2 m por 18 s que bloqueia a visão dos bots e a flash.

Clique esquerdo lança a granada longe; o direito joga perto. As granadas quicam nas paredes e no chão. UMP-45 e Bucky entram no slot primário em todos os modos; as granadas são compradas no Plant the Bomb.

## Deathmatch

Em **Modo de jogo**, escolha **DM**. Selecione **Medina**, **Dust II**, **Depósito** ou **Borgo**, a categoria de armas e a dificuldade. Para jogar sozinho, use **Jogar DM com bots**. Para jogar com amigos, todos digitam o mesmo código e clicam em **Entrar na sala de DM**. Quem chega primeiro cria a sala e define o mapa. Cada pessoa que entra assume a vaga de um bot durante a partida, e um bot volta se alguém sai. A categoria limita as armas de todos, e a faca continua disponível. Suas armas vêm do equipamento escolhido na aba **Armas**. Os bots sorteiam uma arma permitida a cada nascimento, e a opção de capacete vale para todos eles.

Você enfrenta **donk, ZywOo, m0NESY, NiKo, KSCERATO, ropz, YEKINDAR, molodoy e coldzera**. Os bots enxergam, perseguem e acertam uns aos outros com os mesmos raios de tiro, colisões e cálculo de dano usados contra o jogador. Os nomes não alteram a dificuldade.

- Preparação de 3 segundos, seguida de **5 minutos completos** de partida.
- No início, o jogo distribui os participantes pelos pontos do mapa, priorizando distância e pontos sem visão entre si. Cada ponto olha para a rota mais aberta.
- Abate recarrega o carregador na hora; abate com tiro na cabeça também cura **50 de vida** (até 100). Vale para pessoas e bots.
- Respawn automático após **1,5 segundo**, com vida e carregador cheios. O ponto escolhido nunca está à vista de um inimigo vivo nem perto dele; depois disso, vale a distância e a variedade.
- Proteção de **1,8 segundo** ao nascer, encerrada ao mover ou atirar; os bots seguem a mesma regra. Um anel azul identifica bots protegidos.
- Reserva de munição infinita, com carregadores, cadência e recargas normais.
- Killfeed mantém os últimos oito abates, inclusive bot contra bot. **Tab** mostra os dez participantes; no menu, use **Ver placar do Deathmatch**.
- Vence quem tem mais abates; desempates por menos mortes e depois mais headshots. Empates exatos dividem a vitória. Ao zerar o relógio, tiros, respawns e placar param; é possível jogar novamente ou voltar ao menu.

Depósito e Borgo também têm partes elevadas por escadas, ligadas em voltas, e em todos os mapas próprios os spawns iniciais são escolhidos sem que nenhum par de participantes se enxergue. Os bots navegam pelas plataformas, rampas, escadas e pelos dois níveis da travessia do CT na Dust II. O relógio continua no menu e ao trocar de aba; a simulação gráfica fica suspensa em abas ocultas.

## Aimbotz

Escolha **Aimbotz** no menu e clique em **Jogar Aimbotz**. Os bots ficam parados e, ao morrer, desaparecem e renascem instantaneamente em outro spot livre da arena, já podendo receber tiros. Não há corpo nem animação de queda. O local do último abate e os espaços ocupados por outros bots ou pelo jogador são excluídos do respawn, inclusive com os 12 bots ativos.

Vire para os dois quadros atrás do ponto inicial e mire e clique nos controles. No quadro **Aimbotz**, **− / +** muda a quantidade de bots e os nomes escolhem uma das sete armas de fogo. Você sempre mantém a faca do seu equipamento, sem opção de faca no quadro: **1** puxa a arma escolhida, **3** puxa a faca e **Q** alterna entre elas. A rodinha também alterna, caso não esteja configurada para pular. **2 / 4** também voltam à arma de treino.

A reserva é ilimitada. Por padrão, os carregadores e as recargas continuam normais. Ative **Munição sem recarga** no quadro para manter o carregador cheio: o HUD mostra **∞**, e uma recarga em andamento é encerrada. Isso preserva a cadência, o recuo e as regras de luneta e vale somente no Aimbotz.

O quadro separado **Viewmodel** muda a posição da arma em tempo real. **X** move para esquerda/direita (−2 a 2,5), **Y** para trás/frente (−2 a 2) e **Z** para baixo/cima (−2 a 2). Os botões usam passos de 0,5; **Preferências → Posição da arma** permite digitar valores de 0,1 em 0,1. As duas telas compartilham a mesma preferência, salva no navegador e aplicada em todos os modos. **Restaurar padrão** zera os três valores e recupera a posição anterior do jogo. É uma transformação do modelo em primeira pessoa, sem mudar a câmera, a mira, os tiros ou o modelo dos adversários.

## Arsenal (tecla B) e skins

O apelido exato `KQLY` ativa o aimbot para armas de fogo em todos os modos. Cada disparo escolhe a cabeça mais próxima da direção visível da mira, inclusive atrás de paredes, respeitando altura e agachamento. Aliados, mortos e alvos com proteção de spawn são ignorados; em empate angular, vence o mais próximo. Não há ajuste sem disparar, ao atirar sem munição ou ao usar facas. Trocar o apelido desativa a função.

A AWP padrão usa um estampido sintetizado mais grave, mantendo o estilo do jogo. Os headshots padrão também são sintetizados, com um toque metálico para capacete. As skins mantêm seus sons. Os MP3 do experimento ficam guardados em [assets/audio](assets/audio/README.md), sem carregar ou tocar durante o jogo.

O **Arsenal** é uma tela própria, acessível pelo topo do menu ou por **Editar equipamento**. Escolha o slot de rifle, pistola, faca ou precisão à esquerda. À direita, cada card mostra uma arma com a skin que ela usa: um clique equipa a arma e abre logo abaixo uma barra com as skins dela. O contorno cobre e a indicação **Equipada** confirmam a escolha; os slots mostram seu equipamento atual. As escolhas ficam salvas no navegador.

Durante a partida, **B** abre a mesma tela com um cursor próprio; **1–4** alternam os slots, a rodinha rola o inventário e **B** volta ao jogo. **Esc** libera o mouse e abre a pausa. Os comandos de movimento e tiro ficam suspensos enquanto você escolhe. No DM, as categorias não permitidas ficam desativadas. O relógio da partida continua.

Cada skin troca o visual, o som do tiro e o som de abate. O som de abate sobe de tom a cada abate seguido, como no Valorant, e o quinto vira finalização; um emblema com a contagem aparece no HUD. A sequência zera quando você morre ou renasce. Equipar no inventário toca apenas uma confirmação discreta.

| Skin | Armas | Visual | Sons |
|---|---|---|---|
| Padrão | todas | original | originais |
| Sublime | só AK-47 | modelo próprio em marfim, frisos dourados e filetes de energia ciano, inspirado na linha Prime (Sublime em português) do Valorant | tiro elétrico; sinos ao abater |
| Pulso Neon | armas de fogo | azul-marinho com filetes ciano e magenta | laser sintetizado; bipes de fliperama |
| Brasa | armas de fogo | carvão com filetes laranja e dourado | estampido grave com estalos; gongo |
| Glacial | armas de fogo | branco gelo e azul | disparo cristalino; sinos de gelo |

A **AK-47 Sublime** vem bloqueada. Digite o código de desbloqueio em **Armas → Código de skin**; ela fica liberada naquele navegador. O jogo guarda só o hash SHA-256 do código, nunca o código em si. Como tudo roda no navegador, isso evita o acesso casual, mas não impede quem edita o jogo ou os dados salvos.

No 1v1 online, o oponente vê sua skin na arma em terceira pessoa e ouve o tiro dela; no 2v2 online, os outros ouvem o tiro da sua skin.

## Equipamento

Abra **Arsenal** no topo ou clique em **Editar equipamento**. Escolha uma combinação de arma e skin para cada slot. Em **Configurações → Armas**, escolha a categoria equipada ao nascer. As escolhas funcionam em todos os modos; o DM respeita a categoria permitida pela partida.

| Tecla | Categoria | Opções |
|---|---|---|
| 1 | Rifle | AK-47, M4A4, M4A1-S com silenciador |
| 2 | Pistola | Desert Eagle, USP-S com silenciador |
| 3 | Faca | Karambit, Butterfly |
| 4 | Precisão | AWP, SSG 08 (Scout) |

As mãos seguem o mesmo padrão com qualquer arma, facas incluídas: mão em bloco de pele, sem luva, e manga em bloco na cor do boneco (nos times, na cor do time). Com faca, como no CS, aparece só a mão direita.

O bot pode usar qualquer uma das sete armas de fogo, com sua própria cadência, carregador e recarga. Também é possível escolher se ele tem capacete: a proteção aparece no personagem e reduz apenas o dano na cabeça. A USP-S mata com um HS de perto sem capacete e exige mais de um com capacete; seu dano cai com a distância. Os jogadores usam capacete no 1v1.

As facas têm animações distintas de puxada, inspeção, corte e estocada. As duas facas usam o mesmo acabamento das armas, cor chapada com tom fixo por face, mas com contornos em curvas contínuas em vez de blocos. A Butterfly segue a do CS2: lâmina clip point com swedge côncavo até a ponta e chanfro claro no fio, tang com kicker e choil, dois cabos vazados com três rasgos cada, ponta redonda no pino, pinos aparentes e trava no cabo seguro. A mão da Butterfly usa o mesmo bloco, tamanho e lugar da mão das armas (como a Deagle, embaixo à direita), com a lâmina saindo para a frente e para a esquerda. A puxada de 0,8 s é a abertura básica de balisong, no tempo do vídeo de referência: a mão sobe com a faca fechada em pé e de frente para a câmera, o cabo solto cai e dá a volta inteira enquanto a lâmina gira meia volta por cima do punho, os dois cabos fecham na palma e o pulso vira a lâmina para a frente. A inspeção, mais simples, dura 3,0 s: o punho vira a faca de frente, a lâmina aponta para cima com os cabos abertos em V por cerca de 1,3 s, a lâmina dá uma volta e a faca volta ao repouso. O corte vai da direita para a esquerda, o corte de volta faz o caminho inverso e a estocada empurra a lâmina para a frente. Os cortes alternam de direção; o botão direito faz uma estocada. Segurar o botão repete o ataque na cadência da faca. Atacar interrompe a inspeção com uma transição curta. A Deagle tem ferrolho móvel, recuo visual mais forte e som mais grave. São recriações estilizadas em geometria do próprio jogo.

A Karambit segue o contorno da karambit do CS, traçado de uma foto: anel no pomo, cabo com três sulcos para os dedos e guarda, jimping no dorso e garra em curva contínua com chanfro claro no fio côncavo. Pegada, puxada e inspeção foram medidas quadro a quadro num vídeo de referência do CS2. Em repouso aparecem as duas mãos, com o punho direito na horizontal, mais à direita e embaixo, o anel à esquerda e a garra à direita, com a concavidade virada para a frente e vista na diagonal de cima. A puxada dura 0,8 s (24 quadros a 30 fps): a mão sobe pela direita, a faca dá uma volta completa no indicador e desce ao repouso enquanto a esquerda entra. A inspeção dura 3,0 s: levanta o punho, vira a faca no indicador com a lâmina passando por cima, exibe com o punho em pé e a garra pendurada curvando para a esquerda por cerca de 1,2 s e volta girando ao repouso. Cortes e golpe forte cruzam a tela.

As duas facas usam interpolação cúbica monotônica: a velocidade passa contínua pelas poses-chave, sem o "para e anda" de antes, e nunca ultrapassa os valores capturados. As duas têm respiração leve em repouso, e toda animação termina entrando nesse movimento.

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
| Medina | areia | Mapa exclusivo do DM, no clima da Mirage: assimétrico, dois sites elevados com escadas, meio com portas e arco mourisco, túneis, longa e passarela. Caixas de fogo, toldos listrados do mercado, cúpulas azuis, faixas de azulejo e palmeiras |
| Dust II | areia | Recriação simplificada para DM com Long e Pit, Short sobre a passagem do CT, Meio com Xbox, Túneis B em dois níveis e caixas nos bombsites. Portas azuis do Long, portas de madeira do meio e do B, carro verde e o grafite do pato |
| Depósito | concreto | DM próprio no clima industrial do Cache: galpões, contêineres de 2,6 m, passarela a 1,2 m no oeste, mirante a 2,4 m no nordeste, passarela elevada no meio com duas escadas e um caminhão em que dá para subir. Chaminé listrada ao fundo, portas de enrolar verdes, contêineres coloridos com nervuras, cabine do caminhão, empilhadeira e faixas de alerta amarelo e preto |
| Borgo | terracota | DM próprio no clima de vila italiana do Inferno: ruelas e arcos, igreja, corredor estreito a oeste, sacadas de apartamento a 2,4 m no leste com escadas nas duas pontas, terraço baixo e fonte na praça. Igreja com torre do sino e rosácea, galpão de feno de madeira com fardos, telhados de telha, varais nas ruelas, venezianas verdes e vasos de barro |

No 1v1 e no 2v2 vale o mapa escolhido por quem criou a sala.

## Regras

- Primeiro a 10 rodadas vence (dá para mudar para 5, 8, 13 ou 16).
- 3 s de freeze no começo de cada rodada. Rodada acaba na primeira morte.
- Se o tempo acabar, vence quem tiver mais vida.
- 100 de vida, sem colete. Capacetes reduzem o dano na cabeça conforme a penetração da arma. Na AK e na Deagle, corpo e pernas levam o mesmo dano.
- Lado e ponto de nascimento são sorteados a cada rodada.

| Arma | Corpo | Cabeça sem capacete / com | Carregador |
|---|---|---|---|
| AK-47 | 27 | 144 / 112 | 30 |
| M4A4 | 33 | 132 / 100 | 30 |
| M4A1-S | 38 | 132 / 100 | 20 |
| Desert Eagle | 40 | 212 / 198 | 7 |
| USP-S | 35 | 140 / 71 | 12 |
| AWP | 115 | 460 / 449 | 10 |
| SSG 08 | 88 | 352 / 299 | 10 |
| Karambit / Butterfly | 40 / 65 | — | — |

Valores de perto. M4A4 e M4A1-S matam com um headshot até 35 metros, inclusive com capacete. Acima dessa distância, o dano na cabeça com capacete é 92.

## Movimento e precisão

Nos rifles de precisão, como no CS, o tiro abre rápido acima de 34% da velocidade da arma. Andando de scope (100 u/s na AWP) o tiro sai torto; parado, com contra-strafe ou andando devagar com Shift ele volta a ser preciso, e agachado ajuda. Logo depois de abrir o scope, o tiro ainda carrega parte da imprecisão sem scope por cerca de 0,22 s.

A luneta fica bloqueada durante a recarga e com o carregador vazio. No instante em que a recarga termina, a munição é atualizada antes de liberar a luneta, sem precisar esperar outro quadro.

Aceleração, atrito e controle aéreo seguem uma aproximação do movimento Source, com simulação em passos fixos de 1/128 s. Soltar as teclas desacelera; contra-strafe freia mais rápido e recupera a precisão. A diagonal não ganha velocidade. Shift anda a 52% da velocidade e agachado a 34%. A luneta usa a velocidade própria da AWP ou da Scout.

**Bunnyhop assistido** vem ligado: segure Espaço para pular novamente ao tocar o chão. Para ganhar controle no ar, solte W, alterne A/D e acompanhe o movimento com o mouse. É possível desligar a assistência e usar pulos manuais ou configurar a rodinha para pular. Nesse caso, troque armas pelas teclas 1–4 ou Q. A velocidade aérea tem limite para impedir aceleração ilimitada.

No difícil, os bots se deslocam entre rajadas, fazem contra-strafe antes do disparo, às vezes agacham para fazer spray e tentam quebrar a linha de visão durante a recarga. Em trechos livres, podem sacar a faca e tentar sequências curtas de bunnyhop, com acertos e erros de tempo. O agachamento aparece para os outros jogadores no 1v1, no 2v2, no XvX e no DM.

A tela mostra só 45% do recuo, como o view punch do CS: treme bem menos ao atirar, e as balas seguem o recuo inteiro (por isso sobem um pouco acima da mira no spray). A AK-47 teve redução de 5% no recuo vertical e lateral, inclusive na variação aleatória do spray. O solavanco ao tomar tiro é pequeno e tem teto, e o recuo das armas na mão é mais contido. Atirar correndo ou no ar aumenta a dispersão; parar ou agachar melhora a precisão. Os rifles têm spray, com recuo menor nas M4s. A Scout recupera parte da precisão no ápice do salto. O recuo da câmera acompanha o desvio dos tiros.

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
| B | Arsenal: grade de armas e skins |
| Tab | Placar |
| Esc | Menu de pausa |

## Configurações

Use a engrenagem no topo do menu para abrir as abas de mouse, mira, armas, partida, preferências, vídeo e som e controles.

- **Cor do boneco:** escolha antes de entrar na sala. É a cor que o oponente vê.

- **Mira:** estilo estático ou dinâmico, cor, tamanho, espessura, espaço, contorno, ponto central, formato T, opacidade.
- **Mouse:** sensibilidade na escala do CS (mostra o equivalente no Valorant e os cm/360 pelo seu DPI) e sensibilidade da luneta.
- **Preferências:** **Suavizar tremor dos disparos** vem ligado e preserva o tremor leve anterior. Desligar aumenta o recuo visual da câmera de 45% para 70% do recuo calculado; precisão, dano e trajetórias das balas não mudam. A opção é própria deste jogo. A separação entre movimento da câmera e trajetória também aparece nas [notas oficiais do CS2 de 21 de abril de 2026](https://store.steampowered.com/news/posts/?appids=730&enddate=1777070707).
- **Vídeo:** FOV (horizontal 4:3, CS = 90), escala de resolução, ajuste automático de resolução e contador de FPS.

Tudo fica salvo no navegador.

O killfeed identifica headshots com um ícone vetorial de cabeça e projétil, com descrição acessível, no lugar do texto **HS**. Nos últimos três segundos de preparação há um tick curto por segundo, e o fim da rodada tem um aviso de dois tons. Os sons seguem o volume geral; retransmissões online e pequenas correções de relógio não repetem os avisos. Ao voltar de uma aba oculta, os ticks perdidos não são reproduzidos em sequência.

A luneta da AWP e da Scout só abre quando a arma está pronta para disparar: após a puxada, a recarga e o intervalo entre tiros. A AWP mantém dez balas por carregador.

## Desempenho e desenvolvimento

Sem pós-processamento, sombras em tempo real ou antialiasing durante o jogo. O mapa e as partes estáticas das armas usam geometria agrupada; impactos e rastros são reutilizados. As animações só transformam grupos existentes. A resolução padrão não multiplica pixels por telas de DPI alto. O ajuste automático reduz a resolução quando o tempo médio de quadro sobe. A cena 3D é renderizada durante a partida e fica suspensa em abas ocultas. O menu usa imagens WebP estáticas, SVG e CSS, sem reconstruir o mapa 3D a cada seleção. As prévias grandes foram renderizadas separadamente em **2048 × 768 com antialiasing**; `srcset` permite usar as miniaturas de 640 pixels em telas menores. A arena é construída ao iniciar a partida.

No DM e no 2v2, os outros participantes compartilham geometria por instanciamento: corpo, cabeça, capacete, nove modelos de arma (facas incluídas) e marcador de aliado, com efeitos reutilizados. A cor de cada instância é alocada com a capacidade total antes do primeiro desenho; antes dessa correção o buffer ficava vazio e a GPU descartava os bots, que ficavam invisíveis. A navegação é uma grade 2,5D: cada célula guarda a altura do chão e só liga vizinhas sem degrau maior que um passo, então os bots sobem escadas, rampas e plataformas. A malha é calculada uma vez por mapa e reutiliza buffers de busca; a percepção dos bots é distribuída ao longo dos quadros. Áudio e passos simultâneos têm limite próprio para evitar picos.

Mouse bruto quando disponível, disparo processado no evento de clique e envio imediato de tiros no 1v1. A latência final depende do navegador, monitor, hardware e rede; não há garantia de latência zero ou desempenho igual em todos os PCs.

Prévia local com Node.js 22 ou mais recente: `node tools/serve.mjs`, depois abra `http://127.0.0.1:8081`. Use `--port=8082` para trocar a porta. O servidor aceita um caminho de vídeo opcional para revisão local em `/reference.mp4`; esse vídeo não é incorporado ao jogo.

A página `/tools/knife-preview.html` permite visualizar as facas isoladas ou na mão e reproduzir cada animação, com uma régua para conferir poses intermediárias. Ela reutiliza a geometria, as posições e as animações de `index.html` e usa enquadramento 16:9. Não é carregada pelo jogo. A Butterfly isolada usa cerca de 2.850 triângulos e três chamadas de desenho (lâmina e os dois cabos, que giram separados); com mãos e braços, cerca de 2.900 triângulos e 7 chamadas.

Use `/tools/knife-preview.html?weapon=knife` para abrir diretamente a Karambit. O modelo tem cerca de 3.500 triângulos em uma chamada de desenho; com mãos e braços, cerca de 3.560 triângulos e 5 chamadas. Lâmina, cabo e anel compartilham geometria entre primeira e terceira pessoa. As curvas são criadas uma única vez; as animações reutilizam os mesmos grupos e buffers.

Testes sem dependências: `node --test tests/game.test.cjs`. Cobrem as 24 combinações de equipamento, dano e capacete, recargas e armas do bot, precisão, contra-strafe, diagonal, consistência entre 30/60/144 FPS, bunnyhop, colisões, rampas e animações das facas. Também verificam os dez participantes do DM, categorias, navegação, spawns iniciais sem linha de visão entre si e virados para rotas abertas, sites elevados alcançáveis, proteção, autoria dos abates, confrontos reais entre bots nas quatro categorias, recargas e encerramento exato de cinco minutos. Para as novidades: o bloqueio da AK Sublime (código só como hash), a sequência de abates das skins, as recompensas de abate do DM, uma partida 2v2 e uma 1v5 completas com bots (sem fogo amigo, placar consistente) e as salas online de DM e de times, simuladas com um PeerJS falso que troca as mensagens reais entre juiz e convidado (entrada no meio da partida, respawn, abates e recompensas iguais dos dois lados).

Para testar salas online sem o servidor público do PeerJS, rode um servidor PeerJS local e abra o jogo com `?peerserver=127.0.0.1:9000`.

## Publicar no GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch `main`, pasta `/ (root)`.
