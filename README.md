# Heroes of the Storm Infos Bot

<!---Esses são exemplos. Veja https://shields.io para outras pessoas ou para personalizar este conjunto de escudos. Você pode querer incluir dependências, status do projeto e informações de licença aqui--->

![GitHub repo size](https://img.shields.io/github/languages/code-size/mcobalchini/heroes-infos?color=%233d98cf&style=for-the-badge)
![Discord Server](https://img.shields.io/discord/977221397602508810?color=%233d98cf&label=Discord&style=for-the-badge)
![Github last commit](https://img.shields.io/github/last-commit/mcobalchini/heroes-infos?color=%233d98cf&style=for-the-badge)
![Github open pull requests](https://img.shields.io/github/issues-pr/mcobalchini/heroes-infos?color=%233d98cf&style=for-the-badge)

## Running
For this bot to work you'll need **nodejs**, to install the bot, follow this steps:

```
npm install
```

## Using
You have to create a file named `variables.env` and insert the following.
``` 
HEROES_INFOS_TOKEN = "TOKEN_HERE"
CLIENT_ID = CLIENT_ID_HERE
JOIN_SERVER_CHANNEL_ID = JOIN_ID_HERE
LEAVE_SERVER_CHANNEL_ID = LEAVE_ID_HERE
```

if you have a support server for this bot
the `JOIN_SERVER_CHANNEL_ID` and `LEAVE_SERVER_CHANNEL_ID`
variables refers to the channels that are going to be notified whenever a server adds your bot.

## License

This project is under license. See the file [LICENSE](LICENSE.md) for more details.
