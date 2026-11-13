# aim_duelo

FPS que roda no navegador, com tiro e movimento como no Valorant (a AWP segue o CS2), com **Elimination** (1 a 8 por time), **Plant the Bomb** (5v5), **Wingman** (2v2), **TDM**, **DM** e treino de mira no **Practice**. O jogo roda em `index.html`, com geometria leve, áudio sintetizado, cinco arenas de duelo, quatro mapas de DM, dois mapas de Wingman e dois mapas de Plant the Bomb. O menu usa prévias dos mapas em WebP.

## Modos de jogo

Na tela **Jogar**, escolha o modo na lista à esquerda e a arena na faixa de miniaturas. O mapa escolhido aparece em destaque. A configuração da partida e o botão **Jogar** ficam juntos ao lado da prévia em 16:9; **Contra bots** ou **Com amigos** aparece nos modos que aceitam sala online. O Practice entra direto no treino. **Configurações** abre uma tela própria; **Seu equipamento** expande um resumo do loadout e o acesso ao arsenal.

| Modo | Sozinho | Online |
|---|---|---|
| Elimination | Times de 1 a 8 de cada lado (1v1, 2v2, 1v5, 5v5, 8v8…), completados por bots | Sala para até 16 pessoas, no tamanho escolhido por quem cria |
| Plant the Bomb | 5 contra 5 em Palace ou Factory, dois bombsites; você + 4 aliados contra 5 bots | — |
| Wingman | Plant the Bomb 2 contra 2 em Guard ou Elysion, regras do Wingman; você e um bot contra dois bots | — |
| TDM | Dois times de 2 a 8 nos mapas de DM, renascimento contínuo | — |
| DM | Você + 9 bots, todos contra todos, 5 minutos | Sala com código para até 10 pessoas; bots completam as vagas |
| Practice | Treino livre de mira com 1 a 12 bots | — |

**Modos antigos:** 1v1, 2v2 e XvX viraram um modo só, o **Elimination**: ao clicar nele você já escolhe quantos jogadores tem em cada time, e um duelo é só o 1 contra 1. O antigo Plant the Bomb 2v2 virou o **Wingman**, e o antigo 5v5 virou o **Plant the Bomb**. Configurações salvas migram sozinhas (quem estava no 1v1 cai no Elimination 1v1, no 2v2 cai no 2v2).

**Plant the Bomb (5v5):** escolha o modo na lista, depois **Palace** ou **Factory**. O **Factory 5v5** é um mapa próprio de **guilhxrme e João**, recriado a partir do GLB deles com proporções ajustadas ao jogador: 1,5× na horizontal e a altura original. O crédito aparece no menu e no início da partida. É uma base que reutiliza as regras de bomba e a IA já existentes; não há uma nova lógica tática específica para esses mapas. Há cinco pontos de nascimento separados por lado. O minimapa no canto mostra os caminhos, os sites A/B, o jogador e aliados; inimigos não aparecem. Os spawns são **azul = defensor**, **vermelho = atacante**. No Palace, a defesa fica na parte superior e o ataque na inferior; no Factory, as bases seguem a orientação da referência original, defesa à esquerda e ataque à direita.

Os dois modelos enviados foram convertidos offline, com cores chapadas inspiradas nas referências originais do Warface. As imagens de seleção vêm dos próprios mapas do jogo, em 1280 × 720, sem carregar cenas 3D no menu. Os GLBs originais e as ferramentas de revisão não são necessários para jogar.

## Como jogar com seu parceiro

1. Abra o jogo pelo GitHub Pages (ou abra o `index.html` direto no Chrome).
2. Escolha **Elimination** com o tamanho dos times e **Com amigos**. Todos digitam o **mesmo código de sala** e clicam em **Entrar na sala**.
3. Quem entrar primeiro cria a sala e vira o juiz das rodadas. Quando o segundo conecta, a partida começa sozinha.

A conexão é direta entre os dois navegadores (WebRTC via PeerJS). O servidor público do PeerJS só faz o pareamento; o jogo em si não passa por servidor. Algumas redes corporativas bloqueiam conexão direta. Se não conectar em 15 segundos, testem fora da VPN ou em outra rede.

Sem parceiro? Escolha **Contra bots**: os bots completam as vagas.

## Elimination

No **Elimination**, escolha o tamanho de **Seu time** e do **Time inimigo** (1 a 8 cada). Rodadas nos mapas de duelo: 3 s de freeze, primeiro a N rodadas, sem respawn dentro da rodada. A rodada acaba quando um time inteiro morre; se o tempo acabar, vence o time com mais vida somada. Não há fogo amigo: tiros param no aliado sem causar dano. Aliados aparecem em azul, com um marcador sobre a cabeça; inimigos em vermelho. O placar no topo mostra quantos de cada time estão vivos.

- **Com bots:** as vagas que sobram nos dois times são de bots, na dificuldade escolhida (no 1 contra 1 é você contra um bot). Os bots sorteiam uma arma a cada rodada, passam a posição de inimigos vistos para o aliado e saem para caçar depois de alguns segundos.
- **Online:** quem cria a sala vira o juiz: roda os bots, a rodada e o placar e retransmite tudo para as outras pessoas (até o total das duas equipes). Em **Times na sala**, escolha *pessoas em lados opostos* (cada uma com um bot aliado) ou *pessoas no mesmo time contra bots*. Quando alguém entra ou sai, começa uma partida nova e um bot assume a vaga livre. Cada pessoa controla o próprio movimento e a própria vida.

## Wingman e Plant the Bomb

Atacantes contra Defensores. O **Wingman** é o Plant the Bomb 2 contra 2 em Guard e Elysion, com as regras do modo Wingman do CS; o **Plant the Bomb** é o 5 contra 5 em Palace e Factory, com as mesmas regras de bomba, economia e operadores. Antes da partida você escolhe um **operador**.

Não existe uniforme de lado: cada pessoa veste a roupa do operador que escolheu, igual nos dois times. Quem é quem fica pelos contornos, como no Valorant. Os aliados aparecem através das paredes com o corpo inteiro preenchido em azul-água e uma borda mais forte. Os inimigos têm um contorno fino só na borda de fora da silhueta (sem linhas entre cabeça, tronco e pernas), que não atravessa paredes. Por padrão ele é vermelho, e em **Configurações → Vídeo → Contorno dos inimigos** dá para trocar para amarelo ou roxo. A mesma cor vale para as silhuetas e os pontos no minimapa do Finder e do Detector. Os contornos também valem no 1v1, 2v2, XvX, TDM e DM: o aliado azul-água só existe onde há time.

