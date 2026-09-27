import { REST, Routes } from 'discord.js';
import { commandData } from './commands/definitions.js';

const bots = [
  ['Music BOT 1', process.env.MUSIC_BOT_TOKEN_1],
  ['Music BOT 2', process.env.MUSIC_BOT_TOKEN_2],
  ['Music BOT 3', process.env.MUSIC_BOT_TOKEN_3]
];

for (const [name, token] of bots) {
  if (!token) continue;
  const rest = new REST({ version: '10' }).setToken(token);
  const me = await rest.get(Routes.user('@me'));
  await rest.put(Routes.applicationCommands(me.id), {
    body: commandData.map(c => c.toJSON())
  });
  console.log(`✅ ${name}: コマンド登録完了`);
}
