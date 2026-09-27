# ANMusicBOT - 記事ベース GitHub版

指定記事の構成を参考に、`discord.js` + `@discordjs/voice` + `play-dl` + `youtube-dl-exec` + `ffmpeg-static` で構成しています。既存の操作パネル（一時停止 / 再開 / スキップ / 停止 / 退出）は維持しています。

## 起動
```powershell
npm install
npm run deploy
npm start
```

`.env` に `DISCORD_TOKEN=` を設定してください。

## GitHub / Railway
ZIPの中身をGitHubリポジトリ直下へ配置し、Railway Variablesに `DISCORD_TOKEN` を登録してください。Dockerfile同梱です。

## YouTubeについて
検索と動画情報はplay-dl、再生直前の音声URL取得はyt-dlpを使用します。YouTube側のbot判定/403/ログイン要求はサービス側の制限なので、コードだけで常に回避できる保証はありません。cookies.txtはGitHubへコミットしないでください。


## 公開BOT版
この版はグローバルコマンド専用です。GUILD_IDは不要です。`npm run deploy` で全導入サーバー向けに登録します。