- **Partida:** primeiro a 9 rodadas, troca de lado depois da 8ª (a economia recomeça); 8 a 8 termina empatado.
- **Tempos:** 10 s de preparação, compra até 20 s depois do início da rodada, 1:30 de rodada, bomba de 40 s. Plantar leva 3,2 s; desarmar leva 10 s, ou 5 s com kit.
- **Economia (Wingman):** $800 iniciais e teto de $8.000. A vitória paga $2.750 por eliminação ou tempo esgotado e $3.000 por desarme ou detonação. A derrota paga $2.000, $2.300, $2.600 e no máximo $2.900 por derrotas seguidas, voltando ao início quando o time vence; os Atacantes que plantaram e perderam ganham mais $600. Plantar ou desarmar paga $300. O abate paga conforme a arma: faca $1.500, escopeta $900, SMG $600, AWP $100 e o resto $300.
- **Loja (B):** pistolas, SMG e escopeta, rifles (AK, Galil e Glock só para Atacantes; M4, FAMAS, USP-S e kit só para Defensores). A loja só lista o que o seu lado pode comprar. Como no CS, os Atacantes começam com a Glock e os Defensores com a USP-S. Os bots compram a Galil ou a FAMAS quando não dá para o rifle cheio com colete, precisão, granadas (1 HE, 2 flashes, 1 smoke, até 4 no total) e equipamento (colete, colete + capacete, kit de desarme só para Defensores). Só compra perto do próprio spawn e dentro do tempo. **Botão direito vende** o que foi comprado nesta rodada pelo preço cheio e devolve o equipamento anterior. O colete reduz o dano no corpo conforme a penetração da arma.
- **Teclas:** 1 primária, 2 pistola, 3 faca, 4 alterna granadas, 5 bomba. Plante segurando **E** no bombsite (ou o clique com a C4 na mão) e desarme segurando **E** perto da bomba. Quem carrega a bomba e morre deixa ela no chão; um Atacante pega passando por cima.
- **Bots:** compram conforme o dinheiro, carregam e plantam a bomba, desarmam, buscam a bomba caída e usam smoke, flash e HE. Eles jogam em equipe:
  - **Estudo do mapa:** na primeira rodada de cada mapa, os bots estudam cada bombsite. Eles acham as entradas por onde os Atacantes chegam, um ponto de reunião escondido antes de cada entrada, posições de defesa com cobertura e visão da entrada, e posições dentro do site viradas para a volta dos Defensores.
  - **Defensores:** se dividem pelas entradas (e pelos sites, quando houver mais de um) e cada um marca um ângulo diferente. Quem está no posto não corre atrás de barulho, só vira para ele. Quando o outro site é atacado, quem está longe gira para ajudar.
  - **Atacantes:** a cada rodada escolhem uma tática:
    - **reunir e entrar juntos**, a mais comum;
    - **rush**;
    - **dividir** por duas entradas, quando o site tem mais de uma.

    Andam em grupo (quem está muito à frente espera o companheiro) e entram juntos quando todos chegam, no horário combinado, com pouco tempo ou ao fazer contato. Na entrada jogam smoke na volta dos Defensores e flash por cima do site. Se a pessoa estiver com a bomba, os bots acompanham ela.
  - **Depois do plant:** os Atacantes cercam a bomba em posições com visão dela. Os Defensores se reúnem a uns 12 m e fazem o retake juntos (com flash): quem tem kit, ou está mais perto, desarma e os outros cobrem.
  - **Habilidades:** presas ao plano.
    - **Ghost:** liga os passos mudos para entrar no site ou no retake.
    - **Brutus:** liga a couraça ao entrar no site, no retake ou numa troca de tiros.
    - **Finder:** de ataque, varre o site antes de entrar e, depois do plant, a volta dos Defensores. De defesa, varre a reunião dos Atacantes no meio da rodada e a bomba antes do retake.
    - **Detector:** de defesa, coloca o alarme na entrada que marca e volta para a posição. De ataque, coloca o alarme na reunião, vigiando as costas do grupo, e perto da bomba depois de plantar.
    - **Doctor:** cura quem estiver abaixo de 60 de vida fora da troca de tiros.
  - **Destravar:** um bot que empaca numa fresta da colisão (comum nos mapas convertidos) dá um passo para o lado, corta aquela ligação da navegação e recalcula a rota sem isolar o destino.
- **Armas no chão:** **G** larga a arma que está na mão (ou a C4). Quem morre deixa cair a melhor arma que tinha: a primária ou, sem ela, a pistola. Passar por cima pega a arma se o espaço dela estiver vazio; com o espaço ocupado, **E** troca pela sua, que fica no chão. Quem largou a arma só consegue pegar de volta depois de 1,5 s. Os bots sem primária vão buscar uma arma caída a até 14 m, exceto quem está com a bomba ou desarmando. As armas somem na troca de rodada.
- **Assistir:** quem morre passa a ver, em primeira pessoa, o que um companheiro ainda vivo vê: a mira dele e a arma dele na mão, com o coice e o clarão dos tiros. **Mouse 1** passa para o próximo companheiro e **Mouse 2** volta. Não dá para assistir o time inimigo; sem companheiro vivo (ou no 1 contra 1), a câmera fica parada onde você morreu. Vale no Elimination, no Plant the Bomb e no Wingman.
- **HUD:** dinheiro, colete, C4, barra de plantar/desarmar e o nome da área onde você está. Com a bomba plantada não há contagem: no lugar do relógio aparece o ícone da C4, que pisca junto com o bipe, cada vez mais rápido, como no CS e no Valorant. O bipe sai da bomba: de longe (mais de 38 m) não se ouve, e o volume aumenta conforme você se aproxima, vindo do lado em que ela está.
- **Abismo:** quem cai do prédio (o 39º andar do Elysion) morre depois de cerca de 2 s de queda. A morte entra no placar sem dar abate a ninguém e aparece como QUEDA no feed. Se a pessoa estava com a bomba, ela fica no último chão firme onde pisou.
- **Granadas:** como no CS. Apertar o botão puxa o pino: o braço recua e fica armado enquanto o botão estiver apertado. Ao soltar, o braço arremessa e a granada só sai da mão no meio do movimento. Um clique rápido espera o pino sair. O esquerdo joga longe, o direito joga perto e os dois juntos jogam a meia distância.

### Operadores

Antes do Plant the Bomb, a tela de agentes mostra os cinco retratos. Clique num retrato para ver o agente em pé com a AK-47 e ler a habilidade; **Selecionar** confirma e inicia a partida. **Voltar** ou **Esc** cancela a prévia sem mudar a escolha salva. As setas navegam entre retratos. O fundo acompanha o mapa escolhido; em rotação, usa Guard.

Finder, Doctor, Ghost, Brutus e Detector têm modelos próprios de roupa, rosto e equipamento, usados também nos personagens da partida. Retratos e prévia são renderizados a partir desses mesmos modelos, sem imagens ou texturas de personagens externas. A prévia só é desenhada enquanto essa tela está aberta e respeita a preferência por movimento reduzido.

A habilidade fica na tecla **X**. Depois de usada, ela recarrega em 45 s e volta pronta no começo de cada rodada. Os operadores de um mesmo time são sempre diferentes; os bots sorteiam entre os que sobram.

O ícone da habilidade fica no centro, embaixo: drone (Finder), cruz de cura (Doctor), mão fazendo "shh" (Ghost), escudo (Brutus) e sirene de alarme (Detector). Disponível, ele fica branco e contornado. Durante o efeito do Ghost ou do Brutus, ganha a cor do operador com os segundos restantes. Depois, fica esmaecido com a contagem do cooldown e dá um aviso sonoro quando volta.

Efeitos: o Ghost fala "shh" e a tela ganha uma borda roxa desfocada enquanto os passos estão mudos. O Brutus solta um "HAHA" com borda amarela enquanto a couraça dura. As vozes são ouvidas por quem está perto. A varredura do Finder tem som de scan, com pings quando pega alguém, e quem é escaneado também ouve. Revelações aparecem numa faixa rosada no alto da tela, em caixa alta: "INIMIGO REVELADO" quando a varredura do Finder pega alguém, "ARMADILHA ACIONADA" quando o alarme do Detector dispara e "LOCALIZAÇÃO REVELADA" para quem foi pego. Quem recebe a cura do Doctor vê um pulso verde nas bordas.

| Operador | Habilidade | Visual |
|---|---|---|
| Finder | Abre o minimapa; o clique escolhe uma área de 10 m de diâmetro. Após um pulso, mostra uma silhueta parada (na cor do contorno inimigo) onde cada inimigo da área estava (vista através das paredes) e mostra de novo 1 s depois; a marcação não segue a pessoa | Viseira ciano e antena |
| Doctor | Saca uma pistola de cura estimulante. O botão esquerdo atira um dardo de verdade (branco, ponta azul e agulha) que voa até o aliado da mira e cura quando chega; se errar, a carga é gasta e o dardo fica cravado onde bateu. O botão direito aplica em você: o antebraço esquerdo entra na tela e ele crava o dardo nele. Cura 50 de vida (até 100); X de novo guarda a pistola. Bots se curam ou mandam o dardo num aliado próximo abaixo de 60 de vida | Cruz verde no peito e maleta branca com cruz vermelha nas costas |
| Ghost | Por 5 s seus passos ficam mudos: ninguém escuta você andando ou correndo e os bots não reagem ao barulho. O HUD mostra o tempo restante. Bots Atacantes usam perto do bomb antes de plantar; bots Defensores usam depois que a bomba é plantada | Capuz escuro com máscara e faixa roxas |
| Brutus | Couraça: por 5 s recebe 10% menos dano, exceto de headshots. Bots ligam ao entrar numa troca de tiros | Ombreiras amarelas, placa no peito com divisa e protetor de queixo |
| Detector | Coloca um alarme no chão, que o inimigo só enxerga a menos de 7 m. Só um alarme por vez: colocar outro desfaz o anterior. Quem chega a 3,2 m faz ele apitar, aparece como silhueta (na cor do contorno inimigo) no ponto em que estava por 4 s e o alarme se destrói. Pode ser destruído a tiro, com aviso para o dono | Mochila laranja com sinalizador |

