# Referência da M4A4

`m4a4_lowpoly.glb` é o modelo enviado pelo usuário. Suas 64 peças e 1.024 triângulos são convertidos em dados estáticos dentro de `index.html` por `node tools/import-m4a4.mjs`.

A conversão ajusta eixos, escala e posição para a mão do jogador, preserva as cores e arredonda coordenadas a cinco casas decimais. O jogo reúne todas as faces em uma só malha, com sombras de cor por vértice, sem carregar o GLB, texturas ou um leitor de glTF durante a partida. As skins reutilizam a geometria com outras cores. A mesma forma aparece em primeira pessoa, nos oponentes e no instanciamento de DM/times.

A AWP é criada por perfis chanfrados e tubos octogonais: coronha vazada, carregador, guarda do gatilho, cano, lente azul, anéis e torres da luneta e alavanca do ferrolho. Também usa uma única malha, sem texturas ou partes animadas adicionais.
