# How to deploy

1. get application token and set to $TOKEN
Hint to get token: `curl https://discord.com/api/v10/oauth2/token -H "Authorization: Basic CREDENTIALS" -d "grant_type=client_credentials&scope=applications.commands.update"`
2. run `register.sh` with $TOKEN $APPID $GUILDID
3. `wrangler publish`