### Mapas de bomba

**Créditos:** **Guard**, de **poLemin**, e **Elysion**, de **Big_SG21**, convertidos dos BSPs enviados pelo usuário (ports de **Alex Road**). A geometria, os caminhos, os desníveis e as colisões vêm desses arquivos. O acabamento usa cores chapadas dos materiais originais com a grade do jogo, sem carregar as texturas ou os sons dos mapas.

- **Guard:** traçado do arquivo fornecido, incluindo ponte, arcos, escadas, coberturas e escada vertical. Um bombsite A.
- **Elysion:** recorte **Wingman**, com somente o **A** e as passagens da imagem de referência. A sala lateral continua como passagem; o segundo plant do port foi removido. A casca externa do prédio foi cortada. Spawns selecionados nas salas indicadas pela referência, usando posições do BSP.

Os dados são carregados somente ao entrar nesses mapas e funcionam também abrindo `index.html` por `file://`. A navegação dos bots vem pré-calculada. Há detalhes de conversão, limites e instruções para regenerar os arquivos em [assets/maps/README.md](assets/maps/README.md).

## TDM

Dois times de 2 a 8 (você e bots contra bots) nos mapas de DM, com renascimento contínuo e sem fogo amigo. Cada time começa numa metade do mapa e quem morre renasce longe dos inimigos. Vence o primeiro time a chegar a 10 abates por jogador, ou o que tiver mais abates ao fim de 10 minutos.

## Armas novas e granadas

- **Glock-18:** pistola inicial dos Atacantes no Plant the Bomb, com as regras do Classic. O clique esquerdo dá um tiro; o direito dispara **3 chumbos de uma vez** (gasta 3 balas).
- **Galil AR:** rifle barato dos Atacantes ($1.800), com as regras da Bulldog. O botão direito dispara uma rajada de 3, sem zoom.
- **FAMAS:** rifle barato dos Defensores ($2.050), também com as regras da Bulldog (rajada de 3 no botão direito).
- **UMP-45:** submetralhadora com as regras da Spectre: precisa em movimento, perde dano com a distância.
- **Bucky:** escopeta com 15 chumbos por disparo; o dano soma por vítima. Letal de perto e fraca de longe. O botão direito lança um cartucho que estoura em 5 chumbos a 7,5 m.
- **HE:** explode em 1,6 s, até 98 de dano caindo com a distância (7 m), só com linha de visão.
- **Flash:** cega por até 3,6 s quem olha para ela; de lado cega menos, de costas quase nada.
- **Smoke:** estoura ao parar, nuvem de 3,2 m por 18 s que bloqueia a visão dos bots e a flash.

Clique esquerdo lança a granada longe; o direito joga perto. As granadas quicam nas paredes e no chão. UMP-45 e Bucky entram no slot primário em todos os modos; as granadas são compradas no Plant the Bomb.

### Modelos das armas

Todas as armas, menos a Karambit, ganharam modelos mais detalhados. Em vez de caixas, cada peça é um perfil lateral recortado (côncavo quando precisa), tubos facetados para canos, silenciadores e lunetas, e caixas pequenas para os detalhes:

- **AK-47:** caixa com tampa e mola, guarda-mão de madeira em duas partes com ranhuras, carregador curvo, alça de mira, massa com orelhas e freio de boca.
- **M4A1-S:** trilho com dentes, alça rebatível, retém, janela de ejeção, tubo do amortecedor, coronha retrátil, guarda-mão fino e silenciador com anéis. A M4A4 saiu do jogo; quem tinha ela salva no equipamento, no bot ou no Practice passa para a M4A1-S.
- **Galil AR, FAMAS, UMP-45, Bucky e SSG 08:**
  - **Galil:** alavanca de manejo para cima e coronha esqueleto.
  - **FAMAS:** alça comprida e bipé dobrado nos lados.
  - **UMP:** guarda-mão vazado e coronha rebatível.
  - **Bucky:** telha estriada, tubo de cartuchos e mira de pérola.
  - **SSG:** cano facetado, freio de boca e luneta com torres.
- **USP-S e Glock-18:** ferrolho com serrilhas, armação com trilho, cabo texturizado e miras. A USP-S tem cão e silenciador; a Glock tem pontos brancos e o seletor de rajada.
- **AWP:** refeita no estilo da do CS. Tem chassi verde-oliva com coronha vazada (thumbhole), descanso de rosto ajustável e ação com trilho. O ferrolho tem bola, o cano afina até o freio de boca com janelas, o carregador é destacável e a luneta tem objetiva grande e três torres.
- **Desert Eagle:** ganhou trilho com ranhuras e massa com ponto no cano, alavanca de desmontagem e cabo de borracha texturizado. O ferrolho tem trava ambidestra e mira. A animação e o ferrolho que recua no tiro continuam iguais.
- **Granadas:** HE redonda, flash e smoke cilíndricas, todas com alavanca, espoleta e argola do pino.
- **C4, pistola do Doctor e Butterfly:**
  - **C4:** três tijolos, painel com visor e teclado, e fios.
  - **Pistola do Doctor:** frasco de vidro com tampas, cruz médica e cilindro de gás.
  - **Butterfly:** já tinha lâmina e cabos vazados detalhados e ficou como estava.

Mãos e boca do cano continuam nos mesmos pontos. As skins recolorem os modelos novos, e a AK Sublime agora usa o modelo novo da AK em marfim e ouro, com as ranhuras e a janela de ejeção em energia ciano. Cada arma fica abaixo de 1.500 triângulos.

## Deathmatch

Em **Modo de jogo**, escolha **DM**. Selecione **Medina**, **Dust II**, **Depósito** ou **Borgo**, a categoria de armas e a dificuldade. Para jogar sozinho, use **Jogar DM com bots**. Para jogar com amigos, todos digitam o mesmo código e clicam em **Entrar na sala de DM**. Quem chega primeiro cria a sala e define o mapa. Cada pessoa que entra assume a vaga de um bot durante a partida, e um bot volta se alguém sai. A categoria limita as armas de todos, e a faca continua disponível. Suas armas vêm do equipamento escolhido na aba **Armas**. Os bots sorteiam uma arma permitida a cada nascimento, e a opção de capacete vale para todos eles.

Você enfrenta **donk, ZywOo, m0NESY, NiKo, KSCERATO, ropz, YEKINDAR, molodoy e coldzera**. Os bots enxergam, perseguem e acertam uns aos outros com os mesmos raios de tiro, colisões e cálculo de dano usados contra o jogador. Os nomes não alteram a dificuldade.

- Preparação de 3 segundos, seguida de **5 minutos completos** de partida.
- No início, o jogo distribui os participantes pelos pontos do mapa, priorizando distância e pontos sem visão entre si. Cada ponto olha para a rota mais aberta.
- Abate recarrega o carregador na hora; abate com tiro na cabeça também cura **50 de vida** (até 100). Vale para pessoas e bots.
- Respawn automático após **1,5 segundo**, com vida e carregador cheios. O ponto escolhido nunca está à vista de um inimigo vivo nem perto dele; depois disso, vale a distância e a variedade.
- Proteção de **1,8 segundo** ao nascer, encerrada ao mover ou atirar; os bots seguem a mesma regra. Um anel azul identifica bots protegidos.
- Reserva de munição infinita, com carregadores, cadência e recargas normais.
- Killfeed mostra até cinco abates recentes por 6,5 s, inclusive bot contra bot, com silhueta vetorial da arma e ícone de headshot. **Tab** mostra os dez participantes; no menu, use **Ver placar do Deathmatch**.
- Vence quem tem mais abates; desempates por menos mortes e depois mais headshots. Empates exatos dividem a vitória. Ao zerar o relógio, tiros, respawns e placar param; é possível jogar novamente ou voltar ao menu.

