import { SlashCommandBuilder } from 'discord.js';
export const commandData=[
 new SlashCommandBuilder().setName('play').setDescription('曲名またはURLから音楽を再生').addStringOption(o=>o.setName('query').setDescription('曲名 / URL').setRequired(true)),
 new SlashCommandBuilder().setName('queue').setDescription('再生キューを表示'),
 new SlashCommandBuilder().setName('skip').setDescription('現在の曲をスキップ'),
 new SlashCommandBuilder().setName('stop').setDescription('停止してキューを空にする'),
 new SlashCommandBuilder().setName('pause').setDescription('一時停止'),
 new SlashCommandBuilder().setName('resume').setDescription('再開'),
 new SlashCommandBuilder().setName('nowplaying').setDescription('現在再生中の曲を表示'),
 new SlashCommandBuilder().setName('volume').setDescription('音量を変更').addIntegerOption(o=>o.setName('percent').setDescription('1～200').setMinValue(1).setMaxValue(200).setRequired(true)),
 new SlashCommandBuilder().setName('leave').setDescription('BOTをボイスチャンネルから退出させる')
];
