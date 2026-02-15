const { EmbedBuilder } = require('discord.js');

const COLORS = {
  PRIMARY: 0x5865F2,
  SUCCESS: 0x57F287,
  WARNING: 0xFEE75C,
  ERROR: 0xED4245,
  GOLD: 0xF1C40F,
  XP: 0x3498DB,
  MARKET: 0xE67E22,
  TRADE: 0x9B59B6,
  JOB: 0x2ECC71,
};

function createEmbed({ title, description, color = COLORS.PRIMARY, fields, footer, thumbnail, author }) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (author) embed.setAuthor(author);
  return embed;
}

module.exports = { COLORS, createEmbed };
