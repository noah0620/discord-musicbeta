import 'dotenv/config';
import {REST,Routes,SlashCommandBuilder} from 'discord.js';
const token=(process.env.DISCORD_TOKEN||process.env.MUSIC_BOT_TOKEN_1||'').trim();
if(!token)throw new Error('DISCORD_TOKEN がありません');
const c=[
 new SlashCommandBuilder().setName('play').setDescription('音楽を再生').addStringOption(o=>o.setName('query').setDescription('URL または検索ワード').setRequired(true)),
 new SlashCommandBuilder().setName('pause').setDescription('一時停止'),
 new SlashCommandBuilder().setName('resume').setDescription('再開'),
 new SlashCommandBuilder().setName('skip').setDescription('スキップ'),
 new SlashCommandBuilder().setName('stop').setDescription('停止'),
 new SlashCommandBuilder().setName('queue').setDescription('キュー表示'),
 new SlashCommandBuilder().setName('nowplaying').setDescription('再生中の曲を表示'),
 new SlashCommandBuilder().setName('volume').setDescription('音量変更').addIntegerOption(o=>o.setName('value').setDescription('0～100').setMinValue(0).setMaxValue(100).setRequired(true)),
 new SlashCommandBuilder().setName('leave').setDescription('VCから退出')
].map(x=>x.toJSON());
const rest=new REST({version:'10'}).setToken(token);
const me=await rest.get(Routes.user());
await rest.put(Routes.applicationCommands(me.id),{body:c});
console.log(`✅ ${c.length}個のグローバルコマンドを登録しました`);
console.log('🌐 公開BOT用: GUILD_IDは不要です');
