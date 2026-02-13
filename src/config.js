require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/maiobot',
  jobRoles: {
    moderator: process.env.ROLE_MODERATOR || null,
    support: process.env.ROLE_SUPPORT || null,
    advertisement: process.env.ROLE_ADVERTISEMENT || null,
    examiner: process.env.ROLE_EXAMINER || null,
  },
};