Depósito e Borgo também têm partes elevadas por escadas, ligadas em voltas, e em todos os mapas próprios os spawns iniciais são escolhidos sem que nenhum par de participantes se enxergue. Os bots navegam pelas plataformas, rampas, escadas e pelos dois níveis da travessia do CT na Dust II. O relógio continua no menu e ao trocar de aba; a simulação gráfica fica suspensa em abas ocultas.

## Practice (antigo Aimbotz)

Escolha **Practice** no menu e clique em **Jogar Practice**. Os bots ficam parados e, ao morrer, desaparecem e renascem instantaneamente em outro spot livre da arena, já podendo receber tiros. Não há corpo nem animação de queda. O local do último abate e os espaços ocupados por outros bots ou pelo jogador são excluídos do respawn, inclusive com os 12 bots ativos.

Vire para os quadros atrás do ponto inicial e mire e clique nos controles. No quadro **Practice**, **− / +** muda a quantidade de bots e os nomes escolhem uma das armas de fogo. Você sempre mantém a faca do seu equipamento, sem opção de faca no quadro: **1** puxa a arma escolhida, **3** puxa a faca e **Q** alterna entre elas. A rodinha também alterna, caso não esteja configurada para pular. **2 / 4** também voltam à arma de treino.

A reserva é ilimitada. Por padrão, os carregadores e as recargas continuam normais. Ative **Munição sem recarga** no quadro para manter o carregador cheio: o HUD mostra **∞**, e uma recarga em andamento é encerrada. Isso preserva a cadência, o recuo e as regras de luneta e vale somente no Practice.

O quadro pequeno **Prefire** abre o percurso da **Inferno: Banana → B → CT → Truck**. O nascimento fica protegido atrás da curva, perto da T Ramp. Você pode preparar a arma sem receber tiros: sair da área inicial de 2,5 m, com a arma pronta, ou disparar inicia o treino e o cronômetro. São 15 defensores fixos, com 100 de vida, que reagem e atiram somente com visão do jogador. A primeira abertura expõe apenas o defensor dos Logs; os demais alvos da Banana ficam mais recuados. Cada alvo morto desaparece sem renascer durante o percurso. O placar mostra abatidos, restantes e o tempo decorrido, sem limite. Esc pausa o treino; morrer reinicia todos os alvos e zera o tempo, retornando à preparação segura. Ao eliminar os 15, um aviso sonoro confirma a conclusão e o jogo retorna automaticamente ao Practice normal. A arma, a faca, a opção de munição e o viewmodel escolhidos são mantidos.

Esse trecho usa a geometria física do VPK fornecido, convertida offline e recortada, com cores chapadas e o shader de grade do jogo. O restante da Inferno, materiais e texturas do CS2 não são carregados. Detalhes da conversão em [assets/maps/README.md](assets/maps/README.md).

O quadro separado **Viewmodel** muda a posição da arma em tempo real. **X** move para esquerda/direita (−2 a 2,5), **Y** para trás/frente (−2 a 2) e **Z** para baixo/cima (−2 a 2). Os botões usam passos de 0,5; **Preferências → Posição da arma** permite digitar valores de 0,1 em 0,1. As duas telas compartilham a mesma preferência, salva no navegador e aplicada em todos os modos. **Restaurar padrão** zera os três valores e recupera a posição anterior do jogo. É uma transformação do modelo em primeira pessoa, sem mudar a câmera, a mira, os tiros ou o modelo dos adversários.

Em **Preferências → Posição da arma → Mão da arma**, escolha **Mão direita** (padrão) ou **Mão esquerda**. A troca espelha as armas, facas, mãos e animações em primeira pessoa, vale em todos os modos e fica salva no navegador.

## HUD em partida

Placar e tempo ficam reunidos no topo. Vida, proteção e munição têm números separados e sem caixas individuais. A recarga conserva a contagem de balas visível e mostra seu progresso; armas de precisão também indicam o intervalo até o próximo disparo. A habilidade mostra a tecla, o estado real e o progresso do cooldown. FPS aparece somente quando a opção está ativa; os dados de conexão aparecem nas partidas online.

Ao acertar um tiro aparece só o **hitmarker** (o X no centro), sem número de dano. Ele não aparece quando o tiro atravessa uma smoke: o dano conta, mas você não fica sabendo pelo X. Dá para desligar em **Configurações → Vídeo → Hitmarker**.

O radar é redesenhado a cada quadro, com a posição suavizada da câmera; antes ele atualizava só a cada 80 ms e parecia travado. O radar é circular e gira com a câmera, mantendo a mesma escala nos dois eixos. Aparece nos duelos, times, DM, TDM e Prefire. Mostra você, aliados vivos e as últimas posições reveladas pela varredura do Finder; não revela adversários sem essa habilidade. Os sites A/B e a bomba seguem o estado da partida. A geometria é desenhada uma vez por mapa e reutilizada; o radar atualiza no máximo a cada 80 ms, sem uma segunda câmera 3D. A HUD usa a resolução da tela mesmo com a resolução 3D reduzida. O Finder conserva a escolha de área de 10 m no mapa completo circular.

Testes do radar: `node --test tests/hud-radar.test.cjs`.

## Arsenal (tecla B) e skins

O apelido exato `KQLY` ativa o aimbot para armas de fogo em todos os modos. Cada disparo escolhe a cabeça mais próxima da direção visível da mira, inclusive atrás de paredes, respeitando altura e agachamento. Aliados, mortos e alvos com proteção de spawn são ignorados; em empate angular, vence o mais próximo. Não há ajuste sem disparar, ao atirar sem munição ou ao usar facas. Trocar o apelido desativa a função.

A AWP padrão usa um estampido sintetizado mais grave, mantendo o estilo do jogo. Os headshots padrão também são sintetizados, com um toque metálico para capacete. As skins mantêm seus sons. Os MP3 do experimento ficam guardados em [assets/audio](assets/audio/README.md), sem carregar ou tocar durante o jogo.

O **Arsenal** é uma tela própria, acessível pelo topo do menu ou por **Seu equipamento → Editar no arsenal**. Escolha o slot de primária (fuzis, SMG, escopeta, AWP e Scout), pistola ou faca à esquerda e clique em uma arma da lista para equipar. Ao lado, a prévia 3D mostra o modelo real do jogo sobre fundo escuro, com luz própria e enquadramento adequado a rifles, pistolas e facas; os acabamentos ficam sempre abaixo dela. As cores convertidas para a iluminação existem apenas nos buffers da prévia. A indicação **Equipada** e os slots confirmam a escolha. Armas e skins ficam salvas no navegador. A prévia só renderiza quando a seleção ou o tamanho da tela muda, sem animação contínua.

Durante a partida, **B** abre a **loja**:

- **No Plant the Bomb e no Wingman:** a loja tem economia, como sempre.
- **No Elimination, DM e TDM:** a loja é grátis e tem todas as armas, dos dois lados. Não tem granadas nem equipamento, porque colete e capacete já vêm por padrão.
- **Como escolher:** clicar numa arma equipa no slot dela e já põe na mão. A escolha fica salva no seu equipamento, e a arma equipada aparece marcada.
- **No DM:** o que está fora da categoria da partida fica desativado.

O cursor é próprio da loja e os comandos de movimento e tiro ficam suspensos enquanto ela está aberta. **B** volta ao jogo e **Esc** libera o mouse e abre a pausa. O relógio da partida continua. As skins continuam sendo escolhidas no Arsenal, pelo menu.

