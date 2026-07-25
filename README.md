# Rolê Salvador 🐚

Agenda cultural de Salvador, dia a dia — feita com amor na Bahia por
[Apezinho do Rio Vermelho](https://apezinhodorv.com.br).

App de uma página só (`index.html`), sem build. Reúne a programação cultural da cidade
por dia, com links de ingressos e "como chegar", filtros por categoria e a opção de
adicionar seus próprios rolês (salvos no aparelho).

## Como funciona a agenda

Os eventos ficam no `<script>` dentro do `index.html`:

- **`DATADOS`** — shows/eventos com data marcada (ISO `AAAA-MM-DD`).
- **`FIXOS`** — rolês que se repetem toda semana (por dia da semana).
- **`HOJE_ISO`** — data de referência (dia em que a agenda foi atualizada). A tira de
  calendário começa nessa data.

Para atualizar a semana: mudar `HOJE_ISO` e reescrever a lista `DATADOS`.

## Publicação

Site estático no Netlify (`publish = "."`). Todo push na branch principal republica sozinho.
```
