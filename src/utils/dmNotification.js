const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const GuildConfig = require('../models/GuildConfig');

/**
 * Sendet eine DM-Benachrichtigung mit "Zum Postfach"-Button.
 * Respektiert die DM-Einstellungen des Users.
 */
async function sendDmNotification(client, guildId, targetUserId, message) {
  try {
    const userDoc = await User.findOne({ guildId, userId: targetUserId });
    if (userDoc && userDoc.dmNotifications === false) return;

    const user = await client.users.fetch(targetUserId);
    const buttons = [];

    const config = await GuildConfig.findOne({ guildId });
    if (config?.marketChannelId) {
      buttons.push(
        new ButtonBuilder()
          .setURL(`https://discord.com/channels/${guildId}/${config.marketChannelId}`)
          .setLabel('Zum Postfach')
          .setEmoji('📬')
          .setStyle(ButtonStyle.Link)
      );
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId('dm_delete')
        .setLabel('Löschen')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder().addComponents(buttons);
    await user.send({ content: message, components: [row] });
  } catch {
    // DMs können deaktiviert sein — ignorieren
  }
}

module.exports = { sendDmNotification };