**Colete e capacete** são padrão para todos (você e os bots) fora do Plant the Bomb e do Wingman. O colete reduz o dano no corpo conforme a penetração da arma e se desgasta a cada acerto; o capacete protege a cabeça; as pernas passam direto. Para jogar sem eles, desligue **Configurações → Armas → Colete e capacete para todos** antes da partida.

Cada skin troca o visual, o som do tiro e o som de abate. O som de abate sobe de tom a cada abate seguido, como no Valorant, e o quinto vira finalização; uma confirmação discreta com a contagem aparece no HUD. A sequência zera quando você morre ou renasce. Equipar no inventário toca apenas uma confirmação discreta.

| Skin | Armas | Visual | Sons |
|---|---|---|---|
| Padrão | todas | original | originais |
| Sublime | só AK-47 | o modelo da AK em marfim e ouro, com ranhuras e filetes de energia ciano, inspirado na linha Prime (Sublime em português) do Valorant | tiro elétrico; sinos ao abater |
| Vanguarda | só AWP | branca com painéis laranja e pretos, luneta branca e faixa laranja no cano, inspirada na Asiimov do CS; rastro laranja | estrondo grave com eco metálico; acorde de sintetizador |
| Alien | só AK-47 | verde-limão com tampa, carregador e cabo pretos, guarda-mão de cima branco e o rosto de um alien na coronha; rastro verde | zumbido de disco voador; teremim |
| Blaster | só M4A1-S | branca espacial com guarda-mão e faixas azul-celeste, trilhos e detalhes pretos; rastro vermelho | laser; acorde de nave |
| Buzzer | só M4A1-S (era da M4A4, que saiu do jogo) | amarela e preta, listrada como abelha (coronha e carregador), com asas na coronha; rastro amarelo | zumbido; enxame |
| Pulso Neon | armas de fogo | azul-marinho com filetes ciano e magenta | laser sintetizado; bipes de fliperama |
| Brasa | armas de fogo | carvão com filetes laranja e dourado | estampido grave com estalos; gongo |
| Glacial | armas de fogo | branco gelo e azul | disparo cristalino; sinos de gelo |

As skins exclusivas (Sublime, Vanguarda, Alien, Blaster e Buzzer) usam o modelo da própria arma recolorido, com detalhes extras por cima. Cada uma tem a própria cor de **rastro** do tiro, que os outros jogadores também veem; as demais skins usam o rastro amarelo padrão. Vanguarda, Alien, Blaster e Buzzer já vêm liberadas.

A **AK-47 Sublime** vem bloqueada. Digite o código de desbloqueio em **Armas → Código de skin**; ela fica liberada naquele navegador. O jogo guarda só o hash SHA-256 do código, nunca o código em si. Como tudo roda no navegador, isso evita o acesso casual, mas não impede quem edita o jogo ou os dados salvos.

No Elimination online, os outros jogadores ouvem o tiro da sua skin e veem a cor do rastro dela.

## Equipamento

Abra **Arsenal** no topo ou clique em **Editar equipamento**. Escolha uma combinação de arma e skin para cada slot. Em **Configurações → Armas**, escolha a categoria equipada ao nascer. As escolhas funcionam em todos os modos; o DM respeita a categoria permitida pela partida.

| Tecla | Categoria | Opções |
|---|---|---|
| 1 | Primária | AK-47, M4A1-S com silenciador, Galil AR, FAMAS, UMP-45, Bucky, AWP, SSG 08 (Scout) |
| 2 | Pistola | Desert Eagle, USP-S com silenciador, Glock-18 |
| 3 | Faca | Karambit, Butterfly |

A arma e o braço aparecem 45% maiores que antes. Eles crescem em torno da mão do gatilho: o braço continua saindo pelo canto da tela e mais cano fica à vista. Todas as armas seguem o padrão da AK. Fuzis, SMG, escopeta, AWP, Scout, USP-S e Glock usam o tamanho puro. Algumas têm um ajuste fino para não destoar:

- **Desert Eagle:** vista de trás, ela subiria até o meio da tela, então fica 18% menor e um pouco mais baixa, no porte das outras pistolas.
- **Facas:** ficam um pouco menores, para a mão esquerda não virar um bloco enorme.
- **Granadas e C4:** sobem um pouco.

As mãos seguem o mesmo padrão com qualquer arma, facas incluídas: mão em bloco de pele, sem luva, e manga em bloco na cor do boneco (nos times, na cor do time). Com faca, como no CS, aparece só a mão direita.

O bot pode usar qualquer uma das armas de fogo, com sua própria cadência, carregador e recarga. O capacete aparece no personagem; com a opção de colete e capacete ligada, todos nascem protegidos. A USP-S mata com um HS de perto sem capacete e exige mais de um com capacete; seu dano cai com a distância.

As duas facas mostram a mão livre do lado oposto à arma, inclusive na preferência de mão esquerda. A mão livre da Butterfly foi levantada e afastada do centro para ficar dentro da tela com o tamanho atual das armas.

As facas têm animações distintas de puxada, inspeção, corte e estocada. As duas facas usam o mesmo acabamento das armas, cor chapada com tom fixo por face, mas com contornos em curvas contínuas em vez de blocos. A Butterfly segue a do CS2: lâmina clip point com swedge côncavo até a ponta e chanfro claro no fio, tang com kicker e choil, dois cabos vazados com três rasgos cada, ponta redonda no pino, pinos aparentes e trava no cabo seguro. A mão da Butterfly usa o mesmo bloco, tamanho e lugar da mão das armas (como a Deagle, embaixo à direita), com a lâmina saindo para a frente e para a esquerda. A puxada de 0,8 s é a abertura básica de balisong, no tempo do vídeo de referência: a mão sobe com a faca fechada em pé e de frente para a câmera, o cabo solto cai e dá a volta inteira enquanto a lâmina gira meia volta por cima do punho, os dois cabos fecham na palma e o pulso vira a lâmina para a frente. A inspeção, mais simples, dura 3,0 s: o punho vira a faca de frente, a lâmina aponta para cima com os cabos abertos em V por cerca de 1,3 s, a lâmina dá uma volta e a faca volta ao repouso. O corte vai da direita para a esquerda, o corte de volta faz o caminho inverso e a estocada empurra a lâmina para a frente. Os cortes alternam de direção; o botão direito faz uma estocada. Segurar o botão repete o ataque na cadência da faca. Atacar interrompe a inspeção com uma transição curta. A Deagle tem ferrolho móvel, recuo visual mais forte e som mais grave. São recriações estilizadas em geometria do próprio jogo.

A Karambit segue o contorno da karambit do CS, traçado de uma foto: anel no pomo, cabo com três sulcos para os dedos e guarda, jimping no dorso e garra em curva contínua com chanfro claro no fio côncavo. Pegada, puxada e inspeção foram medidas quadro a quadro num vídeo de referência do CS2. Em repouso aparecem as duas mãos, com o punho direito na horizontal, mais à direita e embaixo, o anel à esquerda e a garra à direita, com a concavidade virada para a frente e vista na diagonal de cima. A puxada dura 0,8 s (24 quadros a 30 fps): a mão sobe pela direita, a faca dá uma volta completa no indicador e desce ao repouso enquanto a esquerda entra. A inspeção dura 3,0 s: levanta o punho e vira a faca no indicador. Na exibição, que dura cerca de 1,2 s, a faca vira no eixo do cabo e fica por cima da mão: o anel em cima, o cabo atravessando o punho e a garra saindo por baixo, curvada para a esquerda. Depois volta girando ao repouso. Cortes e golpe forte cruzam a tela.

As duas facas usam interpolação cúbica monotônica: a velocidade passa contínua pelas poses-chave, sem o "para e anda" de antes, e nunca ultrapassa os valores capturados. As duas têm respiração leve em repouso, e toda animação termina entrando nesse movimento.

