# Prévias do menu

A interface atual usa os arquivos em **play/**: cenas 16:9 em 1280 × 720 e miniaturas em **play/thumb/**, com 320 × 180. São renders novos da geometria real do jogo, com antialiasing e compressão WebP. O arquivo **play/cameras.json** registra posições, alvos e campo de visão. O Aimbotz inclui os bots reais; Guard e Elysion usam pontos desobstruídos próximos do bombsite. A rotação reúne três câmeras renderizadas em viewports separados, sem esticar as cenas.

O destaque só carrega a imagem selecionada. As miniaturas usam carregamento adiado. Não existe renderização contínua dos mapas no menu. CSS mantém as imagens em 16:9 e os controles da partida ficam ao lado em monitores de desktop.

Os arquivos anteriores na raiz e em **large/** foram preservados; a seleção de mapas atual usa **play/**.
