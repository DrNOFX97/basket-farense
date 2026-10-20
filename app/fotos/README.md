# Fotos dos jogadores

Cada escalão tem a sua pasta:

| Pasta | Escalão |
|---|---|
| `seniores-m/` | Seniores M |
| `sub18-m-a/` | Sub 18 M A |
| `sub18-m-b/` | Sub 18 M B |
| `sub18-f/` | Sub 18 F |
| `sub16-m/` | Sub 16 M |
| `sub16-f-a/` | Sub 16 F A |
| `sub16-f-b/` | Sub 16 F B |
| `sub14-m-a/` | Sub 14 M A |
| `sub14-m-b/` | Sub 14 M B |
| `sub14-f/` | Sub 14 F |

Coloca cada foto na pasta do respetivo escalão. O nome do ficheiro deve incluir
o nome do jogador e o FID, por exemplo:

```text
seniores-m/Gustavo Gonçalves 213344.jpg
sub18-m-a/Francisco Diogo 286092.jpg
```

O FID é o identificador único do jogador na API; não é o número da camisola.
A lista em `jogadores.csv` tem o nome, o número, o FID, a pasta e o nome de
ficheiro sugerido para cada jogador. Também é aceite apenas o FID
(`213344.jpg`) ou apenas o nome completo, mas o nome + FID é o mais seguro.

Um jogador que jogue em dois escalões só precisa de uma foto: o mapa é feito
pelo FID e aplica-se em todos os escalões.

Depois de adicionar ou substituir fotos, gera o mapa:

```bash
npm run fotos
```

O script percorre as subpastas, escreve `fotos.json` (não editar à mão) e
atualiza `jogadores.csv`. Formatos aceites: JPG, PNG, WebP e AVIF. Para caras
recortadas, usa PNG; se houver PNG e JPEG do mesmo jogador, o script usa o PNG.
Para melhor resultado: imagem quadrada, cerca de 400×400 px e menos de 500 KB.
Fotos de menores só devem ser publicadas com autorização.