A **Desert Eagle** usa a puxada de 0,8 s inspirada no vídeo enviado: sobe pela direita, gira em torno do dedo e encaixa a mão de apoio antes de liberar o disparo. O tiro levanta o punho rapidamente e retorna em cerca de 0,4 s; cliques rápidos continuam da pose atual. O cano é fixo, o ferrolho se move e fica aberto ao esvaziar o carregador. O modelo tem 356 triângulos, com empunhadura inclinada, guarda-mato aberto, miras e faces chanfradas, mantendo cores chapadas e as skins. O enquadramento da Deagle fica um pouco mais alto; USP-S e Estimulante mantêm a posição anterior.

O som da Deagle continua sintetizado: ataque seco, corpo grave e fechamento metálico curto, além dos pequenos sons sincronizados da puxada. O vídeo serve de referência, sem carregar sua faixa de áudio no jogo. O dano, a precisão, as 7 balas, a cadência e a recarga foram mantidos; a duração da puxada passa a acompanhar a nova animação.

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

No Elimination online vale o mapa escolhido por quem criou a sala.

## Regras

- Primeiro a 10 rodadas vence (dá para mudar para 5, 8, 13 ou 16).
- 3 s de freeze no começo de cada rodada. Rodada acaba na primeira morte.
- Se o tempo acabar, vence quem tiver mais vida.
- 100 de vida. O colete funciona como o escudo do Valorant (100 de colete = 50 de escudo, que absorve 66% de cada acerto até acabar). Capacete só conta contra a AWP.
- Lado e ponto de nascimento são sorteados a cada rodada.

| Arma (regras do Valorant) | Cabeça / corpo / perna | Pente | Cadência |
|---|---|---|---|
| AK-47 (Vandal) | 160 / 40 / 34, sem queda até 50 m | 25 | 9,75/s |
| M4A1-S (Phantom) | 156 / 39 / 33 até 20 m; 140 / 35 / 29 depois | 30 | 11/s |
| Galil e FAMAS (Bulldog) | 115 / 35 / 29 | 24 | 10/s; rajada de 3 no botão direito |
| UMP-45 (Spectre) | 78 / 26 / 22; 66 / 22 / 18 a 15 m; 60 / 20 / 17 a 30 m | 30 | 13,3/s |
| Bucky | 34 / 17 / 14 por chumbo (15 chumbos), caindo em 8 e 12 m | 5 | 1,1/s |
| SSG 08 (Marshal) | 202 / 101 / 85 | 5 | 1,5/s (1,2/s com luneta) |
| Desert Eagle (Sheriff) | 159 / 55 / 46; 145 / 50 / 42 depois de 30 m | 6 | 4/s |
| USP-S (Ghost) | 105 / 30 / 25; 87 / 25 / 21 depois de 30 m | 13 | 6,75/s |
| Glock-18 (Classic) | 78 / 26 / 22; 66 / 22 / 18 depois de 30 m | 12 | 6,75/s |
| AWP (CS2) | 115 no peito, ×4 na cabeça | 5 | — |
| Karambit / Butterfly | 40 / 65 | — | — |

Dano arredondado para baixo, sem efeito de capacete. O estômago conta como corpo.

## Tiro e movimento como no Valorant

Todas as armas, menos a AWP, seguem as regras de tiro e movimento do Valorant. A AWP continua com o modelo do CS2 (tiro e movimento), e o bunnyhop não mudou. Os modelos e nomes das armas são os do jogo; cada uma usa os números da arma equivalente do Valorant (tabela acima).

