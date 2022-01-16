<p align="center">
  <img src="https://i.ibb.co/9wxwVGw/b69dc3710a4ecbaaf36454ee253863b2-2.png" />
</p>

# AM4 Bot
AM4 Bot was a Discord & Telegram chat bot used in up to 63 servers and across several Telegram chats between 2020-2022 for the [Airline Manager 4](https://airline4.net/) game. The Discord bot was first published in 2020 with the Telegram bot following up in 2021. The bot stopped operating on Discord and Telegram 30th of January 2022 at 15:00 (UTC). The bot was used to search routes, planes, airports and player and alliance statistics, and visualize them in form of graphs. The bot used the [AM4 API](https://airline4.net/api/docs/) along with the [AM4 Tools API](https://api.am4tools.com/). For graphs & charts the bot used the Chart.js based library [quickchart-js](https://quickchart.io/). For storing data the bot used a MongoDB atlas database. For more information on the dependecies of this bot and what libraries it used, check out [the package.json file](package.json).

## Source code
> 📝 _This source code is no longer being maintained as of 30th of January 2022_.

### About the source code
This source code is meant to be a part of my portfolio and be a source of information for other tool developers as well. Feel free to take ideas and parts from this code for your own tools. Some of the functions and classes are documented in the code itself with comments. The source code contains both the Discord & Telegram bots. They can be found under different folders in the [client folder](client) and they are both ran from the [main file](bot.ts) in different clusters.

### About using the source code
Please note that this open sourced code has some missing files from it (see [.gitignore](.gitignore)), and is not meant to be just copy pasted and ran as it will not work. In addition, you would need the bot's database for this code to work. This source code only contains the TypeScript files, and compiled JavaScript files are excluded from this public source code along with the jsconfig file. **Please note that this code also contains some unfinished features** that were never published to AM4 Bot. For information on permissions, limitations and conditions with using this source code, please check out the [license](LICENSE). 

### Unfinished features
The source code contains some minor new features along with some major ones that were never finished, debugged or released. Below is a list of major features that were never released to AM4 Bot, and might not be finished or debugged:
- FAQ searching: [Slash Command](client/discord/commands/faq.ts) & [Message Context Menu](client/discord/context/faq.ts)
- Alliance member comparing: [User Context Menu](client/discord/context/compareMember.ts)
- Alliance comparing: [User Context Menu](client/discord/context/compareAlliance.ts)
- There might be some other optimization changes in some places that were never released as well

## Credits
Thank you to the AM4 Bot team and other people who supported me in developing, moderating and maintaining this bot. If you have contributed in anyway to this project and specifically want credit in here, or if you want your credit to be removed, please open a new dicussion on the [Discussions page](https://github.com/fsam4/AM4-Bot/discussions). In addition, thank you to the [Air France KLM Discord server](https://discord.gg/f8WHuRX) for being the home server of this bot.

### AM4 Bot team
AM4 Bot team was a selected group of players for moderation, error reporting and beta testing. In addition, they have contributed by making some of the quiz games and providing information on different game mechanics.
- `AMBE#6969` aka AMBE Airlines
- `Antony#6179` aka Prestige Wings
- `Gulf Airways#4655` aka Gulf Airways
- `IɴᴛᴇʀGᴀʟᴀᴄᴛɪᴄ#1010` aka InterGalactic
- `•_•#1381` aka Emeritas

# Discussions
> ⚠️ This respitory will be archived in some months or a year. Starting new dicussions will not be possible after that.

If you have any questions about the bot, tool developing or the source code, you can ask them in the [Questions category](https://github.com/fsam4/AM4-Bot/discussions/categories/questions). I will answer questions occasionally. If you just want to leave feedback, share your thoughts, share your own tools or anything else, you can start a discussion in the [General category](https://github.com/fsam4/AM4-Bot/discussions/categories/general). Please stay in appropriate categories with your discussions and use appropriate language.
