# Hint to get token: curl https://discord.com/api/v10/oauth2/token -H "Authorization: Basic CREDENTIALS" -d "grant_type=client_credentials&scope=applications.commands.update"

echo "Authorization: Bearer $TOKEN"

curl -X PUT -d @command.json -H "Content-type: application/json" -H "Authorization: Bearer $TOKEN" https://discord.com/api/v10/applications/$APPID/commands