**De onde vêm os números:**
- **Estatísticas oficiais das armas:** cadência, pente, recarga, saque, velocidade, dano por distância, zoom e modo de mira, expostas pela [valorant-api.com](https://valorant-api.com/v1/weapons).
- **Spread:** tabelas de spread (primeiro tiro e máximo, em pé, agachado e com mira; erro agachado, andando, correndo e no ar) e histórico de patches da [wiki do Valorant](https://valorant.fandom.com/wiki/Vandal).
- **Regras de movimento e precisão:** notas de patch da Riot: [0.50](https://valorant.fandom.com/wiki/Patch_Notes/0.50) (Tap Efficiency, Gun Recovery Time, recuo lateral agachado), [2.02](https://valorant.fandom.com/wiki/Patch_Notes/2.02), [3.0](https://valorant.fandom.com/wiki/Patch_Notes/3.0) (tagging de 72,5%, zona morta de 27,5%), [6.11](https://valorant.fandom.com/wiki/Patch_Notes/6.11) (viés para o centro, recuo correndo) e [9.10](https://valorant.fandom.com/wiki/Patch_Notes/9.10) (erro andando 3° e correndo 6° nos fuzis).
- **Tempos de parada:** medidos por um desenvolvedor da Riot na Phantom e repetidos por [guias](https://alviran.net/blog/valorant-movement-guide-2026/) e [fóruns](https://devtrackers.gg/valorant/p/f29d0021-walking-running-accuracy-too-high) da comunidade. O post original não foi encontrado.

**Movimento** (conferido por teste):
- **Velocidade:** 6,75 m/s com a faca, multiplicada pela arma: Vandal, Phantom, Bulldog, Sheriff e Marshal 0,8 (5,4 m/s); Spectre, Ghost e Classic 0,85; Bucky 0,75.
- **Shift e agachado:** Shift anda a 61% e agachado a 40%. Com a luneta, a Marshal anda a 90%.
- **Chão (estilo Unreal):** com tecla apertada, o atrito puxa a velocidade para a direção da tecla. Na tecla oposta, isso freia forte (contra-strafe). A aceleração é fixa (32 m/s²). Sem tecla, freia com desaceleração fixa mais atrito.
- **Constantes:** ajustadas aos tempos da Riot.

| Situação | Tempo |
|---|---|
| Arrancada até a velocidade máxima | ~0,17 s |
| Contra-strafe até a velocidade de andar (61%) | ~0,055 s |
| Contra-strafe até a zona morta (27,5%) | ~0,10 s |
| Contra-strafe até parar | ~0,16 s |
| Soltar a tecla até a zona morta / até parar | ~0,13 s / ~0,2 s |

- **Tagging:** tomar tiro deixa o boneco 72,5% mais lento por um instante.
- **Aterrissagem:** não reduz a velocidade nas armas do Valorant.

**Precisão:**
- **Spread base:** começa no 1º tiro da arma (Vandal 0,25°, Phantom 0,2°, agachado menor) e cresce a cada bala até o máximo (Vandal 1° em 6 balas).
- **Gun Recovery Time:** depois de um intervalo de tiro sem atirar, o spread volta ao 1º tiro nesse tempo (Vandal 0,375 s, Phantom 0,35 s).
- **Tap Efficiency:** atirar de novo antes de recuperar acumula menos quanto mais se espera.
- **Erro de movimento:** soma graus ao spread.
  - **Zona morta:** abaixo de 27,5% da velocidade da arma, não há erro. Por isso o contra-strafe deixa a arma precisa em ~0,1 s.
  - **Acima da zona morta:** o erro cresce com a velocidade até o valor do estado: agachado andando, Shift ou correndo (fuzis 0,8° / 3° / 6°).
  - **No ar e na aterrissagem:** no ar o erro é fixo (fuzis 10°). Aterrissar soma 7° por 0,225 s.
- **Viés para o centro:** parado, as balas puxam para o centro do cone. Andando, ficam quase uniformes no cone.

**Recuo:**
- **Subida:** o primeiro tiro sai no centro. A bala sobe por uma curva até o topo da arma (Vandal ~5°, M4A1-S ~4,8°) e para de subir.
- **M4A1-S:** recuo 10% maior que o da Phantom (subida, lado e tremida), ajuste próprio do jogo.
- **Lado:** depois das balas protegidas (Vandal 6, Phantom 8, Spectre 5), o recuo vai para um lado. A cada bala há 10% de chance de trocar de lado, e cruzar de um lado ao outro leva o tempo da arma (0,6 s nos fuzis, 0,28 s na Spectre).
- **Multiplicadores:** correndo ou no ar, a subida é 1,8× (Spectre 1,5× também no lado). Agachado e parado, o lado é 15% menor. Com a luneta da Marshal, o recuo é 10% menor.
- **Reset:** sem atirar, o recuo volta ao centro no Gun Recovery Time, junto com o spread.
- **Estimativa:** o tamanho exato de cada recuo não é publicado pela Riot e foi estimado pelos sprays conhecidos.
- **Câmera:** a tela mostra parte do recuo (45%, ou 70% com o tremor sem suavizar); as balas seguem o recuo inteiro.
- **Sem ADS:** o jogo não tem mira pelos aparelhos (ADS). Só as armas com luneta (AWP e SSG 08) dão zoom.
- **Rastro:** sai do cano que aparece na tela e é um risco curto que viaja até onde a bala bateu, a 420 m/s. Antes era uma linha inteira e parada, que começava num ponto fixo à frente do olho e não no cano.

**Botão direito:**
- **Bulldog (Galil e FAMAS):** rajada de 3 tiros a 13,3/s, sem zoom, 2,1 rajadas por segundo. No Valorant essa rajada vem com a mira; aqui ficou no botão direito.
- **Classic (Glock):** um tiro de 3 chumbos que gasta 3 balas, a 2,22 tiros por segundo.
- **Bucky:** um cartucho que voa reto até 7,5 m e estoura em 5 chumbos. Se acertar alguém antes, dá o dano de um chumbo.
- **Marshal (SSG 08):** luneta de 3,5×, com tiro perfeito parado.

**Escudo:** o colete vale como escudo do Valorant (100 de colete = 50 de escudo) e absorve 66% de qualquer acerto (cabeça, corpo ou perna) até acabar. Contra a AWP, colete e capacete seguem o CS2.

**Online:** nas salas, o colete é aplicado só na máquina de quem leva o tiro. Antes ele era descontado duas vezes, e acertos no estômago pela rede eram descartados.

## AWP (modelo do CS2)

A AWP mantém o tiro do CS2: números do `weapons.vdata` publicado no espelho público dos arquivos do jogo ([SteamTracking/GameTracking-CS2](https://github.com/SteamTracking/GameTracking-CS2)) e regras de uso do estudo público do [cs2spraylab](https://github.com/HamzahAlrawi/cs2spraylab) (GPL-3; só as descrições foram usadas, o código é próprio).
- **Precisão:** base em pé, agachado ou no ar, penalidade por tiro que volta em `10^(-dt/tempo)` e imprecisão acima de 34% da velocidade.
- **Recuo e punch:** aim punch com os valores do CS. Agachado, o impulso é 15% menor.
- **Luneta:** 100 u/s em pé, 52 com Shift e 68 agachada. Logo depois de abrir a luneta, o tiro ainda carrega parte da imprecisão sem luneta (~0,22 s).
- **Linhas da luneta:** desfocam conforme a imprecisão real ([referência da Valve](https://blog.counter-strike.net/2016/10/16296/)).
- **Movimento:** física do Source (atrito 5,2, aceleração 5,5, parada a 80 u/s; ~0,2 s até ficar precisa ao soltar, 0,04–0,09 s com contra-strafe).
- **Aterrissagem do CS2:** velocidade máxima em `b²` por ~0,25 s.

A luneta fica bloqueada durante a recarga e com o carregador vazio.

## Movimento (geral)

A física roda em passos fixos de 1/128 s, e a câmera interpola entre os dois últimos passos, para o deslocamento por quadro ficar regular em qualquer FPS. As teclas contam do instante exato em que são apertadas ou soltas, e o resultado é o mesmo a 30 ou a 144 FPS. A diagonal não ganha velocidade.

Os bonecos têm passada nas oito direções, no estilo do Valorant: as pernas giram no quadril, alternadas, na direção em que o boneco anda (de lado a passada é menor). Correndo, os passos são largos (cerca de 1 m) e, andando com Shift, curtos (cerca de 0,5 m). O comprimento do passo segue a abertura das pernas, então o pé não escorrega nem treme. A direção e a velocidade usadas na animação são suavizadas e vêm da velocidade real do boneco, não da diferença de posição a cada quadro. O tronco só inclina de leve para onde anda, sem girar. A cabeça fica sempre na mesma altura, e a arma acompanha o tronco. Vale para bots, pessoas online e o oponente do 1v1.

Degraus e escadas sobem sozinhos, até 0,5 m por degrau, sem perder velocidade. Nos mapas convertidos (Guard e Elysion), a física sobe só o necessário para cada degrau, para a cabeça não bater no teto de escadas cobertas. Ela também trata a quina do degrau como degrau, e não como rampa: antes, a quina jogava o boneco para cima e ele subia a escada se arrastando.

O agachamento: a câmera desce e sobe em cerca de 0,22 s, e a velocidade cai junto com a altura, sem pular de uma vez. Cada agachada gasta stamina; spammar C deixa a próxima bem mais lenta (até uns 0,7 s), e ela volta ao normal em cerca de 1,5 s. No ar o encolher das pernas continua instantâneo, para subir em caixas.

Os passos têm duas camadas, com o baque do calcanhar e o raspar da sola, alternando pé esquerdo e direito, e um respingo na água rasa. O ritmo acompanha a velocidade. Shift e agachado continuam silenciosos.

**Bunnyhop assistido** vem ligado (não mudou): segure Espaço para pular novamente ao tocar o chão. Para ganhar controle no ar, solte W, alterne A/D e acompanhe o movimento com o mouse. É possível desligar a assistência e usar pulos manuais ou configurar a rodinha para pular. Nesse caso, troque armas pelas teclas 1–4 ou Q. A velocidade aérea tem limite para impedir aceleração ilimitada.

No difícil, os bots se deslocam entre rajadas, fazem contra-strafe antes do disparo, às vezes agacham para fazer spray e tentam quebrar a linha de visão durante a recarga. Em trechos livres, podem sacar a faca e tentar sequências curtas de bunnyhop, com acertos e erros de tempo. O agachamento aparece para os outros jogadores no 1v1, no 2v2, no XvX e no DM.

### Saque, recarga e ferrolho

As armas têm animações próprias de saque e de recarga, com o CS como base. O pente, o ferrolho (ou a alavanca de manejo) e a telha da escopeta são peças separadas do modelo, e as mãos se mexem de verdade. Cada parte do movimento tem som próprio: pente saindo e entrando, ferrolho e telha. As durações seguem o tempo de saque e de recarga de cada arma.

- **Saque:** a arma sobe de baixo da tela girando e a mão esquerda chega no guarda-mão. Na AK, na Galil e na UMP, a mão ainda puxa a alavanca de manejo. Na AWP e na SSG, a mão direita passa o ferrolho.
- **Recarga dos rifles e da UMP:** a arma inclina, a mão esquerda segura o pente, puxa, joga para fora da tela, traz o pente novo e encaixa com um tapa.
  - **AK e Galil:** o pente entra balançando. Depois, a mão passa por baixo da arma e puxa a alavanca do lado direito.
  - **M4A1-S e FAMAS:** a mão bate no retém do ferrolho.
  - **UMP:** a mão puxa a alavanca do lado esquerdo.
- **Pistolas (USP-S, Glock e Deagle):** a arma sobe e inclina, o pente cai pelo cabo, e a mão esquerda traz o novo de baixo e encaixa com um tapa. Na Deagle vazia, o ferrolho fica travado para trás até o fim da recarga e então é solto.
- **AWP e SSG 08:** depois de cada tiro, a mão direita sai do cabo, levanta a alavanca do ferrolho, puxa, empurra e abaixa, como no CS. A animação cabe dentro do intervalo entre tiros. A recarga troca o pente e passa o ferrolho no final.
- **Bucky:** depois de cada tiro a mão esquerda bombeia a telha, com um tranco da arma. Na recarga a arma inclina e a mão põe quatro cartuchos pela janela de baixo, um por vez, e bombeia no fim.

A cada tiro a arma dá um coice na mão: vai um pouco para trás e levanta a boca, e uma mola amortecida a traz de volta sem tremer, em qualquer FPS. Na AWP, na Scout e na Bucky o coice é bem maior que nas SMGs; a Deagle mantém a animação própria. O solavanco ao tomar tiro é pequeno e tem teto.

É uma aproximação própria para este jogo no navegador, sem os motores nem os assets do Valorant ou do CS2.

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Shift | Andar devagar (sem passos) |
| C | Agachar (no ar, encolhe as pernas para subir nas caixas) |
| Espaço | Pular / segurar para bunnyhop assistido |
| Mouse 1 | Atirar |
| Mouse 2 | Luneta da AWP e da SSG / rajada de 3 da Galil e da FAMAS / tiro alternativo da Glock (3 chumbos) e da Bucky (cartucho) / golpe forte da faca |
| 1 2 3 | Primária (fuzis, SMG, escopeta, AWP e Scout), pistola e faca; no Plant the Bomb, 4 alterna granadas e 5 pega a bomba |
| Q / rodinha | Última arma / trocar arma |
| G | Largar a arma na mão |
| E | Pegar/trocar a arma do chão; plantar e desarmar a bomba |
| R | Recarregar |
| F | Inspecionar (giros da Karambit e Butterfly) |
| B | Loja (grátis fora do Plant the Bomb e do Wingman) |
| Tab | Placar |
| Esc | Menu de pausa |

## Configurações

Use **Configurações**, no topo do menu, para abrir a tela de mouse, mira, armas, partida, preferências, vídeo e som e controles. As opções ficam em linhas alinhadas, com navegação por seção e salvamento automático. A interface usa grafite, branco suave e detalhes em azul-aço. A IBM Plex Sans é carregada localmente, em três arquivos WOFF2 latinos, com licença e fonte documentadas em `assets/ui/fonts/`. Não há índices decorativos ou cantoneiras.

- **Cor do boneco:** escolha antes de entrar na sala. É a cor que o oponente vê.

- **Mira:** estilo estático ou dinâmico, cor, tamanho, espessura, espaço, contorno, ponto central, formato T, opacidade.
- **Mouse:** sensibilidade na escala do CS (mostra o equivalente no Valorant e os cm/360 pelo seu DPI) e sensibilidade da luneta.
- **Preferências:** **Suavizar tremor dos disparos** vem ligado e preserva o tremor leve anterior. Desligar aumenta o recuo visual da câmera de 45% para 70% do recuo calculado; precisão, dano e trajetórias das balas não mudam. A opção é própria deste jogo. A separação entre movimento da câmera e trajetória também aparece nas [notas oficiais do CS2 de 21 de abril de 2026](https://store.steampowered.com/news/posts/?appids=730&enddate=1777070707).
- **Vídeo:** FOV (horizontal 4:3, CS = 90), escala de resolução, ajuste automático de resolução e contador de FPS.

Tudo fica salvo no navegador.

O killfeed também funciona no Practice e no Prefire, com o nome do alvo/spot, a arma e o headshot. Aparece uma única vez no abate; o respawn imediato do Practice continua igual.

O killfeed identifica headshots com um ícone vetorial de cabeça e projétil, com descrição acessível, no lugar do texto **HS**. Nos últimos três segundos de preparação há um tick curto por segundo, e o fim da rodada tem um aviso de dois tons. Os sons seguem o volume geral; retransmissões online e pequenas correções de relógio não repetem os avisos. Ao voltar de uma aba oculta, os ticks perdidos não são reproduzidos em sequência.

A luneta da AWP e da Scout só abre quando a arma está pronta para disparar: após a puxada, a recarga e o intervalo entre tiros. A AWP mantém dez balas por carregador.

## Desempenho e desenvolvimento

Sem pós-processamento, sombras em tempo real ou antialiasing durante o jogo. O mapa e as partes estáticas das armas usam geometria agrupada; impactos e rastros são reutilizados. As animações só transformam grupos existentes. A resolução padrão não multiplica pixels por telas de DPI alto. O ajuste automático reduz a resolução quando o tempo médio de quadro sobe. A cena 3D é renderizada durante a partida e fica suspensa em abas ocultas. A seleção de mapas usa imagens WebP estáticas, SVG e CSS, sem reconstruir o mapa 3D a cada seleção. A prévia da arma no arsenal cria seu renderizador apenas no primeiro acesso e desenha uma vez por seleção ou redimensionamento. O estilo dos menus fica em `assets/ui/menu.css`; nenhuma biblioteca foi acrescentada. As prévias atuais foram renderizadas separadamente em **1280 × 720 com antialiasing**, com câmeras próprias; as miniaturas usam 320 × 180. A proporção é 16:9 em todos os tamanhos, sem deformar a cena. A faixa de mapas aceita os botões de navegação, a rodinha e o teclado. A arena é construída ao iniciar a partida.

No DM e no 2v2, os outros participantes compartilham geometria por instanciamento: corpo, cabeça, capacete, nove modelos de arma (facas incluídas) e marcador de aliado, com efeitos reutilizados. A cor de cada instância é alocada com a capacidade total antes do primeiro desenho; antes dessa correção o buffer ficava vazio e a GPU descartava os bots, que ficavam invisíveis. A navegação é uma grade 2,5D: cada célula guarda a altura do chão e só liga vizinhas sem degrau maior que um passo, então os bots sobem escadas, rampas e plataformas. A malha é calculada uma vez por mapa e reutiliza buffers de busca; a percepção dos bots é distribuída ao longo dos quadros. Áudio e passos simultâneos têm limite próprio para evitar picos.

Mouse bruto quando disponível, disparo processado no evento de clique e envio imediato de tiros no 1v1. A latência final depende do navegador, monitor, hardware e rede; não há garantia de latência zero ou desempenho igual em todos os PCs.

Prévia local com Node.js 22 ou mais recente: `node tools/serve.mjs`, depois abra `http://127.0.0.1:8081`. Use `--port=8082` para trocar a porta. O servidor aceita um caminho de vídeo opcional para revisão local em `/reference.mp4`; esse vídeo não é incorporado ao jogo.

A página `/tools/knife-preview.html` permite visualizar as facas isoladas ou na mão e reproduzir cada animação, com uma régua para conferir poses intermediárias. Ela reutiliza a geometria, as posições e as animações de `index.html` e usa enquadramento 16:9. Não é carregada pelo jogo. A Butterfly isolada usa cerca de 2.850 triângulos e três chamadas de desenho (lâmina e os dois cabos, que giram separados); com mãos e braços, cerca de 2.900 triângulos e 7 chamadas.

Use `/tools/knife-preview.html?weapon=knife` para abrir diretamente a Karambit. O modelo tem cerca de 3.500 triângulos em uma chamada de desenho; com mãos e braços, cerca de 3.560 triângulos e 5 chamadas. Lâmina, cabo e anel compartilham geometria entre primeira e terceira pessoa. As curvas são criadas uma única vez; as animações reutilizam os mesmos grupos e buffers.

Testes sem dependências: `node --test tests/game.test.cjs`. Cobrem as 24 combinações de equipamento, dano e capacete, recargas e armas do bot, precisão, contra-strafe, diagonal, consistência entre 30/60/144 FPS, bunnyhop, colisões, rampas e animações das facas. Também verificam os dez participantes do DM, categorias, navegação, spawns iniciais sem linha de visão entre si e virados para rotas abertas, sites elevados alcançáveis, proteção, autoria dos abates, confrontos reais entre bots nas quatro categorias, recargas e encerramento exato de cinco minutos. Para as novidades: o bloqueio da AK Sublime (código só como hash), a sequência de abates das skins, as recompensas de abate do DM, uma partida 2v2 e uma 1v5 completas com bots (sem fogo amigo, placar consistente) e as salas online de DM e de times, simuladas com um PeerJS falso que troca as mensagens reais entre juiz e convidado (entrada no meio da partida, respawn, abates e recompensas iguais dos dois lados).

Para testar salas online sem o servidor público do PeerJS, rode um servidor PeerJS local e abra o jogo com `?peerserver=127.0.0.1:9000`.

## Publicar no GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → Branch `main`, pasta `/ (root)`.
