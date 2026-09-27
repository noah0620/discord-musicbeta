import {
 Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags
} from 'discord.js';
import {
 joinVoiceChannel,createAudioPlayer,createAudioResource,AudioPlayerStatus,StreamType,
 VoiceConnectionStatus,entersState
} from '@discordjs/voice';
import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import youtubedl from 'youtube-dl-exec';
import play from 'play-dl';
import fs from 'node:fs';

export function startMusicBot(token,label){
 const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});

 const sessions=new Map();

 // Discord interactionは1回しか初回応答できない。
 // 3台のBOTが同じボタンイベントを受けても、対象BOT以外は応答しない。
 async function safeReply(i, payload){
  const data=typeof payload==='string'?{content:payload}:payload;
  if(data.ephemeral){
   delete data.ephemeral;
   data.flags=MessageFlags.Ephemeral;
  }
  try{
   if(i.deferred) return await i.editReply(data);
   if(i.replied) return await i.followUp(data);
   return await i.reply(data);
  }catch(e){
   // 40060 = 既に別ハンドラ等で応答済み。BOTを落とさない。
   if(e?.code===40060||e?.code===10062){
    console.warn(`[${label}] interaction response skipped: ${e.code}`);
    return null;
   }
   throw e;
  }
 }


 function key(guildId){return guildId;}
 function humans(ch){return ch?.members?.filter(m=>!m.user.bot).size??0;}
 function buttonId(action){return `m:${client.user.id}:${action}`;}
 function buttons(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(buttonId('pause')).setLabel('⏸ 一時停止').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId(buttonId('resume')).setLabel('▶ 再開').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(buttonId('skip')).setLabel('⏭ スキップ').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(buttonId('stop')).setLabel('⏹ 停止').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId(buttonId('leave')).setLabel('🚪 退出').setStyle(ButtonStyle.Danger)
 );}

 // 参照ファイルと同じ youtube-dl-exec 方式。
 // キュー待ちで音声URLが期限切れにならないよう、ここでは動画ページ情報だけ保持する。
 async function resolveTrack(input){
  // 指定記事と同じ考え方: play-dlでURL判定/検索、yt-dlpは実再生を担当。
  if(/^https?:\/\//i.test(input)){
   const type=await play.yt_validate(input);
   if(type==='video'){
    const info=await play.video_info(input);
    const v=info.video_details;
    return {title:v.title||input,url:v.url||input,duration:Number(v.durationInSec)||0};
   }
   // play-dlで取得できないURLもyt-dlpへ渡せるよう保持
   return {title:input,url:input,duration:0};
  }
  const rows=await play.search(input,{limit:1,source:{youtube:'video'}});
  const v=rows?.[0];
  if(!v)throw new Error('曲が見つかりませんでした。');
  return {title:v.title||input,url:v.url,duration:Number(v.durationInSec)||0};
 }
 async function freshStreamUrl(pageUrl){
  const cookie=process.env.YOUTUBE_COOKIE||'cookies.txt';
  const opts={getUrl:true,format:'bestaudio/best',noPlaylist:true,noWarnings:true};
  if(fs.existsSync(cookie))opts.cookies=cookie;
  const stream=await youtubedl(pageUrl,opts);
  const u=String(stream).trim().split(/\r?\n/).find(x=>/^https?:\/\//.test(x));
  if(!u)throw new Error('音声ストリームURLを取得できませんでした。');
  return u;
 }
 function makeAudio(url,volume){
  const proc=spawn(ffmpegPath,[
   '-hide_banner','-loglevel','warning',
   '-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','5',
   '-i',url,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'
  ],{stdio:['ignore','pipe','pipe']});
  proc.stderr.on('data',d=>console.error(`[${label}] ffmpeg: ${String(d).trim()}`));
  const resource=createAudioResource(proc.stdout,{inputType:StreamType.Raw,inlineVolume:true});
  resource.volume?.setVolume((volume??100)/100);
  return {proc,resource};
 }
 function destroy(guildId){
  const s=sessions.get(key(guildId)); if(!s)return;
  s.queue.length=0;
  try{s.ffmpeg?.kill('SIGKILL');}catch{}
  try{s.player.stop(true);}catch{}
  try{s.connection.destroy();}catch{}
  sessions.delete(key(guildId));
 }
 async function next(guildId){
  const s=sessions.get(key(guildId));
  if(!s||s.playing||!s.queue.length)return;
  const track=s.queue.shift();
  try{
   // 再生直前にURLを取り直す（期限切れ対策）
   const streamUrl=await freshStreamUrl(track.url);
   const {proc,resource}=makeAudio(streamUrl,s.volume);
   s.current=track;s.playing=true;s.ffmpeg=proc;
   proc.on('error',e=>console.error(`[${label}] ffmpeg process error`,e));
   s.player.play(resource);
  }catch(e){
   console.error(`[${label}] play error`,e);
   s.current=null;s.playing=false;s.ffmpeg=null;
   setTimeout(()=>next(guildId).catch(console.error),500);
  }
 }
 async function join(guild,vc){
  let s=sessions.get(key(guild.id));
  if(s){
   if(s.channelId!==vc.id)throw new Error('このBOTは別のボイスチャンネルで使用中です。');
   return s;
  }
  // 重要: 3台同時起動時に@discordjs/voiceの接続が衝突しないようBOT IDごとにgroupを分離
  const connection=joinVoiceChannel({
   channelId:vc.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,
   selfDeaf:true,group:`music-${client.user.id}`
  });
  await entersState(connection,VoiceConnectionStatus.Ready,20000);
  const player=createAudioPlayer();
  connection.subscribe(player);
  s={channelId:vc.id,connection,player,queue:[],current:null,playing:false,ffmpeg:null,volume:100};
  sessions.set(key(guild.id),s);
  player.on(AudioPlayerStatus.Idle,()=>{
   try{s.ffmpeg?.kill('SIGKILL');}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;
   next(guild.id).catch(console.error);
  });
  player.on('error',e=>{
   console.error(`[${label}] AudioPlayer`,e);
   try{s.ffmpeg?.kill('SIGKILL');}catch{}
   s.ffmpeg=null;s.current=null;s.playing=false;
   next(guild.id).catch(console.error);
  });
  connection.on(VoiceConnectionStatus.Destroyed,()=>sessions.delete(key(guild.id)));
  return s;
 }
 function sameVC(i){
  const s=sessions.get(key(i.guildId));
  return s&&i.member?.voice?.channelId===s.channelId?s:null;
 }
 async function autoLeave(guildId){
  const s=sessions.get(key(guildId));if(!s)return;
  const guild=client.guilds.cache.get(guildId);
  const ch=guild?.channels.cache.get(s.channelId)||await guild?.channels.fetch(s.channelId).catch(()=>null);
  if(!ch||humans(ch)===0){
   console.log(`[${label}] 👋 VCが無人のため自動退出`);
   destroy(guildId);
  }
 }

 client.on(Events.VoiceStateUpdate,(o,n)=>{
  if(sessions.has(key(o.guild.id)))setTimeout(()=>autoLeave(o.guild.id).catch(console.error),1000);
 });
 setInterval(()=>{for(const gid of sessions.keys())autoLeave(gid).catch(console.error)},15000);

 client.once(Events.ClientReady,c=>console.log(`✅ ${label}: ${c.user.tag} / ${c.user.id}`));
 client.on(Events.InteractionCreate,async i=>{
  try{
   if(i.isButton()&&i.customId.startsWith('m:')){
    try{await i.deferReply({flags:MessageFlags.Ephemeral});}
    catch(e){if(e?.code===10062||e?.code===40060)return;throw e;}
    const parts=i.customId.split(':');
    // m:<botUserId>:<action> のボタンは、そのBOT本人だけが処理する
    if(parts.length!==3||parts[1]!==client.user.id)return;
    const s=sameVC(i);
    if(!s)return safeReply(i,{content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
    const a=parts[2];
    if(a==='pause'){s.player.pause();return safeReply(i,{content:'⏸ 一時停止しました。',ephemeral:true});}
    if(a==='resume'){s.player.unpause();return safeReply(i,{content:'▶ 再開しました。',ephemeral:true});}
    if(a==='skip'){s.player.stop(true);return safeReply(i,{content:'⏭ スキップしました。',ephemeral:true});}
    if(a==='stop'){s.queue.length=0;s.player.stop(true);return safeReply(i,{content:'⏹ 停止しました。',ephemeral:true});}
    if(a==='leave'){destroy(i.guildId);return safeReply(i,{content:'🚪 退出しました。',ephemeral:true});}
   }
   if(!i.isChatInputCommand())return;
   try{await i.deferReply({flags:MessageFlags.Ephemeral});}
   catch(e){if(e?.code===10062||e?.code===40060)return;throw e;}
   const n=i.commandName;
   if(n==='play'){
    const vc=i.member?.voice?.channel;
    if(!vc)return safeReply(i,{content:'❌ 先にボイスチャンネルへ参加してください。'});
    try{
     const track=await resolveTrack(i.options.getString('query',true));
     const s=await join(i.guild,vc);
     s.queue.push(track);
     await i.editReply({embeds:[new EmbedBuilder().setTitle('🎵 Music BOT 1').setDescription(`**${track.title}**\n${track.url}\n\nVC: <#${vc.id}>`)],components:[buttons()]});
     if(!s.playing)next(i.guildId).catch(console.error);
    }catch(e){await i.editReply(`❌ 再生準備に失敗しました。\n${String(e.message||e).slice(0,1200)}`);}
    return;
   }
   if(n==='leave'){
    const s=sameVC(i);if(!s)return safeReply(i,{content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
    destroy(i.guildId);return safeReply(i,'🚪 退出しました。');
   }
   const s=sameVC(i);
   if(!s)return safeReply(i,{content:'❌ このBOTと同じVCに参加してください。',ephemeral:true});
   if(n==='queue')return safeReply(i,[s.current&&`▶️ **${s.current.title}**`,...s.queue.map((x,j)=>`${j+1}. ${x.title}`)].filter(Boolean).join('\n')||'キューは空です。');
   if(n==='skip'){s.player.stop(true);return safeReply(i,'⏭ スキップしました。');}
   if(n==='stop'){s.queue.length=0;s.player.stop(true);return safeReply(i,'⏹ 停止しました。');}
   if(n==='pause'){s.player.pause();return safeReply(i,'⏸ 一時停止しました。');}
   if(n==='resume'){s.player.unpause();return safeReply(i,'▶ 再開しました。');}
   if(n==='nowplaying')return safeReply(i,s.current?`🎵 **${s.current.title}**\n${s.current.url}`:'現在再生していません。');
   if(n==='volume'){
    s.volume=i.options.getInteger('percent',true);
    s.player.state.resource?.volume?.setVolume(s.volume/100);
    return safeReply(i,`🔊 音量を ${s.volume}% に変更しました。`);
   }
  }catch(e){
   console.error(`[${label}]`,e);
   const msg={content:`❌ エラー: ${String(e.message||e).slice(0,1200)}`,ephemeral:true};
   await safeReply(i,msg).catch(e=>console.error(`[${label}] reply error`,e));
  }
 });
 client.login(token).catch(e=>console.error(`❌ ${label} ログイン失敗: ${e.message}`));
 return client;
}
