# Consentimento para auditar um site

O auditor só verifica um site real depois que o dono aceita. Este arquivo tem o texto do pedido, que pode ser enviado como está, e o modelo do registro que a ferramenta lê antes de auditar (`auditor <url> --consent <arquivo>`).

## Texto do pedido

> Olá, [nome]. Eu uso uma ferramenta gratuita, o light-site-auditor, que verifica se um site é leve, se abre rápido num celular com internet fraca (3G) e se tem barreiras para pessoas com deficiência. Posso verificar a página inicial de [endereço]?
>
> **O que a verificação faz:** abre a página inicial pública do seu site como um visitante comum, duas vezes seguidas, e mede com duas ferramentas abertas, o Lighthouse e o axe, que rodam no meu computador.
>
> **O que ela não faz:** não entra em área com login, não preenche nem envia formulários, não abre outras páginas e não gera mais tráfego do que essas duas visitas.
>
> Com o resultado, eu escrevo um relatório em português simples, com o que corrigir. O relatório fica só com você, a menos que você concorde com outro uso.
>
> Você concorda? Basta responder "sim" ou "não", e você pode mudar de ideia quando quiser.

## Registro do consentimento

Crie um arquivo por site, por exemplo `docs/field/<site>/consentimento.md`, que comece com este bloco:

```markdown
---
endereco: https://www.exemplo.com.br/
dono: Nome de quem aceitou
status: pendente: aguardando o aceite do dono
data: -
como: -
reacao: pendente
---
```

Quando o dono aceitar, troque `status` por `aceito`, `data` pela data do aceite (AAAA-MM-DD) e `como` pela forma do aceite (por exemplo, "por e-mail, respondendo ao pedido"). Depois de entregar o relatório, anote em `reacao` o que o dono achou.

A ferramenta recusa a auditoria quando:

- não há registro (`--consent`) e o endereço não é deste computador (`localhost`, `127.0.0.1`, `[::1]`);
- `status` é qualquer coisa diferente de `aceito`, inclusive `pendente`;
- o endereço auditado não é exatamente o `endereco` do registro;
- falta `endereco`, `dono`, `status`, `data` ou `como`, ou a data não está no formato AAAA-MM-DD ou é futura.

Não existe opção para pular essa verificação.

## O que fica guardado

Na pasta do relatório ficam `relatorio.md`, `relatorio.html`, `lighthouse.json` e `axe.json`. Neste repositório, as pastas `docs/field/<site>/` ficam fora do git (`.gitignore`): o relatório é só do dono do site.
